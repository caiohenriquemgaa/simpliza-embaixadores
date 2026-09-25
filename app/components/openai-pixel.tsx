"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { initializeOpenAiPixel, isInstitutionalPath, OPENAI_PIXEL_SRC, subscribeOpenAiPixel } from "@/lib/openai-pixel";

export function OpenAiPixel({ preview = false }: { preview?: boolean }) {
  const pathname = usePathname();
  const enabled = preview;
  const institutional = isInstitutionalPath(pathname);
  useEffect(() => {
    if (!enabled || !institutional) return;
    initializeOpenAiPixel({ debug: preview });
    return subscribeOpenAiPixel();
  }, [enabled, institutional, preview]);

  if (!enabled || !institutional) return null;
  return <Script id="simpliza-openai-pixel" src={OPENAI_PIXEL_SRC} strategy="afterInteractive" />;
}
