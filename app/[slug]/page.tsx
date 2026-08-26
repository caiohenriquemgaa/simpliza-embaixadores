import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function AmbassadorShortUrl({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(`/embaixadores/${encodeURIComponent(slug)}`);
}
