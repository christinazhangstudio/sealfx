import BackToSealift from "@/components/BackToSealift";

/**
 * Shared shell for the Terms and Privacy pages. These are reachable without a
 * session (see middleware.ts), so they can't rely on the app nav.
 */
export default function LegalLayout({
    title,
    updated,
    children,
}: {
    title: string;
    updated?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen px-6 py-12">
            <div className="max-w-3xl mx-auto">
                <BackToSealift />

                <h1 className="page-title mt-6 text-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
                    {title}
                </h1>
                {updated && (
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        Last updated {updated}
                    </p>
                )}

                <div className="mt-10 space-y-8 text-[var(--color-text-primary)] leading-relaxed">
                    {children}
                </div>

            </div>
        </div>
    );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{heading}</h2>
            <div className="space-y-3 text-[var(--color-text-secondary)]">{children}</div>
        </section>
    );
}
