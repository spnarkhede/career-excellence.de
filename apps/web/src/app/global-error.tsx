"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. Our team has been notified.
          </p>
          <div className="flex gap-4">
            <button onClick={() => reset()} className="underline">
              Try again
            </button>
            <a href="/" className="underline">
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
