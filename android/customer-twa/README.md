# FixBeez Customer Android TWA

This directory wraps https://fixbeez.in in a Trusted Web Activity. It does not convert React into native screens. Admin and Technician PWAs are outside its scope.

## Configuration

- Official CLI: `@bubblewrap/cli@1.27.0`.
- Package: `in.fixbeez.customer` (confirmed by the owner; direct Play Console access unavailable).
- Branding: FixBeez, production 512px logo, purple `#512da8` theme, white splash, 300ms fade.
- Version: `1.0.0`, code `1` is provisional. Inspect all Play tracks and App bundle explorer; choose a code higher than every previous upload before submitting an update.
- CLI 1.27.0 sets compile and target SDK to **36** in generated `app/build.gradle`. A JSON `targetSdkVersion` field alone does not enforce this; inspect generated Gradle and the built bundle.
- Existing Android content consisted only of templates. Generated code stays in this directory. The original ignore policy excludes generated Android sources; regenerate them from the local manifest.

```powershell
npm install --global @bubblewrap/cli@1.27.0
cd D:\HA\android\customer-twa
# First setup only, if twa-manifest.json does not already exist:
Copy-Item twa-manifest.template.json twa-manifest.json
# Set signingKey.path to your keystore outside Git. Set appVersionCode/appVersion.
bubblewrap update --skipVersionUpgrade
bubblewrap doctor
```

Use a 64-bit JDK 17 and install SDK `platforms;android-36`, `build-tools;36.1.0`, and `build-tools;35.0.0` if requested by AGP 8.9.1. Machine configuration: `%USERPROFILE%\.bubblewrap\config.json`. Fix `JAVA_HOME` if it references a missing JDK. SDK/Gradle downloads require internet.

## Signing and building

Preserve existing signing files. For an existing Play app, use its registered upload key. If lost, the Play account owner must request an **upload key reset** with the public certificate for a new upload key. Do not reset the app-signing key just to change the upload key.

```powershell
# Only when no original upload key is available. Refuses to overwrite a directory.
.\create-upload-key.ps1 -PrivateDirectory "$env:USERPROFILE\.fixbeez-signing\customer-upload-20261107"
```

This creates RSA 3072 / SHA256withRSA credentials, restricts directory permissions, exports `upload-certificate.pem`, and encrypts the random password using Windows DPAPI in `password.dpapi.xml`. DPAPI can only be decrypted by this Windows account on this machine. Back up the keystore and actual password in a password manager; DPAPI alone is not a portable backup. Never commit credentials or send passwords in chat.

Point local `twa-manifest.json` at the chosen key, alias `fixbeez-upload`, then:

```powershell
.\build-release.ps1 -PasswordFile "$env:USERPROFILE\.fixbeez-signing\customer-upload-20261107\password.dpapi.xml"
```

The script calls Bubblewrap build, provides supported password environment variables, redacts diagnostics, checks the bundle signature, and prints its file hash. Bubblewrap signing subprocesses may briefly receive passwords as process arguments; use a trusted workstation. Source and logs do not retain plaintext passwords.

Successful builds produce `D:\HA\android\customer-twa\app-release-bundle.aab` and `app-release-signed.apk`. These expected paths do not prove a build succeeded: see `RELEASE-REPORT.md` for the actual outcome.

## Digital Asset Links

Select **in.fixbeez.customer** in Play Console, open **App integrity / App signing**, and copy **SHA-256 from the app-signing key certificate**. Do not substitute the upload certificate or AAB file hash. Play signs installed APKs with its app-signing certificate. Include relevant additional certificates if Play has upgraded the app-signing key.

```powershell
node .\prepare-assetlinks.mjs "PLAY_APP_SIGNING_SHA256"
# Optional extra argument: local upload certificate SHA256, for directly installed APKs.
```

Supply real colon-separated 32-byte fingerprints. The script rejects placeholders, preserves unrelated statements, and writes only `apps/customer-pwa/public/.well-known/assetlinks.json`.

Build using `npm run build -w @home/customer` and deploy Customer dist including `.htaccess` and `.well-known`. Verify `https://fixbeez.in/.well-known/assetlinks.json` returns **200**, JSON, `Content-Type: application/json`, no authentication, **no redirects**. Do not publish the placeholder template. The Customer build adds JSON/manifest MIME types without changing shared Admin/Technician deployment settings. The upload fingerprint is optional for local testing and never replaces Play's fingerprint.

## Release checks

1. Use JDK `jarsigner -verify app-release-bundle.aab`. Self-signed certificate trust-chain warnings are normal for upload keys; missing/invalid signatures are not.
2. Use Google's `bundletool validate --bundle=app-release-bundle.aab` and `bundletool dump manifest --bundle=app-release-bundle.aab --module=base`. Confirm package, version and target >=36. Run SDK `apksigner verify --verbose --print-certs app-release-signed.apk`.
3. Attach a USB-debugging Android device or start a configured emulator. Check `adb devices -l`; install with `adb install -r app-release-signed.apk`. Separately install through Play closed testing to verify the Play signing certificate.
4. Run `adb shell pm verify-app-links --re-verify in.fixbeez.customer`, wait, then `adb shell pm get-app-links in.fixbeez.customer`. Open `adb shell am start -W -a android.intent.action.VIEW -d https://fixbeez.in/requests in.fixbeez.customer`. Confirm correct routing and no browser toolbar.
5. Complete Google login with a test account, return to the TWA, restart, check session persistence and logout. Production uses web OAuth on `https://fixbeez.in` and API `https://api.fixbeez.in`. Keep the authorized JavaScript origin and `Cross-Origin-Opener-Policy: same-origin-allow-popups` correct. A rendered Google button/config endpoint does not establish end-to-end OAuth success.
6. Navigate through services, request details and account pages. Test hardware/gesture Back, Android 16 predictive Back, root exit, and relaunch. Desktop browser history tests do not establish Android Back behavior.
7. Visit online to cache the app, enable airplane mode, reopen `/`, `/requests`, `/login`; check offline shell/banner and safe errors for network actions. A first-ever offline launch still requires internet. Never cache private API responses.
8. Inspect adaptive icon cropping (the existing icon has a wordmark), splash, notification permission prompts, external links and Android 16 edge-to-edge layout on a real device.

References: [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md), [Play App Signing](https://developer.android.com/studio/publish/app-signing), [App Link verification](https://developer.android.com/training/app-links/verify-android-applinks).
