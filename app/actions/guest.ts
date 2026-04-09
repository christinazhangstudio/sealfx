"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function createGuestSession() {
    try {
        await signIn("guest", {
            type: "guest",
            redirect: false,
        });

        return {
            success: true,
        };
    } catch (error) {
        if (error instanceof AuthError) {
            return {
                success: false,
                error: "Failed to create guest session",
            };
        }
        console.error("Error creating guest session:", error);
        return {
            success: false,
            error: "An unexpected error occurred",
        };
    }
}
