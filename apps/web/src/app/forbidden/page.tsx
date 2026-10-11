import type { Metadata } from "next";
import { buildPageMetadata } from "../../lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Access Denied — You Do Not Have Permission to View This",
  description:
    "You don't have permission to access this page. If you believe this is a mistake, contact support or return to your dashboard.",
  path: "/forbidden",
  noindex: true,
});

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-muted-foreground">You do not have permission to access this page.</p>
      <a href="/dashboard" className="underline">
        Back to dashboard
      </a>
    </main>
  );
}
