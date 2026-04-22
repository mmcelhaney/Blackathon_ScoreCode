import type { Metadata } from "next";
import { Bebas_Neue, Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});
const barlow = Barlow({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});
const barlowCond = Barlow_Condensed({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow-cond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Blackathon Score Card · BlackWPT Hackathon 2026",
  description: "Hackathon submission, judging, and results platform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${barlow.variable} ${barlowCond.variable}`}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
