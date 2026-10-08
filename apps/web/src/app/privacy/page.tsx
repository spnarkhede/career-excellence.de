import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

const LAST_UPDATED = "2026-10-07";

/**
 * Phase 14 task 1. Every section below answers one of the task's required
 * points; placeholder values (`[Company name]`, `privacy@example.com`,
 * etc.) must be replaced with the operator's real, verified details before
 * this page is relied on — see the draft notice.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div
        role="alert"
        className="border-destructive/50 bg-destructive/10 mb-8 rounded-md border p-4 text-sm"
      >
        <strong>Draft — requires legal review.</strong> This page is a placeholder template, not a
        reviewed or approved privacy policy. Do not rely on it in production until qualified legal
        counsel has reviewed and approved the final text for the applicable jurisdiction(s).
      </div>

      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8 text-sm">Last updated: {LAST_UPDATED}</p>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Who we are (data controller)</h2>
        <p>
          [Company legal name], [registered address]. Contact our privacy team at{" "}
          <a href="mailto:privacy@example.com" className="underline">
            privacy@example.com
          </a>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">What we collect</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>Account data:</strong> email address, hashed password (never the plaintext
            password), display name, role, account status.
          </li>
          <li>
            <strong>Authentication events:</strong> login/logout/signup timestamps, IP address
            (stored hashed, never raw), user agent, device/session metadata — kept to detect fraud
            and secure your account.
          </li>
          <li>
            <strong>Cookies:</strong> a strictly necessary session cookie (required to keep you
            signed in) and, only with your consent, analytics/marketing cookies — see our{" "}
            <a href="/terms" className="underline">
              cookie preferences
            </a>
            .
          </li>
          <li>
            <strong>Analytics:</strong> product-usage events (e.g. "signup completed"), collected
            only after you consent, and never containing your email address, password, or any
            token/ID in the event itself.
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Why we process it, and on what legal basis</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Account data — <em>contract</em> (providing the service you signed up for).
          </li>
          <li>
            Authentication events — <em>legitimate interest</em> (securing accounts against
            unauthorized access) and <em>legal obligation</em> where applicable.
          </li>
          <li>
            Analytics/marketing cookies — <em>consent</em>, which you may withdraw at any time.
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Who processes data on our behalf</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>Authentication/identity provider: [name the provider actually deployed].</li>
          <li>Email delivery: [name the email provider actually deployed].</li>
          <li>Hosting/infrastructure: [name the hosting/database/Redis providers deployed].</li>
          <li>
            Analytics (only after consent): [name the analytics provider, if any, actually
            deployed].
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">How long we keep it</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Account data: retained while your account is active, plus [X days] after deletion.
          </li>
          <li>Authentication events: retained for [X days] for security investigation purposes.</li>
          <li>Cookie consent record: retained until you change it, plus the version history.</li>
          <li>Analytics events: retained for [X days], aggregated or deleted thereafter.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Your rights</h2>
        <p>
          Depending on your jurisdiction, you may have the right to access, correct, delete, export,
          or restrict processing of your personal data, and to withdraw consent at any time. To
          exercise any of these rights, contact{" "}
          <a href="mailto:privacy@example.com" className="underline">
            privacy@example.com
          </a>{" "}
          or use the{" "}
          <a href="/contact" className="underline">
            contact form
          </a>
          . You may also delete your own account and its data directly from your account settings.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">International transfers</h2>
        <p>
          [Describe here whether data is transferred outside the user's region/the EEA, and under
          what safeguard — e.g. Standard Contractual Clauses — once the actual hosting region and
          sub-processors are finalized.]
        </p>
      </section>
    </main>
  );
}
