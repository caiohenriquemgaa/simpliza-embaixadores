import { cache } from "react";
import { felipeSeed } from "./seed";
import { createPublicSupabaseClient, createServiceSupabaseClient } from "./supabase";
import type { Ambassador } from "./types";

type DbRow = Record<string, unknown> & {
  benefits?: Record<string, unknown>[];
  testimonials?: Record<string, unknown>[];
  faqs?: Record<string, unknown>[];
};

export const ambassadorColumns = "*, benefits(*), testimonials(*), faqs(*)";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function mapAmbassadorRow(row: DbRow): Ambassador {
  const ordered = (items: Record<string, unknown>[] | undefined) =>
    (items ?? []).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  return {
    id: text(row.id), name: text(row.name), slug: text(row.slug),
    shortDescription: text(row.short_description), biography: text(row.biography),
    primaryPhotoUrl: text(row.primary_photo_url), secondaryPhotoUrl: text(row.secondary_photo_url),
    instagramUrl: text(row.instagram_url), tiktokUrl: text(row.tiktok_url),
    youtubeUrl: text(row.youtube_url), whatsapp: text(row.whatsapp),
    heroTitle: text(row.hero_title), heroSubtitle: text(row.hero_subtitle), heroQuote: text(row.hero_quote),
    painTitle: text(row.pain_title), solutionTitle: text(row.solution_title), testimonial: text(row.testimonial),
    primaryCtaText: text(row.primary_cta_text), primaryCtaUrl: text(row.primary_cta_url),
    secondaryCtaText: text(row.secondary_cta_text), secondaryCtaUrl: text(row.secondary_cta_url),
    campaignCode: text(row.campaign_code), seoTitle: text(row.seo_title),
    seoDescription: text(row.seo_description), ogImageUrl: text(row.og_image_url), videoUrl: text(row.video_url),
    status: row.status === "draft" || row.status === "archived" ? row.status : "published",
    publishedAt: text(row.published_at) || null, createdAt: text(row.created_at), updatedAt: text(row.updated_at),
    benefits: ordered(row.benefits).map((item) => ({
      id: text(item.id), title: text(item.title), body: text(item.body), sortOrder: Number(item.sort_order),
    })),
    testimonials: ordered(row.testimonials).map((item) => ({
      id: text(item.id), title: text(item.title), body: text(item.body),
      author: text(item.author), role: text(item.role), sortOrder: Number(item.sort_order),
    })),
    faqs: ordered(row.faqs).map((item) => ({
      id: text(item.id), question: text(item.question), answer: text(item.answer), sortOrder: Number(item.sort_order),
    })),
  };
}

export const getPublishedAmbassador = cache(async (slug: string): Promise<Ambassador | null> => {
  const client = createPublicSupabaseClient();
  if (!client) return slug === felipeSeed.slug ? felipeSeed : null;
  const { data, error } = await client.from("ambassadors").select(ambassadorColumns).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error(`Falha ao carregar embaixador: ${error.message}`);
  return data ? mapAmbassadorRow(data as DbRow) : null;
});

export async function getAmbassadorForPreview(id: string): Promise<Ambassador | null> {
  const client = createServiceSupabaseClient();
  if (!client) return id === felipeSeed.id ? felipeSeed : null;
  const { data, error } = await client.from("ambassadors").select(ambassadorColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao carregar pré-visualização: ${error.message}`);
  return data ? mapAmbassadorRow(data as DbRow) : null;
}

export async function getPublishedSlugs() {
  const client = createPublicSupabaseClient();
  if (!client) return [{ slug: felipeSeed.slug, updatedAt: felipeSeed.updatedAt }];
  const { data, error } = await client.from("ambassadors").select("slug, updated_at").eq("status", "published");
  if (error) return [];
  return (data ?? []).map((row) => ({ slug: text(row.slug), updatedAt: text(row.updated_at) }));
}
