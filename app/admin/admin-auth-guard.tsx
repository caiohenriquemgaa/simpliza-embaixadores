"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), router = useRouter();
  const [ready, setReady] = useState(() => pathname === "/admin/login");
  useEffect(() => {
    if (pathname === "/admin/login") return;
    const client = getBrowserSupabase();
    if (!client) { router.replace("/admin/login"); return; }
    client.auth.getUser().then(({ data }) => {
      if (!data.user || data.user.app_metadata?.role !== "admin") router.replace("/admin/login");
      else setReady(true);
    }).catch(() => router.replace("/admin/login"));
  }, [router, pathname]);
  if (pathname === "/admin/login") return children;
  if (!ready) return <main className="adminShell"><div className="adminCard">Validando acesso...</div></main>;
  return children;
}
