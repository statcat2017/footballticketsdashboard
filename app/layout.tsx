import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Near Me FC",
  description: "Find football fixtures near you with prices and travel estimates."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
