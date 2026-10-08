package app.supertab.shop.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SuperTabColors = lightColorScheme(
    primary = Color(0xFF33482B),
    onPrimary = Color(0xFFF7F5EF),
    background = Color(0xFFF7F5EF),
    surface = Color(0xFFF7F5EF),
    onBackground = Color(0xFF262922),
    onSurface = Color(0xFF262922),
)

@Composable
fun WebShellTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = SuperTabColors, content = content)
}
