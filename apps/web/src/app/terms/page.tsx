import type { Metadata } from "next";
import { CURRENT_TERMS_VERSION } from "@saas/validation";

export const metadata: Metadata = { title: "Terms & Conditions" };

const LAST_UPDATED = "2026-10-07";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div
        role="alert"
        className="border-destructive/50 bg-destructive/10 mb-8 rounded-md border p-4 text-sm"
      >
        <strong>Draft — requires legal review.</strong> This page is a placeholder template, not a
        reviewed or approved terms of service. Do not rely on it in production until qualified legal
        counsel has reviewed and approved the final text for the applicable jurisdiction(s).
      </div>

      <h1 className="mb-2 text-3xl font-bold">Terms &amp; Conditions</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Version {CURRENT_TERMS_VERSION} — last updated: {LAST_UPDATED}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Your account</h2>
        <p>
          You must provide accurate information when creating an account and keep your credentials
          confidential. You are responsible for all activity under your account. Accounts found to
          violate these terms may be suspended or disabled.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Acceptable use</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>No attempting to gain unauthorized access to any account or system.</li>
          <li>No uploading malicious code, spam, or content that infringes another's rights.</li>
          <li>No use that violates applicable law.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Termination</h2>
        <p>
          You may stop using the service and delete your account at any time. We may suspend or
          terminate access for a violation of these terms, with notice where practicable.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Liability</h2>
        <p>
          [Placeholder — the actual limitation-of-liability language must be drafted and approved by
          legal counsel for the operator's specific jurisdiction and business model; do not ship
          default/boilerplate liability language without review.]
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Governing law</h2>
        <p>
          [Placeholder — name the governing jurisdiction once the operating entity's location is
          finalized.]
        </p>
      </section>

      <section className="mb-6">
        <p className="text-muted-foreground text-sm">
          By creating an account, you confirm you have read and agree to this version of the Terms
          &amp; Conditions and our{" "}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>
          . We record the version you agreed to and when.
        </p>
      </section>
    </main>
  );
}
