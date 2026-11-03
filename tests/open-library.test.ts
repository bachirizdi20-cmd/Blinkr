import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeOpenLibraryBook,
  normalizeOpenLibraryDescription,
  openLibraryCoverUrl,
  parseOpenLibraryWorkId,
  searchOpenLibraryBooks,
} from "../server/open-library";

afterEach(() => vi.unstubAllGlobals());

describe("Open Library book normalization", () => {
  it("accepts work IDs from both API key forms and rejects malformed or oversized IDs", () => {
    expect(parseOpenLibraryWorkId("/works/OL12345W")).toBe(12345);
    expect(parseOpenLibraryWorkId("works/OL12345W")).toBe(12345);
    expect(parseOpenLibraryWorkId("/books/OL12345M")).toBeNull();
    expect(parseOpenLibraryWorkId("/works/OL2147483648W")).toBeNull();
  });

  it("builds safe Open Library cover URLs and returns null for missing cover IDs", () => {
    expect(openLibraryCoverUrl(42)).toBe("https://covers.openlibrary.org/b/id/42-M.jpg?default=false");
    expect(openLibraryCoverUrl(42, "L")).toBe("https://covers.openlibrary.org/b/id/42-L.jpg?default=false");
    expect(openLibraryCoverUrl(-1)).toBeNull();
    expect(openLibraryCoverUrl(undefined)).toBeNull();
  });

  it("normalizes search documents and retains stable work metadata", () => {
    const book = normalizeOpenLibraryBook({
      key: "/works/OL12345W",
      title: "  Example Book  ",
      author_name: ["Author One", "Author Two", null],
      first_publish_year: 2001,
      cover_i: 321,
      isbn: ["1234567890", "9781234567897"],
      number_of_pages_median: 240,
      edition_count: 4,
      ratings_average: 4.3,
      ratings_count: 81,
      subject: ["Fiction", "Adventure"],
    });

    expect(book).toMatchObject({
      workId: 12345,
      workKey: "/works/OL12345W",
      title: "Example Book",
      authorNames: ["Author One", "Author Two"],
      firstPublishYear: 2001,
      coverUrl: "https://covers.openlibrary.org/b/id/321-M.jpg?default=false",
      isbn: "9781234567897",
      pageCount: 240,
      editionCount: 4,
      ratingsAverage: 4.3,
      ratingsCount: 81,
      subjects: ["Fiction", "Adventure"],
    });
  });

  it("drops documents without valid work identifiers or titles", () => {
    expect(normalizeOpenLibraryBook({ key: "/books/OL23M", title: "Wrong key" })).toBeNull();
    expect(normalizeOpenLibraryBook({ key: "/works/OL23W", title: " " })).toBeNull();
  });

  it("extracts plain descriptions from strings and Open Library value objects", () => {
    expect(normalizeOpenLibraryDescription({ value: "A <b>short</b> &amp; useful story." })).toBe("A short & useful story.");
    expect(normalizeOpenLibraryDescription("A plain description.")).toBe("A plain description.");
    expect(normalizeOpenLibraryDescription({ type: "/type/text" })).toBeNull();
  });

  it("caches repeated paginated searches in process memory", async () => {
    const query = `cache-check-${Date.now()}-${Math.random()}`;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      numFound: 1,
      docs: [{ key: "/works/OL876543W", title: "Cached title", author_name: ["A. Writer"] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await searchOpenLibraryBooks(query, 1, 20);
    const second = await searchOpenLibraryBooks(query, 1, 20);

    expect(first.results[0]?.title).toBe("Cached title");
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
