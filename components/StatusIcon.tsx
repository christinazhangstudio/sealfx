import type { ReactNode } from "react";
import type { StatusVariant } from "./statusStyles";

interface StatusIconProps {
  className?: string;
  variant: StatusVariant;
}

const paths: Record<StatusVariant, ReactNode> = {
  success: <path d="M5 13l4 4L19 7" />,
  error: <path d="M6 18L18 6M6 6l12 12" />,
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
};

export default function StatusIcon({
  className = "",
  variant,
}: StatusIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`h-6 w-6 shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {paths[variant]}
    </svg>
  );
}
