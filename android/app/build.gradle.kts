plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.webchat4.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.webchat4.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        jvmToolchain(17)
    }

    aaptOptions {
        noCompress("js", "css", "html", "svg", "png", "json", "woff2", "ttf", "onnx", "bin")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    // Sherpa-ONNX — 本地 TTS 引擎（Kokoro-82M）
    implementation("com.k2fsa.sherpa-onnx:sherpa-onnx-android:1.13.2")
}
