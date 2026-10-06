import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { MeResponse } from "@saas/contracts";
import { can } from "@saas/authorization";

/**
 * Administration entry point. Normal user authorization does not grant access here —
 * the administrator/super_administrator permission set is checked independently.
 */
export default async function AdminHomePage() {
  const cookieStore = await cookies();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });

  if (response.status === 401) {
    redirect("/login");
  }

  const { principal } = (await response.json()) as MeResponse;

  if (!can(principal, "users.read")) {
    redirect("/forbidden");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <p className="text-muted-foreground">Signed in as {principal.user.email}</p>
    </main>
  );
}
