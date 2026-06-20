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
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.*

class FloatingWindowService : Service() {

    companion object {
        private const val CHANNEL_ID = "floating_window_channel"
        private const val NOTIFICATION_ID = 1001
        private const val WINDOW_WIDTH_DP = 160
        private const val WINDOW_HEIGHT_DP = 200
    }

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var webView: WebView? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        createFloatingWindow()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        removeFloatingWindow()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createFloatingWindow() {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        val density = resources.displayMetrics.density
        val widthPx = (WINDOW_WIDTH_DP * density).toInt()
        val heightPx = (WINDOW_HEIGHT_DP * density).toInt()

        // Layout type
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            widthPx,
            heightPx,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            x = (16 * density).toInt()
            y = (80 * density).toInt()
        }

        // 创建 WebView
        webView = WebView(this).apply {
            setBackgroundColor(0)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
            // 添加 JS 接口
            addJavascriptInterface(FloatJsInterface(), "AndroidFloat")
            // 加载悬浮窗页面
            loadUrl("http://127.0.0.1:3001/live2d/float.html")
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
                    false // 不消费，让 WebView 处理点击
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                        isDragging = true
                    }
                    if (isDragging) {
                        // 注意：Gravity.END 时 x 轴方向相反
                        params.x = initialX - dx.toInt()
                        params.y = initialY - dy.toInt()
                        try { windowManager?.updateViewLayout(floatingView, params) } catch (_: Exception) {}
                    }
                    isDragging
                }
                MotionEvent.ACTION_UP -> {
                    isDragging
                }
                else -> false
            }
        }

        try {
            windowManager?.addView(floatingView, params)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun removeFloatingWindow() {
        try {
            webView?.stopLoading()
            webView?.destroy()
            windowManager?.removeView(floatingView)
        } catch (_: Exception) {}
        floatingView = null
        webView = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "看板娘悬浮窗",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Live2D 看板娘悬浮窗服务"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
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

    /* ── JS ↔ Android 桥接 ── */
    inner class FloatJsInterface {
        @JavascriptInterface
        fun closeWindow() {
            stopSelf()
        }

        @JavascriptInterface
        fun openMainApp() {
            val intent = Intent(this@FloatingWindowService, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
            stopSelf()
        }

        @JavascriptInterface
        fun updatePosition(x: Int, y: Int) {
            // 由 Android 原生拖拽处理，此接口备用
        }
    }
}
