import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/providers";
import { Header } from "../components/header";

export const metadata: Metadata = {
  title: "Nexus",
  description: "Ship AI-generated apps internally",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface bg-grid">
        <Providers>
          <Header />
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
