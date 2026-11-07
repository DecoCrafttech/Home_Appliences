import fs from "node:fs";

async function main() {
  const root = new URL("../", import.meta.url);
  const expectedPackage = "in.fixbeez.customer";
  const expectedOrigin = "https://fixbeez.in";
  const fingerprintArgument = process.argv.find((argument) =>
    argument.startsWith("--fingerprint="),
  );
  const fingerprint = fingerprintArgument
    ?.slice("--fingerprint=".length)
    .toUpperCase();
  if (fingerprint && !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint)) {
    throw new Error(
      "Supply a real colon-separated SHA-256 certificate fingerprint.",
    );
  }
  function validateStatements(statements) {
    if (!Array.isArray(statements))
      throw new Error("Digital Asset Links must be a JSON array.");
    const entries = statements.filter(
      (entry) =>
        entry.relation?.includes(
          "delegate_permission/common.handle_all_urls",
        ) &&
        entry.target?.namespace === "android_app" &&
        entry.target.package_name === expectedPackage,
    );
    const fingerprints = entries.flatMap(
      (entry) => entry.target.sha256_cert_fingerprints || [],
    );
    if (
      !fingerprints.length ||
      fingerprints.some(
        (value) => !/^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(value),
      )
    ) {
      throw new Error("Missing/invalid Customer certificate fingerprints.");
    }
    if (
      fingerprint &&
      !fingerprints.some((value) => value.toUpperCase() === fingerprint)
    ) {
      throw new Error(
        "The requested certificate is missing from Digital Asset Links.",
      );
    }
    return fingerprints;
  }
  const source = JSON.parse(
    fs.readFileSync(
      new URL("apps/customer-pwa/public/.well-known/assetlinks.json", root),
      "utf8",
    ),
  );
  const fingerprints = validateStatements(source);
  const dist = JSON.parse(
    fs.readFileSync(
      new URL("apps/customer-pwa/dist/.well-known/assetlinks.json", root),
      "utf8",
    ),
  );
  if (JSON.stringify(source) !== JSON.stringify(dist))
    throw new Error("Rebuild Customer PWA: source/dist asset links differ.");
  const htaccess = fs.readFileSync(
    new URL("apps/customer-pwa/dist/.htaccess", root),
    "utf8",
  );
  if (!htaccess.includes("RewriteRule ^\\.well-known(?:/|$) - [L]"))
    throw new Error("Customer build lacks the .well-known rewrite exclusion.");
  const manifestFile = new URL("android/customer-twa/twa-manifest.json", root);
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    if (
      manifest.packageId !== expectedPackage ||
      `https://${manifest.host}` !== expectedOrigin ||
      manifest.startUrl !== "/"
    ) {
      throw new Error(
        "Unexpected Android package/host/start URL; review the installed app before changing it.",
      );
    }
    console.log(
      JSON.stringify({
        package: manifest.packageId,
        launch: expectedOrigin + manifest.startUrl,
        additionalTrustedOrigins: manifest.additionalTrustedOrigins || [],
      }),
    );
  }
  console.log(
    JSON.stringify({ local: "PASS", package: expectedPackage, fingerprints }),
  );
  if (process.argv.includes("--live")) {
    const url = `${expectedOrigin}/.well-known/assetlinks.json`;
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    console.log(
      JSON.stringify({
        url,
        status: response.status,
        contentType,
        location: response.headers.get("location"),
      }),
    );
    if (response.status !== 200)
      throw new Error(
        "Production must return 200 directly, without authentication or redirects. Deploy the Customer archive and check the document root/CDN.",
      );
    if (!/^application\/json(?:\s*;|$)/i.test(contentType))
      throw new Error(
        "Production asset links must be application/json, not the SPA shell or a hosting error page.",
      );
    validateStatements(JSON.parse(body));
    console.log(
      "Live Customer Digital Asset Links: PASS. Confirm the certificate against Play Console and test the Play-installed app on Android.",
    );
  }
}
await main().catch((error) => {
  console.error(`Customer TWA verification failed: ${error.message}`);
  process.exitCode = 1;
});
