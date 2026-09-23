import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AmbassadorShortUrl({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  permanentRedirect(`/embaixadores/${encodeURIComponent(slug)}${query.size ? `?${query}` : ""}`);
}
