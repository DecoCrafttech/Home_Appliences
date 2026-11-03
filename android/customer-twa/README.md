# Customer Play Store package (Trusted Web Activity)

This directory is the reproducible Bubblewrap configuration for packaging the customer PWA. A live HTTPS origin is required before initialization because Android verifies the relationship between the app and website.

## Prerequisites

- Deploy the customer PWA and API to HTTPS.
- Install a current JDK, Android SDK and Node.js.
- Install Bubblewrap: `npm install --global @bubblewrap/cli`
- Replace every `YOUR_CUSTOMER_DOMAIN` and signing placeholder in `twa-manifest.template.json`.

## Build

1. Copy `twa-manifest.template.json` to `twa-manifest.json` and fill in the production host.
2. Run `bubblewrap update --manifest twa-manifest.json` in this directory. On the first setup, `bubblewrap init --manifest https://YOUR_CUSTOMER_DOMAIN/manifest.webmanifest` can generate the Android project.
3. Create or select a Play App Signing upload key. Keep the keystore and passwords outside Git.
4. Run `bubblewrap build` to produce an Android App Bundle.
5. Get the SHA-256 fingerprint of the Play App Signing certificate from Play Console, fill in `assetlinks.template.json`, and deploy it at `https://YOUR_CUSTOMER_DOMAIN/.well-known/assetlinks.json` with JSON content type and no redirect.
6. Run `bubblewrap validate` and test the release bundle on a physical Android device before upload.

The stable application ID is `com.homeservices.customer`. Changing it after Play Store publication creates a different app. The generated Android project should use the current Play-required target SDK and enable notification delegation. Android 13 or later still asks the user for notification permission; the PWA only requests permission after the user taps **Turn on**.

Do not commit `twa-manifest.json`, signing keys, passwords, Play service-account files, or generated release bundles.
