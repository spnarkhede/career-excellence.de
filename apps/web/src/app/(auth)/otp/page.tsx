import type { Metadata } from "next";
import { buildPageMetadata } from "../../../lib/seo";
import { OtpClient } from "./otp-client";

export const metadata: Metadata = buildPageMetadata({
  title: "Enter Your Code — One-Time Login for Your App Platform",
  description:
    "Enter the one-time code we just sent you to securely log in to your App Platform account without ever using a password at all.",
  path: "/otp",
  noindex: true,
});

export default function OtpPage() {
  return <OtpClient />;
}
