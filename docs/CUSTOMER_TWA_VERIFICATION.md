# FixBeez Play-installed TWA verification

## Diagnosis — 7 November 2026

The live `https://fixbeez.in/.well-known/assetlinks.json` returns **404**, **text/html**, and **no redirect**. That response is a Hostinger error page, not Digital Asset Links. Chrome cannot verify the app/site relationship and falls back to a Custom Tab with a toolbar. This remains a live deployment blocker until the URL is fixed.

The local Bubblewrap project and generated Android code agree:

- Package: `in.fixbeez.customer`.
- Launch: `https://fixbeez.in/`; host `fixbeez.in`; path `/`.
- Display: `standalone`. Changing this to `fullscreen` does not repair failed trust verification.
- App-to-website asset statement: `https://fixbeez.in`.
- Android HTTPS intent filter: `android:autoVerify="true"`, host `fixbeez.in`.
- No additional trusted origins configured. `www.fixbeez.in`, Google OAuth and the API origin are not implicitly trusted UI origins. The apex homepage responds directly without redirecting to www. API requests do not require adding the API server as a trusted TWA UI origin. External sites may correctly display browser UI.
- Existing version code 2 AAB remains unchanged. No new key, package change or AAB was generated for this fix.

There was no connected Android device/Play Console session during this investigation. The actual Play-installed package/certificate must be compared using the commands below; source inspection alone cannot independently prove which APK is on a phone.

## Certificates

Both existing fingerprints are retained in `apps/customer-pwa/public/.well-known/assetlinks.json`:

- Owner-supplied Play app-signing SHA-256 (supplied again in response to the Play-certificate question): `DD:40:70:58:47:E1:A1:68:84:5A:35:1A:D1:90:7A:BF:62:B9:7B:0B:F7:6B:54:FF:32:65:15:17:E5:B3:6B:69`.
- Local upload/APK signing SHA-256: `19:0A:C1:50:81:D4:3C:9F:DB:85:2A:CC:29:3B:D2:F4:2D:1F:29:B0:FB:5B:65:7C:84:70:24:C7:06:6A:43:05`.

The relation is `delegate_permission/common.handle_all_urls`, target namespace `android_app`, package `in.fixbeez.customer`. The upload fingerprint supports directly installed local APKs; Play-installed APKs need Play's app-signing certificate. Keep any other active Play signing certificates if the signing key has been upgraded. Never use the AAB file hash as a certificate fingerprint.

## Customer deployment fix

The asset-links source file previously existed only locally and was absent from GitHub. A GitHub-based Hostinger build therefore could not include it. In addition, the old packaging path replaced the Customer output `.htaccess` with the shared file and used Windows `Compress-Archive`, which can omit hidden files.

The Customer build now validates the built asset-links file, excludes `.well-known` from the SPA rewrite and includes explicit JSON MIME/access rules. The new Customer ZIP packager uses .NET ZIP enumeration and verifies the archive contains these entries at its root:

```text
index.html
.htaccess
.well-known/assetlinks.json
.well-known/.htaccess
```

Admin/Technician build configuration and the shared `deploy/pwa.htaccess` were not changed. The existing all-app packager delegates only its Customer branch to the new packager.

Build and package only Customer:

```powershell
cd D:\HA
npm run build -w @home/customer
powershell -File scripts/package-customer-hostinger.ps1
node scripts/verify-customer-twa.mjs
```

### Hostinger static hosting

