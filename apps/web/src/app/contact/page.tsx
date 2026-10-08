import type { Metadata } from "next";
import { ContactClient } from "./contact-client";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Contact us</h1>
      <ContactClient />
    </main>
  );
}
