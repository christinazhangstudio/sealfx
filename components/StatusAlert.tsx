import type { ReactNode } from "react";
import StatusIcon from "./StatusIcon";
import {
  isUrgentStatus,
  statusSubtleSurfaceStyles,
  statusSurfaceStyles,
  type StatusVariant,
} from "./statusStyles";

interface StatusAlertProps {
  className?: string;
  density?: "compact" | "default" | "spacious";
  emphasis?: "solid" | "subtle";
  message: ReactNode;
  messageClassName?: string;
  title?: ReactNode;
  titleClassName?: string;
  variant: StatusVariant;
}

const densityStyles = {
  compact: "p-3",
  default: "p-4",
  spacious: "p-6",
} as const;

export default function StatusAlert({
  className = "",
  density = "default",
  emphasis = "solid",
  message,
  messageClassName = "",
  title,
  titleClassName = "",
  variant,
}: StatusAlertProps) {
  const surfaceStyles = emphasis === "subtle"
    ? statusSubtleSurfaceStyles
    : statusSurfaceStyles;

  return (
    <div
      aria-atomic="true"
      aria-live={isUrgentStatus(variant) ? "assertive" : "polite"}
      className={`rounded-xl border ${densityStyles[density]} ${surfaceStyles[variant]} ${className}`}
      role={isUrgentStatus(variant) ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        <StatusIcon className="mt-0.5" variant={variant} />
        <div className="min-w-0 flex-1">
          {title && <p className={`font-bold ${titleClassName}`}>{title}</p>}
          <div className={messageClassName}>{message}</div>
        </div>
      </div>
    </div>
  );
}
