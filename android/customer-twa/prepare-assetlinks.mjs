import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fingerprints = process.argv.slice(2).map((value) => value.toUpperCase());
if (!fingerprints.length || fingerprints.some((value) => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value))) {
  throw new Error('Usage: node prepare-assetlinks.mjs "PLAY_APP_SIGNING_SHA256" ["LOCAL_UPLOAD_SHA256"]. Use colon-separated certificate fingerprints, not bundle file hashes.');
}
const target = fileURLToPath(new URL("../../apps/customer-pwa/public/.well-known/assetlinks.json", import.meta.url));
const statements = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : [];
if (!Array.isArray(statements)) throw new Error("Existing assetlinks.json must be an array.");
let statement = statements.find((entry) => entry.target?.namespace === "android_app" && entry.target.package_name === "in.fixbeez.customer" && entry.relation?.includes("delegate_permission/common.handle_all_urls"));
if (!statement) {
  statement = { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "in.fixbeez.customer", sha256_cert_fingerprints: [] } };
  statements.push(statement);
}
statement.target.sha256_cert_fingerprints = [...new Set([...(statement.target.sha256_cert_fingerprints || []), ...fingerprints])];
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(statements, null, 2) + "\n");
console.log(`Prepared ${target}. Build and deploy only the Customer PWA; verify the HTTPS URL returns JSON with no redirect.`);
