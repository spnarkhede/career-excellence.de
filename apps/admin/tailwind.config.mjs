import { breakpoints, colors, radius } from "@saas/design-tokens";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    screens: breakpoints,
    extend: {
      colors: {
        background: colors.background,
        foreground: colors.foreground,
        primary: { DEFAULT: colors.primary, foreground: colors.primaryForeground },
        muted: { DEFAULT: colors.muted, foreground: colors.mutedForeground },
        border: colors.border,
        destructive: colors.destructive,
        // Phase 16 BUG-028: was missing entirely — `ring-ring` compiled to
        // nothing, leaving every button/input with no visible focus state.
        ring: colors.ring,
      },
      borderRadius: radius,
    },
  },
  plugins: [],
};
