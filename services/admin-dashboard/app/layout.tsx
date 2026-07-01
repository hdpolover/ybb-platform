import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import { Providers } from "./providers";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "YBB Platform - Admin Dashboard",
  description: "Administration portal for YBB Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakartaSans.variable} antialiased`}>
        <NuqsAdapter>
          <AuthProvider>
            <Providers>
              {children}
            </Providers>
          </AuthProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
