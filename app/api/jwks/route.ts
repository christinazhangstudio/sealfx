import { NextResponse } from "next/server";
// import the RSA public key as a PEM string
import { AUTH_PUBLIC_KEY } from "../../../lib/auth-keys";
import * as jose from "jose";

// Go server calls this endpoint to get the JWK JSON
// and reconstructs the RSA public key to verify JWT signatures.
export async function GET() {
    try {
        // parse the PEM into a key object
        const pubKeyObj = await jose.importSPKI(AUTH_PUBLIC_KEY, "RS256");
        // convert the key object into a JWK
        const jwk = await jose.exportJWK(pubKeyObj);

        // add metadata
        jwk.kid = "sealift-key-1";
        jwk.alg = "RS256";
        jwk.use = "sig";

        // return the JWK in standard format
        return NextResponse.json({ keys: [jwk] });
    } catch (err) {
        console.error("Failed to serve JWKS:", err);
        return NextResponse.json({ keys: [] }, { status: 500 });
    }
}
