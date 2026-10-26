const required = ["SESSION_SECRET", "INITIAL_ADMIN_PASSWORD"];
const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (missing.length) {
  console.error(`Missing required production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}
if (String(process.env.SESSION_SECRET).length < 32) {
  console.error("SESSION_SECRET must be at least 32 characters.");
  process.exit(1);
}
if (String(process.env.INITIAL_ADMIN_PASSWORD).length < 12) {
  console.error("INITIAL_ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}
console.log("Production environment check passed.");
