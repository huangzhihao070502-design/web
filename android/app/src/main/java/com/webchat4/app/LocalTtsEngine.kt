package com.webchat4.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import android.webkit.JavascriptInterface
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig

/**
 * 本地 TTS 引擎 —— 使用 Sherpa-ONNX + Kokoro-82M
 * 完全离线，纯手机 CPU 推理，无需网络。
 *
 * 模型从 APK assets/kokoro/ 解压到 ${filesDir}/kokoro/
 */
class LocalTtsEngine(private val context: Context) {

    companion object {
        private const val TAG = "LocalTtsEngine"
        const val JS_NAME = "LocalTts"
        const val ASSET_MODEL_DIR = "kokoro"
    }

    private var tts: OfflineTts? = null
    private var initialized = false
    private val executor = Executors.newSingleThreadExecutor()

    val modelDir: File get() = File(context.filesDir, ASSET_MODEL_DIR)

    // 从错误信息推断 API：
    // OfflineTts(assetManager, config) — 第一个参数是 AssetManager
    // generate(text: String, sid: Int, speed: Float): FloatArray
    // 或 generate(text: String, sid: Int): FloatArray

    /** 从 APK assets 复制模型到内部存储 */
    private fun copyModelFromAssets(): Boolean {
        try {
            if (File(modelDir, "model.onnx").exists()) return true
            modelDir.mkdirs()
            // 遍历 assets/kokoro/ 中所有文件并复制
            for (asset in context.assets.list(ASSET_MODEL_DIR) ?: emptyArray()) {
                copyRecursive(ASSET_MODEL_DIR, asset, modelDir)
            }
            Log.d(TAG, "Model copied from assets to ${modelDir.path}")
            return File(modelDir, "model.onnx").exists()
        } catch (e: Exception) {
            Log.e(TAG, "Copy model failed: ${e.message}")
            return false
        }
    }

    private fun copyRecursive(relPath: String, name: String, destDir: File) {
        val child = File(destDir, name)
        val assetPath = "$relPath/$name"
        try {
            val input = context.assets.open(assetPath)
            child.parentFile?.mkdirs()
            FileOutputStream(child).use { out -> input.copyTo(out) }
            input.close()
        } catch (_: Exception) {
            // 可能是目录，尝试遍历
            try {
                for (sub in context.assets.list(assetPath) ?: emptyArray()) {
                    copyRecursive(assetPath, sub, child)
                }
            } catch (_: Exception) {}
        }
    }

    @JavascriptInterface
    fun isAvailable(): Boolean = initialized

    /** 初始化引擎 */
    fun init() {
        if (initialized) return
        if (!copyModelFromAssets()) {
            Log.e(TAG, "Model not found in assets")
            return
        }
        executor.execute {
            try {
                val md = modelDir.absolutePath
                val cfg = OfflineTtsConfig(
                    model = OfflineTtsModelConfig(
                        kokoro = OfflineTtsKokoroModelConfig(
                            model = "$md/model.onnx",
                            voices = "$md/voices.bin",
                            tokens = "$md/tokens.txt",
                            dataDir = "$md/espeak-ng-data"
                        ),
                        numThreads = 4
                    )
                )
                tts = OfflineTts(context.assets, cfg)
                initialized = true
                Log.d(TAG, "LocalTTS ready with Kokoro-82M")
            } catch (e: Exception) {
                Log.e(TAG, "Init failed: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun speak(text: String) {
        if (!initialized || text.isBlank()) return
        executor.execute {
            try {
                val audio = tts?.generate(text) ?: return@execute
                if (audio.isEmpty()) return@execute
                val pcm = ByteArray(audio.size * 2)
                for (i in audio.indices) {
                    val s = (audio[i].toInt().coerceIn(-32768, 32767))
                    pcm[i * 2] = (s and 0xFF).toByte()
                    pcm[i * 2 + 1] = ((s shr 8) and 0xFF).toByte()
                }
                playPcm(pcm, 24000)
            } catch (e: Exception) {
                Log.e(TAG, "speak error: ${e.message}")
            }
        }
    }

    fun isModelReady(): Boolean =
        modelDir.exists() && File(modelDir, "model.onnx").exists()

    @JavascriptInterface
    fun isModelDownloaded(): Boolean = isModelReady()

    private fun playPcm(pcm: ByteArray, sampleRate: Int) {
        val at = android.media.AudioTrack(
            AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build(),
            AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(sampleRate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build(),
            pcm.size, AudioTrack.MODE_STATIC
        )
        at.write(pcm, 0, pcm.size)
        at.play()
    }

    fun shutdown() {
        initialized = false
        tts?.let { /* dispose handled by GC */ }
        tts = null
        executor.shutdown()
    }
}
