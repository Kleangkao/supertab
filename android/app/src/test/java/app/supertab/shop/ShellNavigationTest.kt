package app.supertab.shop

import org.junit.Assert.assertEquals
import org.junit.Test

class ShellNavigationTest {
    @Test
    fun keepsTheHostedAppInsideTheShell() {
        assertEquals(
            ShellNavigation.InApp,
            classifyNavigation("https", "supertab-main.vercel.app", "supertab-main.vercel.app", true),
        )
    }

    @Test
    fun sendsWalletRequestsToTheMobileWalletAdapter() {
        assertEquals(
            ShellNavigation.Wallet,
            classifyNavigation("solana-wallet", null, "supertab-main.vercel.app", true),
        )
    }

    @Test
    fun opensOtherHttpsHostsOutsideTheShell() {
        assertEquals(
            ShellNavigation.External,
            classifyNavigation("https", "www.ebay.com", "supertab-main.vercel.app", true),
        )
    }

    @Test
    fun blocksUnexpectedSchemes() {
        assertEquals(
            ShellNavigation.Blocked,
            classifyNavigation("file", "local", "supertab-main.vercel.app", true),
        )
    }

    @Test
    fun leavesSubframesAlone() {
        assertEquals(
            ShellNavigation.InApp,
            classifyNavigation("https", "cdn.example", "supertab-main.vercel.app", false),
        )
    }
}
