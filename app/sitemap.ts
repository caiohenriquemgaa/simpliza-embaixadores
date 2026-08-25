import type { MetadataRoute } from "next";
import { getPublishedSlugs } from "@/lib/ambassadors";
import { getPublicSiteUrl } from "@/lib/env";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const base=getPublicSiteUrl(),items=await getPublishedSlugs();return items.map(i=>({url:`${base}/embaixadores/${i.slug}`,lastModified:i.updatedAt?new Date(i.updatedAt):new Date(),changeFrequency:"weekly" as const,priority:1}))}
