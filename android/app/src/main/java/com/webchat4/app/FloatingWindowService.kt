package com.webchat4.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.*

class FloatingWindowService : Service() {

    companion object {
        private const val TAG = "FloatingWindow"
        private const val CHANNEL_ID = "floating_window_channel"
        private const val NOTIFICATION_ID = 1001
        private const val WINDOW_WIDTH_DP = 160
        private const val WINDOW_HEIGHT_DP = 200
        const val ACTION_SHOW = "com.webchat4.SHOW_FLOAT"
        const val ACTION_HIDE = "com.webchat4.HIDE_FLOAT"
    }

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var webView: WebView? = null
    private var isShowing = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        try {
            createNotificationChannel()
            startForeground(NOTIFICATION_ID, createNotification())
            windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        } catch (e: Exception) {
            Log.e(TAG, "Service init failed", e)
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW -> showFloatingWindow()
            ACTION_HIDE -> hideFloatingWindow()
            else -> { /* 首次启动，不自动显示 */ }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "Service destroying")
        hideFloatingWindow()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView? {
        return try {
            WebView(this).apply {
                setBackgroundColor(0)
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = true
                    allowContentAccess = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    cacheMode = WebSettings.LOAD_DEFAULT
                }
                addJavascriptInterface(FloatJsInterface(), "AndroidFloat")
                webViewClient = object : WebViewClient() {
                    override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                        Log.e(TAG, "WebView error: ${error?.description}")
                    }
                }
                loadUrl("http://127.0.0.1:3001/live2d/float.html")
            }
        } catch (e: Exception) {
            Log.e(TAG, "WebView creation failed", e)
            null
        }
    }

    private fun showFloatingWindow() {
        if (isShowing) return
        if (windowManager == null) {
            windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        }

        val density = resources.displayMetrics.density
        val widthPx = (WINDOW_WIDTH_DP * density).toInt()
        val heightPx = (WINDOW_HEIGHT_DP * density).toInt()

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            widthPx, heightPx, layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            x = (16 * density).toInt()
            y = (80 * density).toInt()
        }

        // 如果 WebView 已存在，先清理
        if (webView != null) {
            try {
                windowManager?.removeViewImmediate(floatingView)
            } catch (_: Exception) {}
            try { webView?.destroy() } catch (_: Exception) {}
            webView = null
            floatingView = null
        }

        webView = createWebView()
        if (webView == null) {
            Log.e(TAG, "Cannot create WebView, abort show")
            return
        }
        floatingView = webView

        // 触摸事件：拖拽 + 点击穿透
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isDragging = false

        floatingView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                        isDragging = true
                    }
                    if (isDragging) {
                        params.x = initialX - dx.toInt()
                        params.y = initialY - dy.toInt()
                        try { windowManager?.updateViewLayout(floatingView, params) } catch (_: Exception) {}
                    }
                    isDragging
                }
                MotionEvent.ACTION_UP -> isDragging
                else -> false
            }
        }

        try {
            windowManager?.addView(floatingView, params)
            isShowing = true
            Log.d(TAG, "Floating window shown")
        } catch (e: Exception) {
            Log.e(TAG, "addView failed", e)
            try { webView?.destroy() } catch (_: Exception) {}
            webView = null
            floatingView = null
        }
    }

    private fun hideFloatingWindow() {
        if (!isShowing && floatingView == null) return
        isShowing = false

        try {
            webView?.stopLoading()
        } catch (_: Exception) {}

        try {
            if (floatingView != null) {
                windowManager?.removeViewImmediate(floatingView)
            }
        } catch (e: Exception) {
            Log.e(TAG, "removeView failed", e)
        }

        try {
            webView?.destroy()
        } catch (_: Exception) {}

        floatingView = null
        webView = null
        Log.d(TAG, "Floating window hidden")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "看板娘悬浮窗", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Live2D 看板娘悬浮窗服务"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("看板娘")
            .setContentText("Live2D 看板娘正在运行")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()
    }

    inner class FloatJsInterface {
        @JavascriptInterface
        fun closeWindow() {
            hideFloatingWindow()
            stopSelf()
        }

        @JavascriptInterface
        fun openMainApp() {
            val intent = Intent(this@FloatingWindowService, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
            // 不 stopSelf，由 Activity 的 onStart 发 HIDE 指令
        }
    }
}
