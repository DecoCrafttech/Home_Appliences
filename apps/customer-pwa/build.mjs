import { buildPwa } from "../../scripts/build-pwa.mjs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import process from "node:process";

buildPwa(import.meta.url);
if (!process.argv.includes("--typecheck")) {
  const assetLinks = new URL(
    "./dist/.well-known/assetlinks.json",
    import.meta.url,
  );
  const statements = JSON.parse(readFileSync(assetLinks, "utf8"));
  const customer = statements.find(
    (statement) =>
      statement.relation?.includes(
        "delegate_permission/common.handle_all_urls",
      ) &&
      statement.target?.namespace === "android_app" &&
      statement.target.package_name === "in.fixbeez.customer",
  );
  if (
    !customer?.target.sha256_cert_fingerprints?.length ||
    customer.target.sha256_cert_fingerprints.some(
      (value) => !/^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(value),
    ) ||
    !existsSync(new URL("./dist/.well-known/.htaccess", import.meta.url))
  ) {
    throw new Error(
      "Customer Digital Asset Links or its hosting configuration is missing/invalid.",
    );
  }
  const htaccess = new URL("./dist/.htaccess", import.meta.url);
  const sharedRules = readFileSync(htaccess, "utf8");
  if (!sharedRules.includes("  # Missing API/assets")) {
    throw new Error(
      "Customer hosting rules changed; review the Digital Asset Links rewrite exclusion.",
    );
  }
  writeFileSync(
    htaccess,
    sharedRules.replace(
      "  # Missing API/assets",
      `  # Digital Asset Links must be a real static file, never the React app shell.
  RewriteRule ^\\.well-known(?:/|$) - [L]
  # Missing API/assets`,
    ) +
      `
# Customer PWA installability and Digital Asset Links MIME types.
<IfModule mod_mime.c>
  AddType application/manifest+json .webmanifest
  AddType application/json .json
</IfModule>
`,
  );
}
