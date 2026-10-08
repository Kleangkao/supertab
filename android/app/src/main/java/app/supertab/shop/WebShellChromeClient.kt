package app.supertab.shop

import android.content.ActivityNotFoundException
import android.os.Message
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class WebShellChromeClient(
    private val onProgressChanged: (Int) -> Unit,
    private val isDebug: Boolean,
) : WebChromeClient() {
    override fun onProgressChanged(
        view: WebView,
        newProgress: Int,
    ) {
        onProgressChanged(newProgress)
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
        if (!isDebug) return true
        val level = when (consoleMessage.messageLevel()) {
            ConsoleMessage.MessageLevel.ERROR -> Log.ERROR
            ConsoleMessage.MessageLevel.WARNING -> Log.WARN
            ConsoleMessage.MessageLevel.DEBUG -> Log.DEBUG
            else -> Log.INFO
        }
        Log.println(
            level,
            TAG,
            "${consoleMessage.message()} — ${consoleMessage.sourceId()}:${consoleMessage.lineNumber()}",
        )
        return true
    }

    override fun onCreateWindow(
        view: WebView,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message,
    ): Boolean {
        val popup = WebView(view.context)
        popup.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                popupView: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val scheme = request.url.scheme?.lowercase()
                if (scheme == "http" || scheme == "https") {
                    val browser = ExternalLinks.browserIntent(popupView.context, request.url)
                    if (browser != null) {
                        try {
                            popupView.context.startActivity(browser)
                        } catch (_: ActivityNotFoundException) {
                            if (isDebug) Log.w(TAG, "No browser found for a popup link")
                        }
                    }
                }
                popupView.post { popupView.destroy() }
                return true
            }
        }
        popup.webChromeClient = object : WebChromeClient() {
            override fun onCloseWindow(window: WebView) {
                window.destroy()
            }
        }
        val transport = resultMsg.obj as WebView.WebViewTransport
        transport.webView = popup
        resultMsg.sendToTarget()
        return true
    }

    private companion object {
        const val TAG = "SuperTabShell"
    }
}
