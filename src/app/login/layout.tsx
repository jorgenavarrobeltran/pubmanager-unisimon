import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Login — PubManager",
  description: "Inicia sesión en PubManager, sistema de gestión editorial de la Universidad Simón Bolívar.",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
