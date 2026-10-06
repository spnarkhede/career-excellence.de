/** Mobile-first breakpoints shared by Tailwind config across apps. */
export const breakpoints = {
  xs: "375px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

export const colors = {
  background: "hsl(0 0% 100%)",
  foreground: "hsl(222 47% 11%)",
  primary: "hsl(222 89% 55%)",
  primaryForeground: "hsl(0 0% 100%)",
  muted: "hsl(210 20% 96%)",
  mutedForeground: "hsl(215 16% 47%)",
  border: "hsl(214 32% 91%)",
  destructive: "hsl(0 72% 51%)",
} as const;

export const radius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  full: "9999px",
} as const;

export const spacing = {
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
} as const;
