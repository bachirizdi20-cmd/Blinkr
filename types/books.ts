export interface BookSummary {
  workId: number;
  workKey: string;
  title: string;
  authorNames: string[];
  firstPublishYear: number | null;
  firstPublishDate?: string | null;
  coverId: number | null;
  coverUrl: string | null;
  isbn: string | null;
  pageCount: number | null;
  editionCount: number;
  ratingsAverage: number | null;
  ratingsCount: number;
  subjects: string[];
  description?: string | null;
  sourceUrl?: string;
}

export interface BookSearchPage {
  results: BookSummary[];
  page: number;
  limit: number;
  totalResults: number | null;
  totalPages: number;
}
