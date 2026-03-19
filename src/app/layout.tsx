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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-void text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
