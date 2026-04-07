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
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:443/api";
                    const res = await fetch(`${apiUrl}/internal/get-user?email=${encodeURIComponent(credentials.username as string)}`);

                    if (!res.ok) {
                        console.log("Auth failure: User not found.");
                        return null;
                    }

                    const userRecord = await res.json();
                    let storedHash = userRecord.passwordHash;

                    // Support legacy base64-encoded hashes from previous storage configuration
                    if (storedHash && !storedHash.startsWith("$argon2")) {
                        try {
                            storedHash = Buffer.from(storedHash, "base64").toString("utf-8");
                        } catch (e) {
                            console.error("Failed to decode legacy password hash", e);
                        }
                    }

                    const isValid = await argon2.verify(storedHash, credentials.password as string);

                    if (isValid) {
                        return {
                            id: userRecord.id,
                            name: "Sealift User",
                            email: userRecord.email,
                            rememberDevice: credentials.rememberMe === "true"
                        };
                    }

                    console.log("Auth failure: Password verification failed.");
                } catch (err) {
                    console.error("Argon2 / DB verification error:", err);
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
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user, trigger }) {
            if (user) {
                token.rememberDevice = (user as any).rememberDevice;
                token.isGuest = (user as any).isGuest || false;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                (session as any).rememberDevice = token.rememberDevice;
                (session.user as any).isGuest = token.isGuest || false;

                // If not remembering device, set a shorter expiration in the cookie
                // Note: NextAuth manages the cookie expiration based on session.maxAge
                // For dynamic control, we rely on the client-side session maxAge if supported
                // or handle it via session callbacks if using custom session management.
            }
            return session;
        },
    },
});
