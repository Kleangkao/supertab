# SuperTab Android shell

The installed app is a WebView shell. It loads the hosted Next.js app at `https://supertab-main.vercel.app/` and hands `solana-wallet:` links to a Mobile Wallet Adapter wallet. Shopping, quotes, and devnet evidence stay on that server. The APK does not contain API keys, the merchant control token, or a signing key.

Application id: `app.supertab.shop`  
Version name: `1.0.0`  
Version code: `1`

## Build

Use JDK 17 and an Android SDK (`JAVA_HOME` and `ANDROID_HOME`). From `android/`:

```powershell
$signing = Join-Path $env:USERPROFILE ".config\supertab\signing.properties"
Get-Content -LiteralPath $signing | ForEach-Object {
  if ($_ -match '^(?<name>[^=]+)=(?<value>.*)$') {
    Set-Item -Path "Env:$($Matches.name)" -Value $Matches.value
  }
}
.\gradlew.bat assembleRelease
```

The release keystore and passwords stay in `%USERPROFILE%\.config\supertab\`. They are not in this repository. The build reads `SUPERTAB_KEYSTORE_PATH`, `SUPERTAB_KEYSTORE_ALIAS`, `SUPERTAB_KEYSTORE_PASSWORD`, and `SUPERTAB_KEY_PASSWORD`.

Install on a Seeker with USB debugging enabled. Confirm `adb devices` shows the phone, not an emulator, then:

```powershell
adb install -r app\build\outputs\apk\release\app-release.apk
adb shell am start -n app.supertab.shop/.MainActivity
```

The 8 October 2026 check used a physical Seeker on Android 16. The app launched, searched, refined, and opened the existing refunded devnet order. The Seeker wallet opened through Mobile Wallet Adapter and then reported that it could not load the wallet. That balance read is unverified. Do not approve a payment from the devnet page.

A debug build can point at a local server with `-PSUPERTAB_MOBILE_URL=http://10.0.2.2:3000`. That build is not the submission APK. Release builds refuse a non-https URL.

Regenerate the wallet bundle from the repository root after changing `src/lib/mwa-bootstrap.ts`:

```powershell
npm ci
npm run bundle:mwa
npx vitest run tests/android-shell.test.ts
```
