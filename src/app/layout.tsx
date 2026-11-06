import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "D'furn Lead Engine · Paid Ads & Inquiry Cockpit",
  description: "Speed-to-lead response, operator-controlled qualification, and frictionless ERP enquiry conversion for Paid Ads.",
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
      <body className="h-screen overflow-hidden bg-[#F4F3ED] text-[#171717] flex flex-col font-sans select-none antialiased">
        {/* Top ERP Command Bar (Compact 50px) */}
        <header className="h-[50px] shrink-0 bg-[#F4F3ED] border-b border-[#E5DFD3] z-40 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="bg-[#FF7700] text-white font-extrabold text-sm tracking-wider px-2 py-0.5 rounded">
                D'FURN
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm tracking-tight text-[#111827]">
                  Sales Calling Desk
                </span>
                <span className="text-[11px] text-[#8B8778] hidden sm:inline">
                  · Ahmedabad Commercial Hub
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-1 ml-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-[#000000] text-white">
                Calling Desk
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#059669] bg-[#E8F8F0] px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
              <span>Live Engine</span>
            </div>

            <div className="w-7 h-7 bg-gray-900 rounded-full text-white flex items-center justify-center text-xs font-bold ring-1 ring-white">
              SA
            </div>
          </div>
        </header>

        {/* Main Content Area: Viewport Locked */}
        <main className="flex-1 overflow-hidden px-4 py-2 max-w-[1720px] w-full mx-auto flex flex-col min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
