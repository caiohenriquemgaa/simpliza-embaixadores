import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/env";
export default function robots():MetadataRoute.Robots{const base=getPublicSiteUrl();return{rules:{userAgent:"*",allow:"/",disallow:["/admin/","/api/","/preview/"]},sitemap:`${base}/sitemap.xml`}}
