package app.supertab.shop

enum class ShellNavigation {
    InApp,
    Wallet,
    External,
    Blocked,
}

/**
 * Decides what the WebView may do with a main-frame URL.
 * Subframes are ignored by the caller so embedded pages keep working.
 */
fun classifyNavigation(
    scheme: String?,
    host: String?,
    scopeHost: String,
    mainFrame: Boolean,
): ShellNavigation {
    if (!mainFrame) return ShellNavigation.InApp
    return when (scheme?.lowercase()) {
        "solana-wallet" -> ShellNavigation.Wallet
        "intent" -> ShellNavigation.External
        "blob", "javascript" -> ShellNavigation.InApp
        "http", "https" ->
            if (host.equals(scopeHost, ignoreCase = true)) ShellNavigation.InApp
            else ShellNavigation.External
        else -> ShellNavigation.Blocked
    }
}
