import type { Metadata, Viewport } from "next";
import { MetaPixel } from "@/app/components/meta-pixel";
import { getPublicSiteUrl } from "@/lib/env";
import "./globals.css";
export const metadata:Metadata={metadataBase:new URL(getPublicSiteUrl()),title:{default:"Simpliza para Restaurantes",template:"%s | Simpliza"},description:"Gestão simples e integrada para restaurantes.",icons:{icon:{url:"/favicon.svg",type:"image/svg+xml"}}};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#004568"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}<MetaPixel /></body></html>}
