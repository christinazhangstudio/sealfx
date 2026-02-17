const argon2 = require("argon2");

/**
 * Utility to generate an Argon2 hash for a new admin password.
 * This version outputs a Base64 encoded hash to avoid interpolation issues in .env files.
 * Usage: node scripts/hash-password.js <your_password>
 */
async function generateHash() {
    const password = process.argv[2];

    if (!password) {
        console.error("Error: Please provide a password as an argument.");
        console.log("Usage: node scripts/hash-password.js your_new_password");
        process.exit(1);
    }

    try {
        const hash = await argon2.hash(password);
        const base64Hash = Buffer.from(hash).toString("base64");

        console.log("\n--- New Admin Password Hash (Base64) ---");
        console.log("ADMIN_PASSWORD_HASH=" + base64Hash);
        console.log("----------------------------------------\n");
        console.log("Add the line above to your .env.local file.");
        console.log("Note: We are using Base64 to prevent the '$' characters from breaking in your .env file.");
    } catch (err) {
        console.error("Error hashing password:", err);
        process.exit(1);
    }
}

generateHash();
