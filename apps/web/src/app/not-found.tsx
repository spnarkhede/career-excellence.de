/**
 * Phase 14 task 7: "a custom 404 page with a link home and a search or
 * main navigation, returning a real 404 status." Next.js's App Router
 * `not-found.tsx` convention already returns a genuine HTTP 404 for any
 * unmatched route — rendering this file IS what sets that status, not
 * something this component needs to do itself.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <nav aria-label="Suggested links" className="flex gap-4 text-sm">
        <a href="/" className="underline">
          Go home
        </a>
        <a href="/dashboard" className="underline">
          Dashboard
        </a>
        <a href="/contact" className="underline">
          Contact us
        </a>
      </nav>
    </main>
  );
}
