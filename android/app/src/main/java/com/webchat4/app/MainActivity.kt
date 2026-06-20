package com.webchat4.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.*
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private var serverManager: ServerManager? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var floatingServiceRunning = false

    companion object {
        private const val REQUEST_FILE_CHOOSER = 1001
        private const val REQUEST_PERMISSIONS = 1002
        private const val REQUEST_OVERLAY_PERMISSION = 1003
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
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                splash?.visibility = android.view.View.GONE
                webView.visibility = android.view.View.VISIBLE
            }
        }

        // ── 文件选择 + 定位 + 媒体权限（WebChromeClient） ──
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePath: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                filePathCallback = filePath
                val intent = fileChooserParams?.createIntent() ?: return false
                val perms = mutableListOf<String>()
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_MEDIA_IMAGES)
                    != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.READ_MEDIA_IMAGES)
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA)
                    != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.CAMERA)
                if (perms.isNotEmpty()) {
                    ActivityCompat.requestPermissions(this@MainActivity,
                        perms.toTypedArray(), REQUEST_PERMISSIONS)
                }
                startActivityForResult(intent, REQUEST_FILE_CHOOSER)
                return true
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this@MainActivity,
                        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                        REQUEST_PERMISSIONS)
                }
                callback?.invoke(origin, true, true)
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.let { req ->
                    for (r in req.resources) {
                        when (r) {
                            PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_PERMISSIONS)
                                }
                            }
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                    ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.CAMERA), REQUEST_PERMISSIONS)
                                }
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

        // 请求悬浮窗权限
        requestOverlayPermission()
    }

    // ── 悬浮窗权限 ──
    private fun requestOverlayPermission() {
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "请授权悬浮窗权限，以便在其他应用上显示看板娘", Toast.LENGTH_LONG).show()
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivityForResult(intent, REQUEST_OVERLAY_PERMISSION)
        }
    }

    // ── 启动/停止悬浮窗 Service ──
    private fun startFloatingService() {
        if (!Settings.canDrawOverlays(this)) return
        if (floatingServiceRunning) return
        val intent = Intent(this, FloatingWindowService::class.java)
        startForegroundService(intent)
        floatingServiceRunning = true
    }

    private fun stopFloatingService() {
        if (!floatingServiceRunning) return
        val intent = Intent(this, FloatingWindowService::class.java)
        stopService(intent)
        floatingServiceRunning = false
    }

    // ── 文件选择结果回调 ──
    @Deprecated("Use registerForActivityResult")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (resultCode == RESULT_OK) {
                filePathCallback?.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                )
            } else {
                filePathCallback?.onReceiveValue(null)
            }
            filePathCallback = null
        }
        if (requestCode == REQUEST_OVERLAY_PERMISSION) {
            if (Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "悬浮窗权限已授权", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onStop() {
        super.onStop()
        findViewById<WebView>(R.id.webview)?.onPause()
        // App 进入后台 → 启动悬浮窗
        startFloatingService()
    }

    override fun onRestart() {
        super.onRestart()
        findViewById<WebView>(R.id.webview)?.onResume()
    }

    override fun onStart() {
        super.onStart()
        // App 回到前台 → 停止悬浮窗
        stopFloatingService()
    }

    override fun onDestroy() {
        super.onDestroy()
        serverManager?.stopServer()
        serverManager = null
    }

    override fun onBackPressed() {
        val w = findViewById<WebView>(R.id.webview)
        if (w.canGoBack()) w.goBack() else super.onBackPressed()
    }
}
