import * as jose from "jose";
import { AUTH_PRIVATE_KEY } from "@/lib/auth-keys";

export async function POST() {
    try {
        const guestId = `guest_${crypto.randomUUID()}`;
        const privateKeyObj = await jose.importPKCS8(AUTH_PRIVATE_KEY, "RS256");
        const jti = crypto.randomUUID();

        // Create guest JWT with 2-hour expiration
        const token = await new jose.SignJWT({
            id: guestId,
            name: "Guest",
            email: "guest@localhost",
            isGuest: true,
            jti,
        })
            .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "sealift-key-1" })
            .setIssuedAt()
            .setExpirationTime(Math.floor(Date.now() / 1000) + (2 * 60 * 60)) // 2 hours
            .sign(privateKeyObj);

        return Response.json({
            token,
            user: {
                id: guestId,
                name: "Guest",
                email: "guest@localhost",
                isGuest: true,
            },
        });
    } catch (error) {
        console.error("Failed to create guest session:", error);
        return Response.json(
            { error: "Failed to create guest session" },
            { status: 500 }
        );
    }
}
