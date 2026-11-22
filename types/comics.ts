export interface ComicSummary {
  id: number;
  /** Comic Vine resource kind prevents issue/volume ID collisions. */
  resourceType?: 'issue' | 'volume';
  title: string;
  issueNumber: string | null;
  volumeName: string | null;
  coverUrl: string | null;
  description: string | null;
  deck: string | null;
  publisher: string | null;
  publishDate: string | null;
  creators: string[];
  rating: number | null;
  sourceUrl: string;
}
