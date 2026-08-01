import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description?: ReactNode;
    children?: ReactNode;
    flush?: boolean;
}

export default function PageHeader({ title, description, children, flush = false }: PageHeaderProps) {
    return (
        <header className={flush ? "" : "mb-8"}>
            <div className="flex flex-col gap-2">
                <h1 className="page-title text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm break-words">
                    {title}
                </h1>
                {description && (
                    <div className="text-lg text-text-secondary">
                        {description}
                    </div>
                )}
            </div>
            {children && <div className="mt-4">{children}</div>}
        </header>
    );
}
