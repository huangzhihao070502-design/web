// Copyright (c)  2023  Xiaomi Corporation
// From https://github.com/k2-fsa/sherpa-onnx, Apache 2.0
package com.k2fsa.sherpa.onnx

import android.content.res.AssetManager

data class OfflineTtsVitsModelConfig(
    var model: String = "", var lexicon: String = "", var tokens: String = "",
    var dataDir: String = "", var dictDir: String = "",
    var noiseScale: Float = 0.667f, var noiseScaleW: Float = 0.8f, var lengthScale: Float = 1.0f,
)
data class OfflineTtsMatchaModelConfig(
    var acousticModel: String = "", var vocoder: String = "", var lexicon: String = "",
    var tokens: String = "", var dataDir: String = "", var dictDir: String = "",
    var noiseScale: Float = 1.0f, var lengthScale: Float = 1.0f,
)
data class OfflineTtsKokoroModelConfig(
    var model: String = "", var voices: String = "", var tokens: String = "",
    var dataDir: String = "", var lexicon: String = "", var lang: String = "",
    var dictDir: String = "", var lengthScale: Float = 1.0f,
)
data class OfflineTtsModelConfig(
    var vits: OfflineTtsVitsModelConfig = OfflineTtsVitsModelConfig(),
    var matcha: OfflineTtsMatchaModelConfig = OfflineTtsMatchaModelConfig(),
    var kokoro: OfflineTtsKokoroModelConfig = OfflineTtsKokoroModelConfig(),
    var numThreads: Int = 1, var debug: Boolean = false, var provider: String = "cpu",
)
data class OfflineTtsConfig(
    var model: OfflineTtsModelConfig = OfflineTtsModelConfig(),
    var ruleFsts: String = "", var ruleFars: String = "",
    var maxNumSentences: Int = 1, var silenceScale: Float = 0.2f,
)
class GeneratedAudio(val samples: FloatArray, val sampleRate: Int)

class OfflineTts(assetManager: AssetManager? = null, var config: OfflineTtsConfig) {
    private var ptr: Long = 0
    init { ptr = if (assetManager != null) newFromAsset(assetManager, config) else newFromFile(config) }
    fun sampleRate(): Int = getSampleRate(ptr)
    fun numSpeakers(): Int = getNumSpeakers(ptr)
    fun generate(text: String, sid: Int = 0, speed: Float = 1.0f): GeneratedAudio = generateImpl(ptr, text, sid, speed)
    private external fun newFromAsset(assetManager: AssetManager, config: OfflineTtsConfig): Long
    private external fun newFromFile(config: OfflineTtsConfig): Long
    private external fun getSampleRate(ptr: Long): Int
    private external fun getNumSpeakers(ptr: Long): Int
    private external fun generateImpl(ptr: Long, text: String, sid: Int, speed: Float): GeneratedAudio
}
