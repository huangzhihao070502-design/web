package com.webchat4.app

import android.content.Context

class ServerManager(private val context: Context) {
    var lastError: String = ""

    private var webServer: WebServer? = null

    fun isRunning(): Boolean = webServer?.isRunning() == true

    fun startServer(callback: (Boolean) -> Unit) {
        lastError = ""
        Thread {
            val ws = WebServer(context, 3001)
            val err = ws.start()
            if (err.isEmpty()) {
                webServer = ws
                callback(true)
            } else {
                lastError = err
                webServer = null
                callback(false)
            }
        }.start()
    }

    fun stopServer() {
        webServer?.stop()
        webServer = null
    }
}
