import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/providers";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAT Vocab Online",
  description: "Adaptive SAT vocabulary trainer with guest and synced account modes."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="pageShell">
            <SiteNav />
            <main className="content">{children}</main>
          </div>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
