import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingTemplate } from "@/app/components/landing-template";
import { getAmbassadorForPreview } from "@/lib/ambassadors";
import { verifyPreviewToken } from "@/lib/preview-token";
export const metadata:Metadata={title:"Pré-visualização",robots:{index:false,follow:false}};
export default async function PreviewPage({params}:{params:Promise<{token:string}>}){const{token}=await params,id=await verifyPreviewToken(token);if(!id)notFound();const ambassador=await getAmbassadorForPreview(id);if(!ambassador)notFound();return <LandingTemplate ambassador={ambassador} preview/>}
