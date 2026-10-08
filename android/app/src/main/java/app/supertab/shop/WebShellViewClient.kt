package app.supertab.shop

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.net.toUri
import androidx.webkit.WebViewAssetLoader

open class WebShellViewClient(
    private val context: Context,
    private val scopeHostProvider: () -> String,
    private val assetLoader: WebViewAssetLoader,
    private val onHistoryChanged: () -> Unit,
) : WebViewClient() {
    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest,
    ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

    override fun doUpdateVisitedHistory(
        view: WebView,
        url: String?,
        isReload: Boolean,
    ) {
        onHistoryChanged()
    }

    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest,
    ): Boolean {
        val url = request.url
        return when (
            classifyNavigation(
                scheme = url.scheme,
                host = url.host,
                scopeHost = scopeHostProvider(),
                mainFrame = request.isForMainFrame,
            )
        ) {
            ShellNavigation.InApp -> false
            ShellNavigation.Wallet -> {
                if (launchExternal(Intent(Intent.ACTION_VIEW, url))) {
                    // Mobile Wallet Adapter treats window blur as proof the wallet opened.
                    // A WebView does not blur on its own, so the shell emits that event.
                    view.evaluateJavascript("window.dispatchEvent(new Event('blur'))", null)
                }
                true
            }
            ShellNavigation.External -> {
                if (url.scheme.equals("intent", ignoreCase = true)) handleIntentScheme(url.toString())
                else {
                    val browser = ExternalLinks.browserIntent(context, url)
                    if (browser != null) launchExternal(browser)
                    else Log.w(TAG, "No browser found for an off-host link")
                }
                true
            }
            ShellNavigation.Blocked -> {
                Log.w(TAG, "Blocked unsupported URL scheme: ${url.scheme}")
                true
            }
        }
    }

    private fun handleIntentScheme(url: String) {
        try {
            val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
            intent.addCategory(Intent.CATEGORY_BROWSABLE)
            intent.component = null
            intent.selector = null
            intent.removeFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PREFIX_URI_PERMISSION,
            )
            if (!launchExternal(intent)) {
                val fallback = intent.getStringExtra("browser_fallback_url")?.toUri()
                val fallbackScheme = fallback?.scheme?.lowercase()
                if (fallback != null && (fallbackScheme == "http" || fallbackScheme == "https")) {
                    launchExternal(Intent(Intent.ACTION_VIEW, fallback))
                }
            }
        } catch (_: Exception) {
            Log.w(TAG, "Ignored a malformed intent URL")
        }
    }

    private fun launchExternal(intent: Intent): Boolean {
        if (context !is Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            Log.w(TAG, "No activity found for scheme: ${intent.data?.scheme}")
            false
        }
    }

    private companion object {
        const val TAG = "SuperTabShell"
    }
}
