# FixBeez Customer Android release report

Date: 7 November 2026 (Asia/Kolkata).

## Release status

**Signed release AAB generated and validated. Play closed-testing readiness remains conditional on the manual requirements below.**

AAB: `D:\HA\android\customer-twa\app-release-bundle.aab` (2,113,930 bytes).

AAB file SHA-256: `c08664273a712b631c449cd16b5c13bb90ed574175e5a6665ea4c642a0284eda`.

Signed APK: `D:\HA\android\customer-twa\app-release-signed.apk`.

Validation results:

- Official `bubblewrap build` successfully generated both signed artifacts; the final `build-release.ps1` run exited successfully.
- JDK `jarsigner -verify`: **jar verified**. Expected self-signed upload-certificate trust-chain/no-timestamp warnings; certificate expires in 2054.
- Google bundletool `validate`: **PASS** for the final AAB.
- Bundletool manifest dump confirms package `in.fixbeez.customer`, target SDK **36**, minimum SDK **24**, version name **1.0.0**, version code **2**.
- SDK `apksigner verify --verbose --print-certs`: **PASS**, v2/v3 signatures, RSA 3072, matching the new upload certificate below.
- Validation output and manifest dump: `D:\HA\deployment-artifacts\android-test` (ignored build artifacts).
- The build exposed and resolved two setup issues: browser-helper 2.7.4 requires minimum API 24; Bubblewrap bundle signing requires the JDK bin directory on PATH. The manifest template and release script now encode those fixes.

## Scope and configuration

- Initial `android` inspection found only the Customer TWA README, ignore file and JSON templates. No generated Android project or signing files existed there. No existing signing file was overwritten or deleted.
- Installed official `@bubblewrap/cli@1.27.0`; generated the project with `bubblewrap update --skipVersionUpgrade` from the corrected local TWA manifest.
- Package: `in.fixbeez.customer`, confirmed by the owner. No Play Console session/API credentials were available, so package ownership and existing release metadata were not independently verified against Play Console.
- App/launcher: FixBeez. Existing production 512px icon, purple theme, white splash and 300ms fade. Adaptive icon cropping needs visual device review because the existing icon contains a wordmark.
- Generated Gradle: compile SDK 36, target SDK 36, minimum SDK 24 (required by androidbrowserhelper 2.7.4); version `1.0.0` / code `2`.
- Installed checksum-verified Temurin 17.0.21+9 x64 and Android SDK platform 36/build tools 36.1.0 and 35.0.0. `bubblewrap doctor` passed.
- Installed Google bundletool 1.18.3, SHA-256 `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`, matching its official release asset digest.
- React remains a PWA hosted on the production website. Admin and Technician source/configuration were not modified.

## Signing material

The owner did not have an existing upload key. A new **candidate upload key** was generated; it has not been confirmed as accepted by Play.

- Keystore: `C:\Users\DELL\.fixbeez-signing\customer-upload-20261107\upload.jks`
- Alias: `fixbeez-upload`
- Public certificate: `C:\Users\DELL\.fixbeez-signing\customer-upload-20261107\upload-certificate.pem`
- Windows DPAPI encrypted password: `C:\Users\DELL\.fixbeez-signing\customer-upload-20261107\password.dpapi.xml`
- RSA 3072, SHA256withRSA, certificate valid until 25 March 2054.
- Upload certificate SHA-256: `19:0A:C1:50:81:D4:3C:9F:DB:85:2A:CC:29:3B:D2:F4:2D:1F:29:B0:FB:5B:65:7C:84:70:24:C7:06:6A:43:05`

Files are outside Git with restricted directory permissions. Passwords were generated locally and not printed or committed. Back up the keystore and actual password securely: DPAPI can only be decrypted by this Windows account on this machine. `build-release.ps1` uses the encrypted password through Bubblewrap's supported environment variables, restores the prior environment and redacts CLI diagnostics.

## PWA and website results

| Check | Result |
|---|---|
| Production HTTPS | Valid HTTPS fetches; HTTP redirects 301 to HTTPS |
| Web manifest | 200, valid JSON, standalone, root start/scope/id, 192/512 icons |
| Production manifest MIME | Currently `text/plain`; corrected in Customer build output `.htaccess`, pending deployment |
| Icons | Live PNGs decoded at 192x192 and 512x512; existing FixBeez art inspected |
| Service worker | Live `sw.js` 200 with JS MIME; browser controlled after installation |
| Chrome installability | No installability errors in a normal persistent Chrome profile |
| Live `/requests` deep link | 200 SPA shell |
| Live offline behavior | `/` works; direct offline `/requests` fails before the local fix |
| Local offline fix | Added Workbox navigation fallback; `/`, `/requests`, `/login` all render offline after caching |
| Private API cache | No API URLs in local precaches |
| Customer production build | TypeScript and Vite/service-worker build passed; existing chunk-size/third-party annotation warnings remain nonfatal |
| Google configuration | `https://api.fixbeez.in/api/v1/auth/customer/config` returns 200 and has a client ID |
| Google login UI | Production login renders Google's sign-in button iframe |
| Google login completion | Requires an interactive test account; not verified |
| Desktop history Back | `/login` back to `/` passed; this does not establish Android Back behavior |
| Production DAL | `https://fixbeez.in/.well-known/assetlinks.json` currently 404 |

