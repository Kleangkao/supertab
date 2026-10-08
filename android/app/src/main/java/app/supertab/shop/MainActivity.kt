package app.supertab.shop

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import app.supertab.shop.ui.theme.WebShellTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        setContent {
            WebShellTheme {
                WebShellScreen()
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebShellScreen() {
    val context = LocalContext.current
    val startUrl = remember { normalizeHttpUrl() }
    if (startUrl == null) {
        Log.e(TAG, "SUPERTAB_MOBILE_URL is not a valid http(s) URL")
        return
    }
    val scopeHost = remember(startUrl) { startUrl.toUri().host.orEmpty() }
    val origin = remember(startUrl) {
        val uri = startUrl.toUri()
        "${uri.scheme}://${uri.host}"
    }
    var progress by remember { mutableFloatStateOf(0f) }
    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var hasError by remember { mutableStateOf(false) }
    var showSplash by remember { mutableStateOf(true) }
    var canGoBack by remember { mutableStateOf(false) }
    val historyListener = remember { HistoryListener() }

    val webView = remember {
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
            .build()
        val startup = startupScript(context)
        WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.setSupportMultipleWindows(true)
            settings.userAgentString = appendShellMarker(settings.userAgentString)
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                WebViewCompat.addDocumentStartJavaScript(this, startup, setOf(origin))
            }
            webChromeClient = WebShellChromeClient(
                onProgressChanged = { newProgress ->
                    progress = newProgress / 100f
                    if (newProgress > 0) showSplash = false
                    isLoading = newProgress < 100
                },
                isDebug = BuildConfig.DEBUG,
            )
            webViewClient = object : WebShellViewClient(
                context,
                scopeHostProvider = { scopeHost },
                assetLoader = assetLoader,
                onHistoryChanged = { historyListener.listener(canGoBack()) },
            ) {
                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                        view?.evaluateJavascript(startup, null)
                    }
                }

                override fun onPageFinished(view: WebView, url: String?) {
                    hasError = false
                    isRefreshing = false
                    historyListener.listener(view.canGoBack())
                    view.evaluateJavascript(VIEWPORT_PATCH, null)
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?,
                ) {
                    if (request?.isForMainFrame == true) {
                        hasError = true
                        isRefreshing = false
                    }
                }
            }
            loadUrl(startUrl)
        }
    }
    historyListener.listener = { canGoBack = it }

    val swipeRefreshLayout = remember(webView) {
        SwipeRefreshLayout(context).apply {
            setOnChildScrollUpCallback { _, _ -> webView.canScrollVertically(-1) }
            setOnRefreshListener {
                hasError = false
                isLoading = true
                isRefreshing = true
                webView.reload()
            }
            addView(webView)
        }
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, webView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> {
                    CookieManager.getInstance().flush()
                    webView.evaluateJavascript("window.dispatchEvent(new Event('supertab-shell-hide'))", null)
                }
                Lifecycle.Event.ON_RESUME -> {
                    webView.evaluateJavascript("window.dispatchEvent(new Event('supertab-shell-resume'))", null)
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    DisposableEffect(Unit) {
        onDispose {
            swipeRefreshLayout.removeView(webView)
            webView.destroy()
        }
    }
    BackHandler(enabled = canGoBack) { webView.goBack() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .windowInsetsPadding(WindowInsets.systemBars),
    ) {
        AndroidView(factory = { swipeRefreshLayout }, modifier = Modifier.fillMaxSize(), update = { it.isRefreshing = isRefreshing })
        if (isLoading && !hasError) {
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter))
        }
        if (hasError) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("SuperTab needs a connection", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(12.dp))
                    Text("The shopping service did not load. Nothing was charged.")
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = {
                        hasError = false
                        isLoading = true
                        webView.reload()
                    }) { Text("Try again") }
                }
            }
        }
        AnimatedVisibility(visible = showSplash, exit = fadeOut()) {
            Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
    }
}

private class HistoryListener {
    var listener: (Boolean) -> Unit = {}
}

private fun startupScript(context: android.content.Context): String {
    val mirror = context.assets.open("session-mirror.js").bufferedReader().use { it.readText() }
    return mirror + WALLET_LOADER
}

private fun appendShellMarker(baseUserAgent: String): String {
    val marker = "Solana Mobile Web Shell"
    return if (baseUserAgent.contains(marker)) baseUserAgent.trim() else "${baseUserAgent.trim()} $marker"
}

private fun normalizeHttpUrl(): String? {
    val trimmed = BuildConfig.SUPERTAB_MOBILE_URL.trim()
    if (trimmed.isEmpty()) return null
    val withScheme = if ("://" in trimmed) trimmed else "https://$trimmed"
    val uri = withScheme.toUri()
    val scheme = uri.scheme?.lowercase()
    if (scheme != "http" && scheme != "https") return null
    if (uri.host.isNullOrBlank()) return null
    return uri.toString()
}

private const val TAG = "SuperTabShell"
private const val WALLET_LOADER = """
;(function () {
  if (window.__supertabMwaRegistered) return;
  var script = document.createElement("script");
  script.src = "https://appassets.androidplatform.net/assets/mwa-bootstrap.js";
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
})();
"""

private const val VIEWPORT_PATCH = """
(function () {
  function update() {
    var height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var overlap = Math.max(0, (window.innerHeight || 0) - height);
    document.documentElement.style.setProperty("--keyboard-overlap", overlap + "px");
  }
  if (!window.__supertabViewport) {
    window.__supertabViewport = true;
    window.addEventListener("resize", update);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", update);
  }
  update();
})();
"""
