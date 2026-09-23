import { ambassadorSeo } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingTemplate } from "@/app/components/landing-template";
import { getPublishedAmbassador, getPublishedSlugs } from "@/lib/ambassadors";
import { getPublicSiteUrl } from "@/lib/env";
export const dynamic = "force-dynamic";
type Props={params:Promise<{slug:string}>};
export async function generateStaticParams(){return(await getPublishedSlugs()).map(({slug})=>({slug}))}
export async function generateMetadata({params}:Props):Promise<Metadata>{const{slug}=await params,a=await getPublishedAmbassador(slug);if(!a)return{};const path=`/embaixadores/${a.slug}`,seo=ambassadorSeo(a);return{title:{absolute:seo.title},description:seo.description,alternates:{canonical:path},openGraph:{title:seo.title,description:seo.description,type:"website",locale:"pt_BR",url:path,images:a.ogImageUrl?[{url:a.ogImageUrl}]:undefined},twitter:{card:"summary_large_image",title:seo.title,description:seo.description,images:a.ogImageUrl?[a.ogImageUrl]:undefined}}}
export default async function AmbassadorPage({params}:Props){const{slug}=await params,a=await getPublishedAmbassador(slug);if(!a)notFound();const seo=ambassadorSeo(a);const schema={"@context":"https://schema.org","@type":"WebPage",name:seo.title,description:seo.description,url:`${getPublicSiteUrl()}/embaixadores/${a.slug}`,about:{"@type":"SoftwareApplication",name:"Simpliza",applicationCategory:"BusinessApplication",operatingSystem:"Web"}};return <><LandingTemplate ambassador={a}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/></>}
