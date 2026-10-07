import * as React from "react";
import { cn } from "../lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      // text-base (16px), not text-sm (14px): checklist "inputs at least 16px
      // font" — iOS Safari auto-zooms the viewport on focus for any input
      // under 16px, which breaks the 360px-viewport-with-keyboard-open layout.
      "border-border bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label className={cn("text-sm font-medium leading-none", className)} ref={ref} {...props} />
));
Label.displayName = "Label";

export const FormError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <p role="alert" aria-live="polite" className="text-destructive text-sm">
      {message}
    </p>
  );
};
