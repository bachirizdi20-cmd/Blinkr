import { GIPHY_API_KEY } from "@/constants/oauth";

export type GiphyGif = {
  id: string;
  title: string;
  images: {
    fixed_width: { url: string; width: string; height: string };
    fixed_width_small: { url: string; width: string; height: string };
    original: { url: string; width: string; height: string };
  };
};

type GiphyResponse = {
  data?: GiphyGif[];
  pagination?: { total_count?: number; count?: number; offset?: number };
  meta?: { msg?: string; status?: number };
};

const PAGE_SIZE = 24;

export async function searchGiphy(query: string, offset = 0): Promise<GiphyGif[]> {
  if (!GIPHY_API_KEY) {
    throw new Error("GIPHY API key is not configured");
  }

  const endpoint = query.trim()
    ? "https://api.giphy.com/v1/gifs/search"
    : "https://api.giphy.com/v1/gifs/trending";
  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: String(PAGE_SIZE),
    offset: String(offset),
    rating: "pg-13",
    lang: "en",
  });
  if (query.trim()) params.set("q", query.trim());

  const response = await fetch(`${endpoint}?${params.toString()}`);
  const payload = (await response.json()) as GiphyResponse;
  if (!response.ok || payload.meta?.status !== 200) {
    throw new Error(payload.meta?.msg || "GIPHY search failed");
  }
  return (payload.data ?? []).filter((gif) => Boolean(gif.images?.fixed_width?.url));
}
