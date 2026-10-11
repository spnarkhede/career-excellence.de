import type { Metadata } from "next";
import { buildPageMetadata } from "../../lib/seo";
import { ContactClient } from "./contact-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Us — Get in Touch with the App Platform Team",
  description:
    "Have a question or need help? Send a message to the App Platform team and we will get back to you as soon as we possibly can.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Contact us</h1>
      <ContactClient />
    </main>
  );
}
