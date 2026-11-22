import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        success:
          "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        destructive:
          "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
