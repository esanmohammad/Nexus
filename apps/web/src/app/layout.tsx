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
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
