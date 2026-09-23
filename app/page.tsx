import type { Metadata } from "next";
import { LandingTemplate } from "./components/landing-template";
const title = "Simpliza | Gestão integrada para restaurantes";
const description = "PDV, pedidos, estoque, delivery e financeiro conectados em uma única operação. Conheça o Simpliza e simule seu plano.";
export const metadata: Metadata = {
  title: { absolute: title }, description, alternates: { canonical: "/" },
  openGraph: { title, description, url: "/", type: "website", locale: "pt_BR", images: [{ url: "/product/mockup-simpliza.webp" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/product/mockup-simpliza.webp"] },
};
export default function Home() { return <LandingTemplate/>; }
