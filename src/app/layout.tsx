import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "D'furn Lead Engine · Local Command Center",
  description: "Zero-cost discovery, 5D qualification, and outreach engine for D'furn Modular Systems.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#FF7700",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col">
        {/* Top Command Bar */}
        <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E5E7EB] shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3">
                <span className="bg-[#FF7700] text-white font-extrabold text-base tracking-wider px-2.5 py-1 rounded">
                  D'FURN
                </span>
                <span className="font-semibold text-sm tracking-tight text-[#111827]">
                  Lead Engine <span className="text-[#6B7280] font-normal">· Localhost</span>
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/"
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-[#374151] hover:text-[#111827] hover:bg-[#F3F4F6]"
                >
                  Dashboard
                </Link>
                <Link
                  href="/queue"
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-[#374151] hover:text-[#111827] hover:bg-[#F3F4F6]"
                >
                  Review Queue
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#059669] bg-[#ECFDF5] px-2.5 py-1 rounded-full border border-[#A7F3D0]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                <span>Port 3001 Active</span>
              </div>
              <a
                href="http://localhost:3000"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-[#4B5563] hover:text-[#FF7700] bg-[#F3F4F6] hover:bg-[#E5E7EB] px-3 py-1.5 rounded border border-[#D1D5DB] transition"
              >
                Open D'furn ERP ↗
              </a>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Compact Footer */}
        <footer className="bg-white border-t border-[#E5E7EB] py-4 text-center text-xs text-[#6B7280]">
          D'furn Modular Systems · Standalone Lead Engine · Zero-Cost B2B Discovery
        </footer>
      </body>
    </html>
  );
}
