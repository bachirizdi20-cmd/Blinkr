export interface ComicSummary {
  id: number;
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
