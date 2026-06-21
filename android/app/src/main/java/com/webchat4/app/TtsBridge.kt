package com.webchat4.app

import android.content.Context
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.webkit.JavascriptInterface
import android.util.Log
import java.util.Locale

/**
 * Android 原生 TTS 桥接 —— 通过 @JavascriptInterface 暴露给 WebView
 * 解决 Android WebView SpeechSynthesis API 不可用的问题。
 */
class TtsBridge(private val context: Context) {

    companion object {
        private const val TAG = "TtsBridge"
        const val JS_NAME = "AndroidTts"
    }

    private var tts: TextToSpeech? = null
    private var initialized = false
    private var callbackId: String? = null

    /** 初始化 TTS 引擎（由主线程调用） */
    fun init() {
        if (initialized) return
        tts = TextToSpeech(context) { status ->
            initialized = (status == TextToSpeech.SUCCESS)
            if (initialized) {
                tts?.language = Locale.CHINESE
                tts?.setSpeechRate(1.0f)
                tts?.setPitch(1.0f)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) {}
                        override fun onDone(utteranceId: String?) { if (utteranceId == callbackId) callbackId = null }
                        override fun onError(utteranceId: String?) { callbackId = null }
                    })
                }
                Log.d(TAG, "TTS initialized successfully")
            } else {
                Log.w(TAG, "TTS initialization failed, status=$status")
            }
        }
    }

    fun shutdown() { tts?.stop(); tts?.shutdown(); tts = null; initialized = false }

    @JavascriptInterface
    fun isAvailable(): Boolean = initialized

    @JavascriptInterface
    fun speak(text: String) {
        if (!initialized || text.isBlank()) return
        try {
            val id = "tts_${System.currentTimeMillis()}"
            callbackId = id
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, id)
            } else {
                @Suppress("DEPRECATION")
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null)
            }
        } catch (e: Exception) { Log.e(TAG, "TTS speak error: ${e.message}") }
    }

    @JavascriptInterface
    fun stop() { tts?.stop(); callbackId = null }

    @JavascriptInterface
    fun setRate(rate: Float) { tts?.setSpeechRate(rate.coerceIn(0.1f, 3.0f)) }

    @JavascriptInterface
    fun setPitch(pitch: Float) { tts?.setPitch(pitch.coerceIn(0.1f, 3.0f)) }

    @JavascriptInterface
    fun getVoices(): String {
        if (!initialized) return "[]"
        val locales = tts?.availableLanguages ?: return "[]"
        val names = locales.map { loc -> """{"name":"${loc.displayName}","lang":"${loc.language}-${loc.country}"}""" }
        return "[${names.joinToString(",")}]"
    }
}
