import { ImageResponse } from "next/og";

// Checklist task 3: a 512x512 icon for the web manifest. See icon-192/route.ts.
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
        fontSize: 260,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      A
    </div>,
    { width: 512, height: 512 },
  );
}
