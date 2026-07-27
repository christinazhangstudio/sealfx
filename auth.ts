import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                try {
                    // Emails are case-insensitive; normalize so "Foo@x.com" signs
                    // in to the same account as "foo@x.com".
                    const email = (credentials.username as string).trim().toLowerCase();
                    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:443/api";

                    // The backend verifies the password; the hash never leaves it.
                    const res = await fetch(`${apiUrl}/internal/verify-credentials`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, password: credentials.password }),
                    });

                    if (!res.ok) {
                        console.log("Auth failure: invalid credentials.");
                        return null;
                    }

                    const userRecord = await res.json();
                    return {
                        id: userRecord.id,
                        name: "Sealift User",
                        email: userRecord.email,
                        rememberDevice: credentials.rememberMe === "true"
                    };
                } catch (err) {
                    console.error("Credential verification error:", err);
                }

                return null;
            },
        }),
        Credentials({
            id: "guest",
            async authorize(credentials) {
                // Guest provider - creates a guest session without credentials
                if (credentials?.type !== "guest") return null;

                return {
                    id: `guest_${crypto.randomUUID()}`,
                    name: "Guest",
                    email: "guest@localhost",
                    isGuest: true,
                };
            },
        }),
    ],


});
