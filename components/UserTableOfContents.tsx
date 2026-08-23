
interface UserTableOfContentsProps {
    users: string[];
}

export default function UserTableOfContents({ users }: UserTableOfContentsProps) {
    if (users.length === 0) return null;

    const scrollToUser = (user: string) => {
        const element = document.getElementById(`user-section-${user}`);
        if (!element) return;

        const offset = window.innerWidth < 1024 ? 88 : 100;
        const offsetPosition = element.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
        });
    };

    return (
        <nav aria-label="Jump to seller" className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-2">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Sellers
                </span>
                {users.map((user) => (
                    <button
                        key={user}
                        type="button"
                        onClick={() => scrollToUser(user)}
                        aria-label={`Jump to ${user}`}
                        className="inline-flex max-w-64 items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        <span className="truncate">{user}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}
