import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Performance Coach + App (PC+)",
  description: "Professional performance coaching platform with periodization, RPE tracking, and client management for PC3s and PC4s",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const firebasePublicConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Prevent XSS via closing script tags or '<' sequences in JSON (defense-in-depth).
  const firebasePublicConfigJson = JSON.stringify(firebasePublicConfig).replace(/</g, "\\u003c");

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `window.__FIREBASE_CONFIG__ = ${firebasePublicConfigJson};`,
          }}
        />
        <Providers>
          <div className="min-h-screen bg-background">
            <Header />
            <main>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}