import type { Metadata } from "next";
import { AdminAuthGuard } from "./admin-auth-guard";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({children}:{children:React.ReactNode}){return <AdminAuthGuard>{children}</AdminAuthGuard>}
