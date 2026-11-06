import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ContentStackParamList } from "../navigation/types";
import type { ReviewMediaType } from "../types/tmdb";
import type { BookSummary } from "../types/books";
import { posterUrl } from "./tmdb";
import { bookCoverUrl } from "./book-utils";

export function normalizeReviewMediaType(value: unknown): ReviewMediaType {
  return value === "book" ? "book" : value === "tv" ? "tv" : "movie";
}

export function catalogPosterUrl(mediaType: ReviewMediaType, posterPath: string | null | undefined, size: "w200" | "w342" | "w500" = "w342"): string | null {
  if (mediaType === "book") {
    return bookCoverUrl(posterPath);
  }
  return bookCoverUrl(posterPath) ?? posterUrl(posterPath ?? null, size);
}

export interface CatalogItemLink {
  mediaType: ReviewMediaType;
  mediaId: number;
  title?: string;
  posterPath?: string | null;
  date?: string | null;
  voteAverage?: number | null;
  book?: Partial<BookSummary>;
}

export function openCatalogItem(
  navigation: NativeStackNavigationProp<ContentStackParamList>,
  item: CatalogItemLink,
) {
  if (item.mediaType === "book") {
    const fallback: Partial<BookSummary> | undefined = item.book || item.title || item.posterPath || item.date ? {
      workId: item.mediaId,
      ...(item.title ? { title: item.title } : {}),
      ...(item.date ? { firstPublishYear: Number(item.date.slice(0, 4)) || null } : {}),
      coverUrl: item.posterPath ?? null,
      ...item.book,
    } : undefined;
    navigation.navigate("BookDetail", {
      workId: item.mediaId,
      book: fallback,
    });
    return;
  }

  navigation.navigate("Detail", { mediaType: item.mediaType, id: item.mediaId });
}
