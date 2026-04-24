// PATH: frontend/app/layout.tsx
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ScrollToTop from "@/components/layout/ScrollToTop";
import "./globals.css";

export const metadata: Metadata = {
  title: "CemIQ — Cement Intelligence Platform",
  description: "Smarter diagnostics and KPI intelligence for cement and beyond",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 font-sans text-gray-800 antialiased" suppressHydrationWarning>
        <ScrollToTop />
        <Navbar />
        <main className="px-4 py-4 max-w-[1600px] mx-auto">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}