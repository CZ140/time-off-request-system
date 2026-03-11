import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Time Off Request System",
  description: "Teacher leave request submission and admin approval system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
