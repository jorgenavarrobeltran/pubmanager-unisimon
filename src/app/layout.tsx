import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "PubManager — Universidad Simón Bolívar",
  description: "Sistema de gestión editorial de la Universidad Simón Bolívar. Gestión de revistas científicas, libros, capítulos, certificados e informes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
