export type StatusVariant = "success" | "error" | "warning" | "info";

export const statusSurfaceStyles: Record<StatusVariant, string> = {
  success: "status-surface status-success",
  error: "status-surface status-error",
  warning: "status-surface status-warning",
  info: "status-surface status-info",
};

export const statusSubtleSurfaceStyles: Record<StatusVariant, string> = {
  success: "status-surface-subtle status-success",
  error: "status-surface-subtle status-error",
  warning: "status-surface-subtle status-warning",
  info: "status-surface-subtle status-info",
};

export const isUrgentStatus = (variant: StatusVariant) =>
  variant === "error" || variant === "warning";
