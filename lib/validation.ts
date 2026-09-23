import { z } from "zod";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeCtaUrl(value: string) {
  if (/^#[A-Za-z][\w:.-]*$/.test(value)) return true;
  if (/^\/(?!\/)/.test(value)) return true;
  return isHttpUrl(value);
}

const optionalPublicUrl = z.string().max(2048).refine((value) => value === "" || isHttpUrl(value), "Use uma URL HTTP ou HTTPS válida.");
const ctaUrl = z.string().min(1).max(500).refine(isSafeCtaUrl, "Use uma âncora, caminho interno ou URL HTTP/HTTPS.");

const touchSchema = z.object({
  landingUrl: z.string().url().max(2048).refine(isHttpUrl),
  referrer: z.string().max(2048).refine(value => value === "" || isHttpUrl(value)),
  capturedAt: z.string().datetime(),
  parameters: z.record(z.string().max(80), z.string().max(200)).refine(value => Object.keys(value).length <= 24 && JSON.stringify(value).length <= 1600),
});
export const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/),
  email: z.string().email().optional().or(z.literal("")),
  establishment: z.string().trim().min(2).max(160),
  city: z.string().trim().max(120).optional(),
  ambassadorId: z.string().uuid().optional(),
  ambassadorName: z.string().trim().min(2).max(120).optional(),
  ambassadorSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  sourceType: z.enum(["ambassador", "institutional"]).default("ambassador"),
  attribution: z.object({ firstTouch: touchSchema, conversionTouch: touchSchema, intent: z.enum(["gestao", "operacao", "delivery", "migracao"]).nullable() }).optional(),
  campaignCode: z.string().max(120).optional(),
  sourcePage: z.string().startsWith("/").max(500).refine((value) => !value.startsWith("//")),
  sourceUrl: z.string().url().max(2048).refine(isHttpUrl),
  monthlyRevenue: z.enum(["Até R$ 20 mil", "De R$ 20 mil a R$ 40 mil", "De R$ 40 mil a R$ 70 mil", "De R$ 70 mil a R$ 200 mil", "De R$ 200 mil a R$ 500 mil", "Acima de R$ 500 mil", "Até R$ 30 mil", "R$ 30 a 80 mil", "R$ 80 a 200 mil", "Acima de R$ 200 mil"]),
  contactPreference: z.enum(["whatsapp", "phone_call", "email"]),
  consentLgpd: z.literal(true),
  submittedAt: z.string().datetime({ offset: true }),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  website: z.string().max(0).optional(),
  formStartedAt: z.number().int().positive(),
}).superRefine((value, ctx) => {
  if (value.sourceType === "ambassador" && (!value.ambassadorId || !value.ambassadorName || !value.ambassadorSlug)) ctx.addIssue({ code: "custom", message: "Embaixador obrigatório.", path: ["ambassadorId"] });
  if (value.sourceType === "institutional" && (value.ambassadorId || value.ambassadorName || value.ambassadorSlug)) ctx.addIssue({ code: "custom", message: "Origem institucional não aceita embaixador.", path: ["sourceType"] });
});

export const idempotencyKeySchema = z.string().uuid();

const ordered = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(3000),
  sortOrder: z.number().int().min(0),
});

export const ambassadorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().max(240),
  biography: z.string().max(5000),
  primaryPhotoUrl: optionalPublicUrl,
  secondaryPhotoUrl: optionalPublicUrl,
  instagramUrl: optionalPublicUrl,
  tiktokUrl: optionalPublicUrl,
  youtubeUrl: optionalPublicUrl,
  whatsapp: z.string().max(30),
  heroTitle: z.string().min(5).max(180),
  heroSubtitle: z.string().min(5).max(400),
  heroQuote: z.string().max(600),
  painTitle: z.string().min(5).max(300),
  solutionTitle: z.string().min(5).max(300),
  testimonial: z.string().max(3000),
  primaryCtaText: z.string().min(2).max(100),
  primaryCtaUrl: ctaUrl,
  secondaryCtaText: z.string().min(2).max(100),
  secondaryCtaUrl: ctaUrl,
  campaignCode: z.string().max(120),
  seoTitle: z.string().min(5).max(70),
  seoDescription: z.string().min(20).max(170),
  ogImageUrl: optionalPublicUrl,
  videoUrl: optionalPublicUrl,
  status: z.enum(["draft", "published", "archived"]),
  benefits: z.array(ordered).max(20),
  testimonials: z.array(ordered.extend({ author: z.string().max(160).optional(), role: z.string().max(160).optional() })).max(20),
  faqs: z.array(z.object({ id: z.string().uuid().optional(), question: z.string().min(2).max(300), answer: z.string().min(2).max(5000), sortOrder: z.number().int().min(0) })).max(30),
});
