import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monadic DNA Explorer",
  description: "Interactive exploration of GWAS Catalog studies with quality-aware filtering and private AI analysis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
