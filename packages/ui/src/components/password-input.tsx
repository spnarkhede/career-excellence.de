import * as React from "react";
import { Input } from "./form";

/**
 * Phase 11 checklist "Password visibility toggle": toggles the native input's
 * `type` between "password"/"text" on the SAME DOM node (never remounts the
 * input), so the browser preserves the current value and cursor position
 * across the toggle — no manual value/selection bookkeeping needed. The
 * toggle button is `type="button"` (never submits the form) and exposes its
 * state via `aria-pressed`, with a label that changes with it so a screen
 * reader announces "show password, button" / "hide password, button,
 * pressed" rather than a static, now-stale label.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative flex items-center">
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        className={`pr-10 ${className ?? ""}`}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute right-2 text-xs font-medium"
        tabIndex={0}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
