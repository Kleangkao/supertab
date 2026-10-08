plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

fun String.escapeForBuildConfig(): String = replace("\\", "\\\\").replace("\"", "\\\"")

fun configValue(name: String): String? =
    (findProperty(name) as String?)
        ?.trim()
        ?.ifBlank { null }
        ?: System.getenv(name)?.trim()?.ifBlank { null }

val webShellUrl = configValue("SUPERTAB_MOBILE_URL") ?: "https://supertab-main.vercel.app/"
val webShellApplicationId = configValue("SUPERTAB_APPLICATION_ID") ?: "app.supertab.shop"
val webShellVersionCode = configValue("SUPERTAB_VERSION_CODE")?.toIntOrNull() ?: 1
val webShellVersionName = configValue("SUPERTAB_VERSION_NAME") ?: "1.0.0"
val webShellSigningStoreFile = configValue("SUPERTAB_KEYSTORE_PATH")
val webShellSigningStorePassword = configValue("SUPERTAB_KEYSTORE_PASSWORD")
val webShellSigningKeyAlias = configValue("SUPERTAB_KEYSTORE_ALIAS")
val webShellSigningKeyPassword = configValue("SUPERTAB_KEY_PASSWORD") ?: webShellSigningStorePassword
val hasReleaseSigning =
    webShellSigningStoreFile != null &&
        webShellSigningStorePassword != null &&
        webShellSigningKeyAlias != null

if (webShellApplicationId != "app.supertab.shop" && configValue("SUPERTAB_ALLOW_APPLICATION_ID") != "1") {
    throw GradleException("SuperTab release identity must stay app.supertab.shop unless SUPERTAB_ALLOW_APPLICATION_ID=1.")
}

gradle.taskGraph.whenReady {
    val wantsRelease = allTasks.any { it.name.contains("Release") }
    if (!wantsRelease) return@whenReady
    if (!webShellUrl.startsWith("https://")) {
        throw GradleException("The release APK must load an https backend.")
    }
    if (!hasReleaseSigning) {
        throw GradleException(
            "Release signing is missing. Set SUPERTAB_KEYSTORE_PATH, SUPERTAB_KEYSTORE_ALIAS, and SUPERTAB_KEYSTORE_PASSWORD outside this repository.",
        )
    }
}

android {
    namespace = "app.supertab.shop"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = webShellApplicationId
        minSdk = 28
        targetSdk = 37
        versionCode = webShellVersionCode
        versionName = webShellVersionName
        buildConfigField("String", "SUPERTAB_MOBILE_URL", "\"${webShellUrl.escapeForBuildConfig()}\"")
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("supertabRelease") {
                storeFile = file(webShellSigningStoreFile!!)
                storePassword = webShellSigningStorePassword
                keyAlias = webShellSigningKeyAlias
                keyPassword = webShellSigningKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("supertabRelease")
            }
        }
        release {
            isMinifyEnabled = false
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("supertabRelease")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.swiperefreshlayout)
    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
}
