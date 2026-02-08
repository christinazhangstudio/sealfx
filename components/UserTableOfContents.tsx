import React, { useState, useEffect } from "react";

interface UserTableOfContentsProps {
    users: string[];
}

export default function UserTableOfContents({ users }: UserTableOfContentsProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (users.length === 0) return null;

    const scrollToUser = (user: string) => {
        const element = document.getElementById(`user-section-${user}`);
        if (element) {
            // Use different offsets for mobile vs desktop
            const isMobile = window.innerWidth < 1024; // lg breakpoint
            const offset = isMobile ? 240 : 100; // More offset for mobile due to taller header

            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth",
            });
            setIsOpen(false); // Close mobile menu if open
        }
    };

    // Close on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0 sticky top-28 self-start">
                <div className="space-y-2 p-4 bg-surface rounded-xl border border-border shadow-sm max-h-[calc(100vh-theme(spacing.36))] overflow-y-auto">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider font-heading">
                        Users
                    </h3>
                    <nav className="flex flex-col space-y-0 relative">
                        {users.map((user) => (
                            <button
                                key={user}
                                onClick={() => scrollToUser(user)}
                                className="text-left px-3 py-1 text-sm rounded-lg text-text-secondary hover:bg-background-start hover:text-primary transition-all duration-200 truncate font-medium group flex items-center"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                {user}
                            </button>
                        ))}
                    </nav>
                </div>
            </aside>

            {/* Mobile Floating Button & Drawer */}
            <div className="lg:hidden">
                {/* Floating Action Button (FAB) */}
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-40 bg-primary text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center group"
                    aria-label="Toggle users menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-medium">Users</span>
                </button>

                {/* Backdrop Overlay */}
                {isOpen && (
                    <div
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => setIsOpen(false)}
                    />
                )}

                {/* Mobile Drawer */}
                <div className={`fixed right-0 top-0 h-full w-72 bg-surface shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold text-primary uppercase tracking-wider font-heading">
                                Jump to User
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 text-text-secondary hover:text-primary transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <nav className="flex-1 overflow-y-auto flex flex-col space-y-2 pr-2">
                            {users.map((user) => (
                                <button
                                    key={user}
                                    onClick={() => scrollToUser(user)}
                                    className="text-left w-full px-4 py-3 text-base rounded-xl text-text-secondary bg-background-start/30 hover:bg-background-start hover:text-primary transition-all duration-200 truncate font-medium border border-transparent hover:border-border"
                                >
                                    {user}
                                </button>
                            ))}
                        </nav>
                        <div className="mt-8 pt-8 border-t border-border shrink-0">
                            <p className="text-xs text-text-secondary opacity-70 italic text-center">
                                Select a user to scroll to their section
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
