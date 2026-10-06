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
      },
      borderRadius: radius,
    },
  },
  plugins: [],
};
