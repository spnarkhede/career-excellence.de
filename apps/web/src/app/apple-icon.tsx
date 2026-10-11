import { ImageResponse } from "next/og";

// Checklist task 3: apple touch icon, 180x180. Next's file-convention
// metadata resolution auto-injects the matching
// <link rel="apple-touch-icon" sizes="180x180"> tag.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        fontSize: 92,
        fontWeight: 700,
        fontFamily: "sans-serif",
      }}
    >
      A
    </div>,
    { ...size },
  );
}
