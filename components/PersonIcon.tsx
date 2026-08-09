export default function PersonIcon({
  className = "text-[20px] leading-none",
  strokeClassName = "text-primary",
}: {
  className?: string;
  strokeClassName?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined inline-flex items-center justify-center ${className} ${strokeClassName}`}
      aria-hidden="true"
    >
      person
    </span>
  );
}
