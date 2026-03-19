import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "401.GIVES",
  description: "Explore. Discover. Give.",
  metadataBase: new URL("https://401.gives"),
  openGraph: {
    title: "401.GIVES",
    description: "Explore Rhode Island's 677 nonprofits on an interactive map.",
    type: "website",
    siteName: "401.GIVES",
  },
  twitter: {
    card: "summary_large_image",
    title: "401.GIVES",
    description: "Explore Rhode Island's 677 nonprofits on an interactive map.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-void text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
