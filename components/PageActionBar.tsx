import type { ReactNode } from "react";

interface PageActionBarProps {
  children: ReactNode;
  ariaLabel?: string;
  comfortable?: boolean;
}

export default function PageActionBar({ children, ariaLabel = "Page actions", comfortable = false }: PageActionBarProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={`mb-6 rounded-2xl border border-border/50 bg-surface/70 shadow-sm backdrop-blur-sm ${
        comfortable ? "space-y-4 p-4 sm:p-5" : "space-y-3 p-3 sm:p-4"
      }`}
    >
      {children}
    </section>
  );
}

interface RefreshActionProps {
  updated: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function RefreshAction({ updated, refreshing, onRefresh }: RefreshActionProps) {
  if (!updated) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 whitespace-nowrap text-xs text-text-secondary sm:justify-start">
      <span className="whitespace-nowrap">Updated {updated}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="shrink-0 rounded-full border border-border/60 bg-surface px-3 py-1.5 font-semibold text-text-primary transition-colors hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
