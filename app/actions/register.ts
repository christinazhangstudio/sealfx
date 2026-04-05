"use server";

import argon2 from "argon2";

export async function registerUser(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const appId = formData.get("appId") as string;
    const devId = formData.get("devId") as string;
    const certId = formData.get("certId") as string;
    const redirectUri = formData.get("redirectUri") as string;
    const isSandbox = formData.get("isSandbox") === "on";

    if (!email || !password || !appId || !devId || !certId || !redirectUri) {
        return { error: "All fields are required." };
    }

    try {
        // 1. Hash the password securely with Argon2
        const rawHash = await argon2.hash(password);

        // 2. Base64 encode the hash to ensure transport safety
        const passwordHash = Buffer.from(rawHash).toString("base64");

        const payload = {
            email,
            passwordHash,
            ebayDeveloperConfig: {
                appId,
                devId,
                certId,
                redirectUri,
                isSandbox
            }
        };

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:443/api";
        const res = await fetch(`${apiUrl}/register-user`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            if (res.status === 409) {
                return { error: "An account with this email already exists." };
            }
            return { error: "Registration failed on the backend server." };
        }

        return { success: true };
    } catch (e) {
        console.error("Registration error:", e);
        return { error: "An unexpected error occurred during registration." };
    }
}
