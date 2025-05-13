// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ConditionalHeader from "./components/conditionalHeader";
import { AuthContextProvider } from "./lib/authContext"; 
import { Suspense } from "react"; // Add Suspense import
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Nexus - AI-Powered Job Platform",
  description: "Connect talent with opportunity using AI-powered job matching",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthContextProvider>
          <ConditionalHeader />
          <main className="flex-grow pt-16">
            {/* Wrap children in Suspense boundary */}
            <Suspense fallback={
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            }>
              {children}
            </Suspense>
          </main>
        </AuthContextProvider>
      </body>
    </html>
  );
}