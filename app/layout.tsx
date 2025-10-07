import type { Metadata } from "next";
import Script from "next/script";
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
      <head>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HP3FB0GX80"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HP3FB0GX80', {
              anonymize_ip: true,
            });
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