In hPanel, open the document root for **fixbeez.in** (often `public_html`; confirm the domain's actual root). Extract the Customer ZIP contents directly there. Do not create a nested `dist`, `customer` or `customer-pwa` folder. Enable **Show hidden files** and confirm `.well-known/assetlinks.json`, `.well-known/.htaccess` and the root `.htaccess` exist. Do not replace the built root `.htaccess` with the shared template.

If the correct file exists but the public URL still returns 404/403, inspect inherited hosting rules, protected/hidden-file settings and CDN/WAF behavior for **this exact public path**. Permit access to the asset-links JSON without disabling protections for other dotfiles. Purge the Hostinger/CDN cached 404 for this path, then verify again. A successful file-manager preview does not prove the public HTTPS path works.

### Hostinger GitHub build

Redeploy the Customer app after pulling the fix commit. Use root `apps/customer-pwa`, build `npm run build`, output `dist`, while retaining workspace/shared scripts. Verify that hosting publishes dot-directories as well as normal files. `.htaccess` only affects Apache/LiteSpeed-compatible serving; if a static/CDN layer excludes `.well-known`, add the static path through that platform's configuration or publish the file in the domain's static document root.

No hosting credentials/session were available here; local preparation or a GitHub push alone does not prove production deployment.

## Verify the public endpoint

```powershell
cd D:\HA
node scripts/verify-customer-twa.mjs --live --fingerprint=DD:40:70:58:47:E1:A1:68:84:5A:35:1A:D1:90:7A:BF:62:B9:7B:0B:F7:6B:54:FF:32:65:15:17:E5:B3:6B:69
curl.exe -i https://fixbeez.in/.well-known/assetlinks.json
```

Expected: direct **200**, `Content-Type: application/json` (charset is fine), JSON array with the exact package and Play fingerprint, no login, no redirect, no React shell. The checker intentionally fails while production is still returning an error page. Do not use `curl -L` to hide a redirect during diagnosis.

## Test the actual Play-installed Android app

Install from the closed-testing Play link, connect USB debugging and use an up-to-date Chrome. In PowerShell, add the SDK tools if needed:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
adb devices -l
adb shell pm list packages -i in.fixbeez.customer
adb shell dumpsys package in.fixbeez.customer
```

Confirm package `in.fixbeez.customer` and Play installer `com.android.vending` (some Android versions report installer details differently). For direct proof of its signing certificate:

```powershell
adb shell pm path in.fixbeez.customer
# Copy the actual printed base.apk path, omitting its leading 'package:'.
adb pull "ACTUAL_BASE_APK_PATH_FROM_PREVIOUS_COMMAND" play-installed-base.apk
# Use your installed SDK build-tools apksigner with JAVA_HOME set to a working JDK.
apksigner verify --print-certs play-installed-base.apk
```

Its SHA-256 must match the Play certificate published on the website. The upload-key APK built locally is not a substitute for this check.

On Android 12 or higher, after the public endpoint is fixed:

```powershell
adb shell pm set-app-links --package in.fixbeez.customer 0 all
adb shell pm verify-app-links --re-verify in.fixbeez.customer
# Wait a few minutes for asynchronous network verification, then:
adb shell pm get-app-links in.fixbeez.customer
```

Expect `fixbeez.in: verified`. `none`, `legacy_failure`, or an error code is not a passing result. Do not force-approve domains or disable Chrome's Digital Asset Links verification to claim success.

Launch and test:

```powershell
adb shell am force-stop in.fixbeez.customer
adb shell am start -W -n in.fixbeez.customer/.LauncherActivity
adb shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d https://fixbeez.in/requests
adb logcat -v time | Select-String 'OriginVerifier|DigitalAssetLinks|TWAProviderPicker|chromium|CustomTabs'
```

Android App Links and Chrome TWA trust are related but separate checks. App Links `verified` alone does not prove Chrome opened a toolbar-free TWA. Confirm the visible **Play-installed** app has no hostname/Close/Share/Menu toolbar when viewing `https://fixbeez.in`, and test login return, Back and deep links. If Android verification passes but Chrome still shows a toolbar, inspect Chrome's origin-verification logs, actual navigation origin, default browser/TWA support and cached failures. Relaunch the app after the deployment; allow verification time. Do not clear the user's browser data as a first step.

## Is a new AAB needed?

**No Android rebuild is needed to publish or correct website Digital Asset Links for the existing package/origin/certificate.** Fix production hosting, then reverify and relaunch the existing Play installation. The observed 404 is sufficient to block trust today.

A new AAB is necessary only if inspection of the *actual installed APK* reveals incorrect Android package/launch/origin/asset-statement configuration, or a genuinely new trusted UI origin needs Android configuration. Do not change the app ID, signing key, theme color or display mode to hide a failed verification problem.

Sources: [Chrome TWA verification and Custom Tab fallback](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), [Android App Links verification commands](https://developer.android.com/training/app-links/verify-applinks).
