import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "ระบบจัดเวร โรงพยาบาลลำพูน",
  description: "ระบบจัดตารางเวรพยาบาลและผู้ช่วยพยาบาล โรงพยาบาลลำพูน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d9488",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
