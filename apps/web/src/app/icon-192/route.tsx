import { ImageResponse } from "next/og";

// Checklist task 3: a 192x192 icon for the web manifest. A plain route
// handler (not Next's reserved `icon.tsx` convention) so its URL is stable
// and referenceable from manifest.ts's `icons` array.
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontSize: 100,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      A
    </div>,
    { width: 192, height: 192 },
  );
}
