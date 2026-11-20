import type { Metadata } from "next";
import Script from "next/script";
import { Agentation } from "agentation";
import { WorkspaceTransitionProvider } from "@/components/workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: "Print Studio Ledger — Universal SaaS Dashboard",
  description: "3D Printing Studio Management & Production Ledger built with Universal SaaS Design System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme_preference');
                  if (savedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <WorkspaceTransitionProvider>
          {children}
        </WorkspaceTransitionProvider>
        {process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_AGENTATION === "true" && <Agentation />}
      </body>
    </html>
  );
}
