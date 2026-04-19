import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — FINVANTA CBS",
  description: "Secure sign-in to FINVANTA Core Banking Platform",
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
