import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookShelf",
  description: "Tu catálogo digital de libros",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
