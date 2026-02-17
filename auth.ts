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

                const adminUsername = "sealift";
                let passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, "");

                if (credentials.username !== adminUsername || !passwordHash) {
                    console.log("Auth failure: Invalid username or empty hash.");
                    return null;
                }

                // If the hash is Base64 encoded (common fix for .env $ interpolation), decode it
                if (!passwordHash.startsWith("$")) {
                    try {
                        passwordHash = Buffer.from(passwordHash, "base64").toString("utf-8");
                    } catch (e) {
                        console.error("Failed to decode Base64 hash:", e);
                    }
                }

                try {
                    const isValid = await argon2.verify(passwordHash, credentials.password as string);

                    if (isValid) {
                        return {
                            id: "1",
                            name: "Sealift Admin",
                            email: "admin@sealift.fx",
                            rememberDevice: credentials.rememberMe === "true"
                        };
                    }

                    console.log("Auth failure: Password verification failed.");
                } catch (err) {
                    console.error("Argon2 verification error:", err);
                    console.log("Hash starts with $?:", passwordHash.startsWith("$"));
                }

                return null;
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // Default 30 days
    },
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                token.rememberDevice = (user as any).rememberDevice;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                (session as any).rememberDevice = token.rememberDevice;

                // If not remembering device, set a shorter expiration in the cookie
                // Note: NextAuth manages the cookie expiration based on session.maxAge
                // For dynamic control, we rely on the client-side session maxAge if supported
                // or handle it via session callbacks if using custom session management.
            }
            return session;
        },
    },
});
