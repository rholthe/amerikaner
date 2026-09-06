import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amerikaner",
  description: "Poeng og statistikk for kortspillet amerikaner",
  appleWebApp: {
    capable: true,
    title: "Amerikaner",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