Customer-only deployment artifacts are built in `D:\HA\apps\customer-pwa\dist`, including the corrected `.htaccess` and `.well-known/assetlinks.json`. Nothing was deployed to production.

## Digital Asset Links

`apps/customer-pwa/public/.well-known/assetlinks.json` contains the local upload certificate for direct APK testing and the additional fingerprint supplied by the owner on 7 November 2026: `DD:40:70:58:47:E1:A1:68:84:5A:35:1A:D1:90:7A:BF:62:B9:7B:0B:F7:6B:54:FF:32:65:15:17:E5:B3:6B:69`. The supplied statement matches `in.fixbeez.customer`; its provenance as Play's **app-signing** certificate must be confirmed in Play Console. `prepare-assetlinks.mjs` preserves both fingerprints and unrelated statements. Production deployment remains pending.

In Play Console select **in.fixbeez.customer**, open **App integrity / App signing**, and copy SHA-256 under **App signing key certificate**. Add it with:

```powershell
cd D:\HA\android\customer-twa
node prepare-assetlinks.mjs "REAL_COLON_SEPARATED_PLAY_APP_SIGNING_SHA256"
cd D:\HA
npm run build -w @home/customer
```

Deploy only the Customer dist, including hidden `.well-known` and `.htaccess` entries. Verify the exact HTTPS asset-links URL returns 200, `application/json`, valid JSON, no authentication and no redirect. An upload certificate or AAB file hash cannot substitute for the Play app-signing fingerprint. Keep the local upload fingerprint if directly installed APKs should also verify.

## Manual requirements before closed testing

Android emulator results:

- Created a separate `FixBeez_Release_API34` AVD from the installed Android 14 Google APIs x86_64 image, without overwriting an existing AVD. It booted successfully with Chrome installed.
- Installed the actual signed release APK using ADB: **Success**. Android package manager confirms the expected package, version, minimum API 24 and target API 36.
- Explicit launcher intent returned **Status: ok** and opened Chrome's first-run activity. This proves native installation/launch, not successful website rendering.
- The emulator then displayed **System UI isn't responding** during Chrome's first-run screen; UI automation returned a null root. Visual launch, Android Back, completed OAuth and offline Android UI could not be verified reliably. This is an emulator/System UI limitation, not evidence of a FixBeez crash. Physical-device testing remains required.
- App Links inspection returned the correct upload signature and `fixbeez.in: none` (unverified), consistent with the live DAL 404.
- Automatic approval review rejected the subsequent combined ADB deep-link launch/reverification/ANR diagnostic command as **blocked by policy**. That command was not executed; deep-link behavior remains manual.
- Screenshot: `D:\HA\deployment-artifacts\android-test\launch.png`. The emulator was stopped after testing to release memory.

1. Open the existing Play app and verify package `in.fixbeez.customer`, Play App Signing status, registered upload certificate and highest version code across all tracks/uploads.
2. If an upload certificate is already registered and the original key cannot be recovered, have the Play account owner request an **upload key reset** using the new public `upload-certificate.pem`. Wait for approval/effective time before uploading a bundle signed with this key. A newly created key does not automatically match an existing Play app.
3. If code 1 has already been used, set a higher `appVersionCode` and appropriate `appVersion` in local `twa-manifest.json`, regenerate with `bubblewrap update --skipVersionUpgrade`, then rebuild with `build-release.ps1`.
4. Confirm the owner-supplied SHA-256 is from Play's app-signing certificate (not its upload certificate), then deploy the prepared Customer PWA fixes/DAL. Recheck the live URLs and offline navigation.
5. Complete real Google sign-in/logout/session tests, verified Android deep links, hardware/gesture Back, Android 16 predictive Back, splash/adaptive icon and edge-to-edge review. Install from the Play closed track to verify the actual Play signing certificate. A local upload-key APK alone cannot establish this.

Detailed commands are in [README.md](README.md). Official references: [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md), [Play signing and upload-key resets](https://developer.android.com/studio/publish/app-signing), [App Link verification](https://developer.android.com/training/app-links/verify-android-applinks).

## Version code 2 rebuild

Play rejected version code 1 as already used. Rebuilt with version code **2**, version name **1.0.0**, the same package/upload key and target API 36. Bubblewrap build and JAR signature verification passed; bundletool validation and the built manifest confirm version code 2. Both deployment copies now contain this release, including `D:\HA\deployment-artifacts\fixbeez-customer-v2.aab`. This supersedes the code-1 bundle metadata and emulator test above; code 2 has not been uploaded to Play or retested on Android in this turn.
