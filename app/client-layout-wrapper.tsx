"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import NavMenu from "./navmenu";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export default function ClientLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isLoginPage = pathname?.startsWith("/login");

    return (
        <>
            <div className="relative z-20">
                <div className="border-b py-4 border-border/50 backdrop-blur-md bg-white/5">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-lg p-2 gap-4">
                            {/* Left column: Logo */}
                            <div className="flex items-center space-x-2 sm:space-x-4 justify-start">
                                <Image
                                    src="/seal.png"
                                    alt="Sealift Logo"
                                    width={64}
                                    height={64}
                                    priority
                                    className="h-10 w-auto sm:h-16 object-contain"
                                />
                                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-primary-hover drop-shadow-sm whitespace-nowrap font-heading">
                                    sealift
                                </h1>
                            </div>

                            {/* Center/Right column: Tagline - centered on login, right-aligned otherwise */}
                            <p className={`text-base sm:text-xl md:text-2xl text-primary hidden sm:block drop-shadow-sm font-heading whitespace-nowrap ${isLoginPage ? 'text-center' : 'col-span-2 text-right'}`}>
                                See all of your marketplace!
                            </p>

                            {/* Right column: Theme Switcher (only on login page) */}
                            {isLoginPage && (
                                <div className="flex items-center justify-end">
                                    <ThemeSwitcher />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {!isLoginPage && <NavMenu />}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-0">
                {children}
            </main>
        </>
    );
}
