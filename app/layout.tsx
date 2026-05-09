import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Football Ticket Dashboard",
  description: "Ranked football ticket results by postcode and age."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
