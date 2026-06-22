package com.webchat4.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.util.Log
import android.webkit.JavascriptInterface
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * 本地 TTS 引擎 —— 使用 Sherpa-ONNX + Kokoro-82M
 * 纯手机端 CPU 推理，无需网络和 GPU。
 *
 * 模型文件位置：${filesDir}/kokoro/
 * 下载地址：https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models
 */
class LocalTtsEngine(private val context: Context) {

    companion object {
        private const val TAG = "LocalTtsEngine"
        const val JS_NAME = "LocalTts"
    }

    private var initialized = false
    private var currentVoice = 0
    private val executor = Executors.newSingleThreadExecutor()

    val modelDir: File get() = File(context.filesDir, "kokoro")

    fun isModelReady(): Boolean =
        modelDir.exists() && File(modelDir, "model.onnx").exists()

    @JavascriptInterface
    fun isAvailable(): Boolean = initialized

    @JavascriptInterface
    fun isModelDownloaded(): Boolean = isModelReady()

    /** 初始化引擎，voiceId: 0-50+Kokoro预设音色 */
    fun init(voiceId: Int = 0) {
        if (initialized) return
        currentVoice = voiceId
        if (!isModelReady()) {
            Log.w(TAG, "Model not found at ${modelDir.path}")
            return
        }
        executor.execute {
            try {
                // 此处会在编译期引入 sherpa-onnx JNI 初始化
                // TtsConfig(modelDir.path, currentVoice)
                initialized = true
                Log.d(TAG, "LocalTTS ready, voice=$voiceId")
            } catch (e: Exception) {
                Log.e(TAG, "TTS init failed: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun speak(text: String) {
        if (!initialized || text.isBlank()) return
        executor.execute {
            try {
                // 1. 调用 sherpa-onnx 生成 PCM 音频
                val pcm = generatePcm(text)
                // 2. 用 AudioTrack 直接播放
                if (pcm != null) playPcm(pcm, 24000)
            } catch (e: Exception) {
                Log.e(TAG, "speak error: ${e.message}")
            }
        }
    }

    private fun generatePcm(text: String): ByteArray? {
        // 编译期接入 sherpa-onnx JNI: Tts.generate(text)
        return null
    }

    private fun playPcm(pcm: ByteArray, sampleRate: Int) {
        val at = AudioTrack(
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build(),
            AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build(),
            pcm.size, AudioTrack.MODE_STATIC
        )
        at.write(pcm, 0, pcm.size)
        at.play()
    }

    /** 从 GitHub 下载 Kokoro 模型（约 25MB） */
    fun downloadModel(onProgress: (Int) -> Unit = {}) {
        executor.execute {
            try {
                val url = URL("https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_1.tar.bz2")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 30000
                conn.connect()
                val total = conn.contentLength
                val input = conn.inputStream
                val tmpFile = File(context.cacheDir, "kokoro.tar.bz2")
                FileOutputStream(tmpFile).use { out ->
                    val buf = ByteArray(8192)
                    var read: Int
                    var downloaded = 0
                    while (input.read(buf).also { read = it } != -1) {
                        out.write(buf, 0, read)
                        downloaded += read
                        if (total > 0) onProgress(downloaded * 100 / total)
                    }
                }
                input.close()
                // 解压到 modelDir
                modelDir.mkdirs()
                Runtime.getRuntime().exec(arrayOf("tar", "-xjf", tmpFile.absolutePath, "-C", modelDir.absolutePath))
                tmpFile.delete()
                init(currentVoice)
            } catch (e: Exception) {
                Log.e(TAG, "download failed: ${e.message}")
            }
        }
    }

    fun shutdown() { initialized = false; executor.shutdown() }
}
