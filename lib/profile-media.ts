import { ReviewMediaType } from '../types/tmdb';

export type ProfileMediaItem = {
  mediaType: ReviewMediaType;
  mediaId: number;
  title: string;
  posterPath: string | null;
  date?: string | null;
  voteAverage?: number | null;
  status?: string;
  watchedDate?: string | null;
  createdAt?: number | null;
  addedAt?: number | null;
  likedAt?: number | null;
  updatedAt?: Date | string;
  rating?: number | null;
  review?: string;
};

export type ProfileMediaStatus = {
  mediaType: string;
  mediaId: number;
  title: string;
  posterPath: string | null;
  status: string;
  updatedAt: Date | string;
};

function timestamp(value: Date | string | number | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function itemTimestamp(item: ProfileMediaItem): number {
  return timestamp(item.updatedAt ?? item.addedAt ?? item.createdAt ?? item.watchedDate);
}

export function mergeProfileMediaItems(
  items: ProfileMediaItem[],
  statuses: ProfileMediaStatus[],
  includedStatuses: readonly string[],
): ProfileMediaItem[] {
  const merged = new Map<string, ProfileMediaItem>();
  for (const item of items) {
    const key = `${item.mediaType}:${item.mediaId}`;
    const existing = merged.get(key);
    if (!existing || itemTimestamp(item) > itemTimestamp(existing)) merged.set(key, item);
  }

  for (const status of statuses) {
    if (!includedStatuses.includes(status.status)) continue;
    if (status.mediaType !== 'movie' && status.mediaType !== 'tv' && status.mediaType !== 'book') continue;
    const key = `${status.mediaType}:${status.mediaId}`;
    if (!merged.has(key)) {
      merged.set(key, {
        mediaType: status.mediaType,
        mediaId: status.mediaId,
        title: status.title,
        posterPath: status.posterPath,
        status: status.status,
        updatedAt: status.updatedAt,
      });
    }
  }

  return [...merged.values()].sort((a, b) => itemTimestamp(b) - itemTimestamp(a));
}
