import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MeResponse } from "@saas/contracts";

/** Fetches the authenticated principal directly from the API using the forwarded session cookie. */
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login?reason=session_expired");
  }

  const { principal } = (await response.json()) as MeResponse;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Welcome, {principal.user.email}</h1>
      <p className="text-muted-foreground">Roles: {principal.roles.join(", ") || "none"}</p>
    </main>
  );
}
