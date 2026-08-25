import type { Metadata, Viewport } from "next";
import { Roboto_Slab, Work_Sans } from "next/font/google";
import { getPublicSiteUrl } from "@/lib/env";
import "./globals.css";
const workSans=Work_Sans({subsets:["latin"],variable:"--font-work-sans",display:"swap"});
const robotoSlab=Roboto_Slab({subsets:["latin"],variable:"--font-roboto-slab",display:"swap"});
export const metadata:Metadata={metadataBase:new URL(getPublicSiteUrl()),title:{default:"Simpliza para Restaurantes",template:"%s | Simpliza"},description:"Gestão simples e integrada para restaurantes.",icons:{icon:{url:"/brand/simpliza-logo.svg",type:"image/svg+xml"}}};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#004568"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" className={`${workSans.variable} ${robotoSlab.variable}`}><body>{children}</body></html>}
