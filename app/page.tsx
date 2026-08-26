import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedAmbassador } from "@/lib/ambassadors";
import { LandingTemplate } from "./components/landing-template";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ambassador = await getPublishedAmbassador("felipe");
  if (!ambassador) return {};
  const canonical = `/embaixadores/${ambassador.slug}`;
  return {
    title: { absolute: ambassador.seoTitle },
    description: ambassador.seoDescription,
    alternates: { canonical },
    openGraph: {
      title: ambassador.seoTitle,
      description: ambassador.seoDescription,
      type: "website",
      locale: "pt_BR",
      url: canonical,
      images: ambassador.ogImageUrl ? [{ url: ambassador.ogImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ambassador.seoTitle,
      description: ambassador.seoDescription,
      images: ambassador.ogImageUrl ? [ambassador.ogImageUrl] : undefined,
    },
  };
}

export default async function Home(){const ambassador=await getPublishedAmbassador("felipe");if(!ambassador)notFound();return <LandingTemplate ambassador={ambassador}/>}
