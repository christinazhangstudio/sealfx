import StatusIcon from "./StatusIcon";
import {
  isUrgentStatus,
  statusSurfaceStyles,
  type StatusVariant,
} from "./statusStyles";

export type StatusToastVariant = StatusVariant;

interface StatusToastProps {
  message: string;
  placement?: "top-center" | "bottom-right";
  variant: StatusToastVariant;
}

const placementStyles = {
  "top-center": "left-1/2 top-20 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2",
  "bottom-right": "bottom-24 left-4 right-4 sm:bottom-8 sm:left-auto sm:right-8 sm:w-[calc(100vw-4rem)] sm:max-w-md",
} as const;

export default function StatusToast({
  message,
  placement = "top-center",
  variant,
}: StatusToastProps) {
  return (
    <div
      aria-atomic="true"
      aria-live={isUrgentStatus(variant) ? "assertive" : "polite"}
      className={`fixed z-[var(--z-toast)] rounded-xl border px-5 py-3 shadow-xl transition-all duration-500 ${placementStyles[placement]} ${statusSurfaceStyles[variant]}`}
      role={isUrgentStatus(variant) ? "alert" : "status"}
    >
      <div className="flex items-center gap-3">
        <StatusIcon variant={variant} />
        <span className="min-w-0 break-words font-medium">{message}</span>
      </div>
    </div>
  );
}
