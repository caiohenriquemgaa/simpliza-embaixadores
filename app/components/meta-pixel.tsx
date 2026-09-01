"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { flushMetaPixelQueue, META_PIXEL_CONSENT_KEY, trackMetaEvent } from "@/lib/meta-pixel";

function bootstrapPixel(pixelId: string) {
  if (window.fbq) {
    flushMetaPixelQueue();
    return;
  }

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  } as NonNullable<Window["fbq"]>;

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", pixelId);
  flushMetaPixelQueue();
}

function trackPage(pathname: string) {
  trackMetaEvent("PageView");

  const match = pathname.match(/^\/embaixadores\/([a-z0-9-]+)\/?$/);
  if (!match) return;

  trackMetaEvent("ViewContent", {
    content_category: "landing_page_embaixador",
    content_name: match[1],
    ambassador_slug: match[1],
  });
}

export function MetaPixel() {
  const pathname = usePathname();
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const [consent, setConsent] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(META_PIXEL_CONSENT_KEY);
    if (saved !== "accepted" && saved !== "rejected") return;
    const timer = window.setTimeout(() => setConsent(saved), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!pixelId || consent !== "accepted" || pathname.startsWith("/admin")) return;
    bootstrapPixel(pixelId);
    trackPage(pathname);
  }, [consent, pathname, pixelId]);

  if (!pixelId || pathname.startsWith("/admin") || consent !== null) return null;

  function choose(value: "accepted" | "rejected") {
    window.localStorage.setItem(META_PIXEL_CONSENT_KEY, value);
    setConsent(value);
  }

  return (
    <aside
      aria-label="Preferências de cookies"
      style={{
        position: "fixed", inset: "auto 16px 16px", zIndex: 1000, maxWidth: 560,
        margin: "0 auto", padding: 16, borderRadius: 14, color: "#16323f",
        background: "#fff", boxShadow: "0 12px 36px rgba(0, 35, 54, .24)",
        fontFamily: "inherit",
      }}
    >
      <strong>Cookies e privacidade</strong>
      <p style={{ margin: "6px 0 12px", lineHeight: 1.45 }}>
        Usamos cookies de medição para entender visitas e melhorar nossas campanhas. Você pode aceitar ou continuar sem esse rastreamento.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button className="btn primary" type="button" onClick={() => choose("accepted")}>Aceitar</button>
        <button className="btn secondary" type="button" onClick={() => choose("rejected")}>Continuar sem aceitar</button>
      </div>
    </aside>
  );
}
