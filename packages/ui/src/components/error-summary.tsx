import * as React from "react";

export interface ErrorSummaryItem {
  /** The id of the field this error belongs to — used to build a jump link
   * (`href={`#${id}`}`) and for the caller to focus that field. */
  id: string;
  message: string;
}

/**
 * Phase 11 checklist: "errors in an aria-live region, focus moved to an
 * error summary." Rendered once per form, right above the fields, and
 * focused programmatically (via the forwarded ref) immediately after a
 * failed submit — screen reader users get a single, deterministic
 * announcement of everything wrong, rather than hunting field by field.
 * `aria-live="assertive"` + `role="alert"` together mean this is announced
 * even though it is already in the DOM before the error appears (a plain
 * `aria-live` region needs the content to actually change to announce,
 * which it does here: `items` goes from empty to non-empty).
 */
export const ErrorSummary = React.forwardRef<HTMLDivElement, { items: ErrorSummaryItem[] }>(
  ({ items }, ref) => {
    if (items.length === 0) return null;
    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
        className="border-destructive/50 bg-destructive/10 rounded-md border p-3 text-sm"
      >
        <p className="text-destructive font-medium">
          {items.length === 1
            ? "There is 1 problem with this form:"
            : `There are ${items.length} problems with this form:`}
        </p>
        <ul className="text-destructive mt-1 list-inside list-disc">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="underline">
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
ErrorSummary.displayName = "ErrorSummary";
