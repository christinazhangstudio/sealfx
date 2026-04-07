"use server";

import { signIn } from "@/auth";

export async function createGuestSession() {
    try {
        const result = await signIn("guest", {
            type: "guest",
            redirect: false,
        });

        if (result?.error) {
            return {
                success: false,
                error: "Failed to create guest session",
            };
        }

        return {
            success: true,
        };
    } catch (error) {
        console.error("Error creating guest session:", error);
        return {
            success: false,
            error: "An error occurred while creating guest session",
        };
    }
}
