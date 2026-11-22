import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  "aria-label"?: string;
}

export function Progress({ value, className, ...props }: ProgressProps) {
  const percentage = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
