package com.webchat4.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.webkit.*
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private var serverManager: ServerManager? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var overlayPermissionGranted = false
    private var serviceStarted = false
    private var storagePermissionRequested = false
    private var backupStarted = false
    private var ttsBridge: TtsBridge? = null

    companion object {
        private const val TAG = "MainActivity"
        private const val REQUEST_FILE_CHOOSER = 1001
        private const val REQUEST_PERMISSIONS = 1002
        private const val REQUEST_OVERLAY_PERMISSION = 1003
        private const val REQUEST_STORAGE = 1004
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val webView = findViewById<WebView>(R.id.webview)
        val splash = findViewById<android.view.View>(R.id.splash_layout)
        val statusText = findViewById<TextView>(R.id.status_text)
        val titleText = findViewById<TextView>(R.id.title_text)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                splash?.visibility = android.view.View.GONE
                webView.visibility = android.view.View.VISIBLE
            }
        }

        // TTS 桥接 — Android 原生 TTS
        ttsBridge = TtsBridge(this).also { bridge ->
            bridge.init()
            webView.addJavascriptInterface(bridge, TtsBridge.JS_NAME)
        }
webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?, filePath: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?
            ): Boolean {
                filePathCallback = filePath
                val intent = fileChooserParams?.createIntent() ?: return false
                val perms = mutableListOf<String>()
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.READ_MEDIA_IMAGES)
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.CAMERA)
                if (perms.isNotEmpty()) ActivityCompat.requestPermissions(this@MainActivity, perms.toTypedArray(), REQUEST_PERMISSIONS)
                startActivityForResult(intent, REQUEST_FILE_CHOOSER)
                return true
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), REQUEST_PERMISSIONS)
                }
                callback?.invoke(origin, true, true)
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.let { req ->
                    for (r in req.resources) {
                        when (r) {
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_PERMISSIONS)
                            }
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
                                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.CAMERA), REQUEST_PERMISSIONS)
                            }
                        }
                    }
                    req.grant(req.resources)
                }
            }
        }

        titleText.text = "启动中..."
        statusText.text = "正在初始化..."

        serverManager = ServerManager(this)
        serverManager?.startServer { success ->
            runOnUiThread {
                if (success) {
                    splash?.visibility = android.view.View.GONE
                    webView.visibility = android.view.View.VISIBLE
                    webView.loadUrl("http://127.0.0.1:3001")
                } else {
                    findViewById<android.widget.ProgressBar>(R.id.progress_bar)?.visibility = android.view.View.GONE
                    titleText?.text = "启动失败"
                    statusText?.text = serverManager?.lastError ?: "未知错误"
                    statusText?.setTextColor(0xFFCC0000.toInt())
                }
            }
        }

        // 检查悬浮窗权限（不强制弹窗）
        overlayPermissionGranted = Settings.canDrawOverlays(this)
        if (!overlayPermissionGranted) {
            webView.postDelayed({
                requestOverlayPermission()
            }, 3000)
        }

        // 检查储存权限，未授权则申请
        webView.postDelayed({
            requestStoragePermissions()
        }, 5000)

        // 立即启动前台 Service（App 在前台时启动，不触发 Android 12+ 限制）
        startFloatService()
    }

    // ── 悬浮窗权限 ──
    private fun requestOverlayPermission() {
        if (Settings.canDrawOverlays(this)) {
            overlayPermissionGranted = true
            return
        }
        Toast.makeText(this, "请授权悬浮窗权限，以便在其他应用上显示看板娘", Toast.LENGTH_LONG).show()
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
        startActivityForResult(intent, REQUEST_OVERLAY_PERMISSION)
    }

    // ── 请求储存权限 ──
    private fun requestStoragePermissions() {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED)
                perms.add(Manifest.permission.READ_MEDIA_IMAGES)
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED)
                perms.add(Manifest.permission.READ_MEDIA_VIDEO)
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
                perms.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        if (perms.isNotEmpty()) {
            // 如果已经有权限了直接启动；否则弹系统对话框（只弹一次）
            if (!storagePermissionRequested) {
                storagePermissionRequested = true
                ActivityCompat.requestPermissions(this, perms.toTypedArray(), REQUEST_STORAGE)
            }
        } else {
            // 已有权限，直接启动备份
            tryStartBackup()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_STORAGE) {
            tryStartBackup()
        }
    }

    private fun tryStartBackup() {
        if (backupStarted) return
        if (!MediaBackupService.hasStoragePermission(this)) return
        backupStarted = true
        Log.d(TAG, "Storage permission granted, starting backup service")
        MediaBackupService.startIfPermitted(this)
    }

    // ── 启动前台 Service（只在 App 前台时调用） ──
    private fun startFloatService() {
        if (serviceStarted) return
        try {
            val intent = Intent(this, FloatingWindowService::class.java)
            startForegroundService(intent)
            serviceStarted = true
            Log.d(TAG, "Floating service started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start floating service", e)
        }
    }

    // ── 通知 Service 显示/隐藏悬浮窗 ──
    private fun sendFloatAction(action: String) {
        if (!serviceStarted) return
        try {
            val intent = Intent(this, FloatingWindowService::class.java).apply {
                this.action = action
            }
            startService(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send float action: $action", e)
        }
    }

    // ── 文件选择结果回调 ──
    @Deprecated("Use registerForActivityResult")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (resultCode == RESULT_OK) {
                filePathCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            } else {
                filePathCallback?.onReceiveValue(null)
            }
            filePathCallback = null
        }
        if (requestCode == REQUEST_OVERLAY_PERMISSION) {
            overlayPermissionGranted = Settings.canDrawOverlays(this)
            if (overlayPermissionGranted) {
                Toast.makeText(this, "悬浮窗权限已授权 ✓", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "未授权悬浮窗权限，后台将不会显示看板娘", Toast.LENGTH_SHORT).show()
            }
            // 从悬浮窗设置返回后，检查储存权限并启动备份
            tryStartBackup()
        }
    }

    override fun onStop() {
        super.onStop()
        try { findViewById<WebView>(R.id.webview)?.onPause() } catch (_: Exception) {}
        // App 进入后台 → 通知 Service 显示悬浮窗
        if (overlayPermissionGranted && !isFinishing) {
            sendFloatAction(FloatingWindowService.ACTION_SHOW)
        }
    }

    override fun onStart() {
        super.onStart()
        try { findViewById<WebView>(R.id.webview)?.onResume() } catch (_: Exception) {}
        // App 回到前台 → 通知 Service 隐藏悬浮窗
        sendFloatAction(FloatingWindowService.ACTION_HIDE)
        // 每次回到前台尝试启动备份（用户可能在系统设置里刚给了权限）
        tryStartBackup()
        // 如果还没请求过权限，触发请求
        if (!storagePermissionRequested) {
            requestStoragePermissions()
        }
    }

    override fun onDestroy() {
        // 通知 Service 隐藏悬浮窗（但不停止 Service，避免重建开销）
        sendFloatAction(FloatingWindowService.ACTION_HIDE)
        ttsBridge?.shutdown()
        ttsBridge = null
        super.onDestroy()
        serverManager?.stopServer()
        serverManager = null
    }

    override fun onBackPressed() {
        val w = findViewById<WebView>(R.id.webview)
        if (w.canGoBack()) w.goBack() else super.onBackPressed()
    }
}
