"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { initializeOpenAiPixel, isInstitutionalPath, OPENAI_PIXEL_SRC, subscribeOpenAiPixel } from "@/lib/openai-pixel";

export function OpenAiPixel() {
  const pathname = usePathname();
  // Enable only after automatic advanced matching is disabled on the real source.
  // As of 2026-09-24 it is enabled and no documented client opt-out exists.
  const enabled = process.env.NEXT_PUBLIC_OPENAI_PIXEL_ENABLED === "true";
  const institutional = isInstitutionalPath(pathname);
  useEffect(() => {
    if (!enabled || !institutional) return;
    initializeOpenAiPixel();
    return subscribeOpenAiPixel();
  }, [enabled, institutional]);

  if (!enabled || !institutional) return null;
  return <Script id="simpliza-openai-pixel" src={OPENAI_PIXEL_SRC} strategy="afterInteractive" />;
}
