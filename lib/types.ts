export type AmbassadorStatus = "draft" | "published" | "archived";

export type OrderedItem = {
  id?: string;
  title: string;
  body: string;
  sortOrder: number;
};

export type Testimonial = OrderedItem & {
  author?: string;
  role?: string;
};

export type Faq = {
  id?: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export type Ambassador = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  biography: string;
  primaryPhotoUrl: string;
  secondaryPhotoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  whatsapp: string;
  heroTitle: string;
  heroSubtitle: string;
  heroQuote: string;
  painTitle: string;
  solutionTitle: string;
  testimonial: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  secondaryCtaText: string;
  secondaryCtaUrl: string;
  campaignCode: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
  videoUrl: string;
  status: AmbassadorStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  benefits: OrderedItem[];
  testimonials: Testimonial[];
  faqs: Faq[];
};

export type AmbassadorInput = Omit<
  Ambassador,
  "id" | "createdAt" | "updatedAt" | "publishedAt"
> & { publishedAt?: string | null };

export type LeadInput = {
  name: string;
  phone: string;
  email?: string;
  establishment: string;
  city?: string;
  ambassadorId: string;
  sourcePage: string;
  monthlyRevenue?: string;
  consentLgpd: true;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  website?: string;
  formStartedAt: number;
};
