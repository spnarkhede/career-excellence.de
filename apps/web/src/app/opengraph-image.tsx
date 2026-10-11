import { ImageResponse } from "next/og";

// Checklist task 2: a 1200x630 social preview image. Placed at the app
// root so Next's file-convention metadata resolution auto-fills
// `openGraph.images`/`twitter.images` (with an absolute URL, via
// `metadataBase`) for every page under it that doesn't define its own —
// see apps/web/src/lib/seo.ts's doc comment.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700 }}>App Platform</div>
      <div style={{ fontSize: 28, color: "#94a3b8", marginTop: 16 }}>
        A secure, product-neutral SaaS starter platform.
      </div>
    </div>,
    { ...size },
  );
}
