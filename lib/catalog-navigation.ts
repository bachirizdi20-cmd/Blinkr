import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ContentStackParamList } from "../navigation/types";
import type { ReviewMediaType } from "../types/tmdb";
import type { BookSummary } from "../types/books";
import { posterUrl } from "./tmdb";

export function normalizeReviewMediaType(value: unknown): ReviewMediaType {
  return value === "book" ? "book" : value === "tv" ? "tv" : "movie";
}

export function catalogPosterUrl(mediaType: ReviewMediaType, posterPath: string | null | undefined, size: "w200" | "w342" | "w500" = "w342"): string | null {
  if (mediaType === "book") {
    return posterPath?.startsWith("https://covers.openlibrary.org/") ? posterPath : null;
  }
  return posterUrl(posterPath ?? null, size);
}

export interface CatalogItemLink {
  mediaType: ReviewMediaType;
  mediaId: number;
  title?: string;
  posterPath?: string | null;
  date?: string;
  voteAverage?: number;
  book?: Partial<BookSummary>;
}

export function openCatalogItem(
  navigation: NativeStackNavigationProp<ContentStackParamList>,
  item: CatalogItemLink,
) {
  if (item.mediaType === "book") {
    navigation.navigate("BookDetail", {
      workId: item.mediaId,
      book: item.book ?? {
        workId: item.mediaId,
        workKey: `/works/OL${item.mediaId}W`,
        ...(item.title ? { title: item.title } : {}),
        authorNames: [],
        ...(item.date ? { firstPublishYear: Number(item.date.slice(0, 4)) || null } : {}),
        coverId: null,
        coverUrl: item.posterPath ?? null,
        isbn: null,
        pageCount: null,
        editionCount: 0,
        ratingsAverage: item.voteAverage ?? null,
        ratingsCount: 0,
        subjects: [],
      },
    });
    return;
  }

  navigation.navigate("Detail", { mediaType: item.mediaType, id: item.mediaId });
}
