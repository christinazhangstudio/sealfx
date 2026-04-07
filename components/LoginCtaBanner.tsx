"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

interface LoginCtaBannerProps {
    title: string;
    description: string;
    cta?: string;
}

export default function LoginCtaBanner({
    title,
    description,
    cta = "Sign In to Unlock",
}: LoginCtaBannerProps) {
    const { data: session } = useSession();

    // Only show for guest users
    if (!session?.user || !(session.user as any).isGuest) {
        return null;
    }

    return (
        <div className="mb-6 p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-primary mb-1">
                        {title}
                    </h3>
                    <p className="text-sm text-text-secondary">
                        {description}
                    </p>
                </div>
                <Link
                    href="/login"
                    className="flex-shrink-0 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap text-sm"
                >
                    {cta}
                </Link>
            </div>
        </div>
    );
}
