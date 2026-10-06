import Link from "next/link";
import { Button } from "@saas/ui";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">App Platform</h1>
      <p className="text-muted-foreground max-w-xl">
        A secure, product-neutral SaaS starter. Authentication, authorization, and infrastructure
        are already built — start implementing product features.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/signup">Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </main>
  );
}
