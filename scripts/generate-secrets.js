const crypto = require("crypto");

/**
 * Utility to generate a secure AUTH_SECRET for Auth.js that will encode the JWT.
 * Usage: node scripts/generate-secrets.js
 * `npm exec auth secret` or via `openssl with openssl rand -base64 33`
 * are also valid.
 */
function generateSecret() {
    try {
        const secret = crypto.randomBytes(32).toString("hex");

        console.log("\n--- New AUTH_SECRET Generated ---");
        console.log("AUTH_SECRET=" + secret);
        console.log("---------------------------------\n");
        console.log("Add the line above to your .env.local file.");
        console.log("Keep this secret safe - it is used to sign your session cookies.");
    } catch (err) {
        console.error("Error generating secret:", err);
        process.exit(1);
    }
}

generateSecret();
