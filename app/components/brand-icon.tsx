import Image from "next/image";
import type { ReactNode } from "react";

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" /><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" /></>,
    order: <><path d="M6 3h12l2 18H4L6 3Z" /><path d="M9 7a3 3 0 0 0 6 0" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m9 7 8 5-8 5V7Z" />,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Brand({ priority = false }: { priority?: boolean }) {
  return <a className="brand" href="#inicio" aria-label="Simpliza, início"><Image className="brandLogo" src="/brand/simpliza-logo.svg" alt="Simpliza" width={120} height={42} priority={priority} /></a>;
}
