import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../server/_core/env";
import { getHardcoverBook, getHardcoverTrendingBooks, searchHardcoverBooks } from "../server/hardcover";

const originalToken = ENV.hardcoverApiToken;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => { ENV.hardcoverApiToken = "test-secret"; });
afterEach(() => {
  ENV.hardcoverApiToken = originalToken;
  vi.unstubAllGlobals();
});

describe("Hardcover integration", () => {
  it.each(["test-secret", "Bearer test-secret", " bearer   test-secret  "])("sends one Bearer prefix for configured token %s", async (token) => {
    ENV.hardcoverApiToken = token;
    const fetchMock = vi.fn(async () => jsonResponse({ data: { books: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getHardcoverBook(Math.floor(Math.random() * 1_000_000_000) + 1)).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(request[0]).toBe("https://api.hardcover.app/v1/graphql");
    expect((request[1].headers as Record<string, string>).Authorization).toBe("Bearer test-secret");
  });

  it("hydrates ordered search IDs and retains metadata from Typesense documents", async () => {
    const query = `test-search-${Date.now()}`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { search: {
        ids: [402, 401],
        results: { found: 43, hits: [
          { document: { id: "402", title: "Second", author_names: ["Writer B"], genres: ["Fantasy"], isbns: ["9781234567897"] } },
          { document: { id: "401", title: "First", author_names: ["Writer A"] } },
        ] },
      } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { books: [
        { id: 401, title: "First", slug: "first", image: { url: "https://assets.hardcover.app/first.jpg" }, contributions: [{ author: { name: "Writer A" } }] },
        { id: 402, title: "Second", slug: "second", rating: "4.25", image: { url: "https://assets.hardcover.app/second.jpg" }, contributions: [{ author: { name: "Writer B" } }] },
      ] } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchHardcoverBooks(query, 2, 2);
    expect(result.results.map((book) => book.workId)).toEqual([402, 401]);
    expect(result).toMatchObject({ page: 2, limit: 2, totalResults: 43, totalPages: 22 });
    expect(result.results[0]).toMatchObject({
      title: "Second", authorNames: ["Writer B"], coverUrl: "https://assets.hardcover.app/second.jpg",
      ratingsAverage: 4.25, isbn: "9781234567897", subjects: ["Fantasy"], sourceUrl: "https://hardcover.app/books/second",
    });
    const searchBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(searchBody.variables).toEqual({ query, page: 2, per_page: 2 });
    expect(await searchHardcoverBooks(query, 2, 2)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles raw result arrays without applying normalization twice", async () => {
    const query = `raw-results-${Date.now()}`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { search: { ids: [], results: [{ id: 403, title: "Raw title", image: { url: "https://example.org/cover.jpg" } }] } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { books: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchHardcoverBooks(query, 1, 20);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ workId: 403, title: "Raw title", coverUrl: "https://example.org/cover.jpg" });
  });

  it("preserves trending ranking rather than database return order", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { books_trending: { ids: [503, 501, 502], error: null } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { books: [
        { id: 501, title: "One", author_names: ["Same Author"], image: { url: "https://assets.hardcover.app/one.jpg" } }, { id: 502, title: "Two", author_names: ["Different Author"], image: { url: "https://assets.hardcover.app/two.jpg" } }, { id: 503, title: "Three", author_names: ["Same Author"], image: { url: "https://assets.hardcover.app/three.jpg" } },
      ] } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getHardcoverTrendingBooks(3)).map((book) => book.workId)).toEqual([503, 502, 501]);
  });

  it("normalizes the details of a book including edition ISBN and fallback cover", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { books: [{
      id: 901234, title: " A book ", slug: "a-book", description: "<p>Some description</p>",
      pages: 300, release_date: "2020-06-10", release_year: 2020, rating: 4.5, ratings_count: 87,
      editions_count: 3, image: null, contributions: [
        { author: { name: " Author " }, contributor_role: { slug: "author" } },
        { author: { name: "Translator" }, contributor_role: { slug: "translator" } },
      ],
      default_physical_edition: { isbn_13: "9781234567897" },
      default_cover_edition: { image: { url: "https://assets.hardcover.app/fallback.jpg" } },
      cached_tags: { Genre: [{ tag: "Fiction" }] },
    }] } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getHardcoverBook(901234)).toMatchObject({
      workId: 901234, title: "A book", authorNames: ["Author"], description: "Some description",
      coverUrl: "https://assets.hardcover.app/fallback.jpg", isbn: "9781234567897", subjects: ["Fiction"],
      pageCount: 300, firstPublishYear: 2020, ratingsAverage: 4.5, ratingsCount: 87,
    });
  });

  it("provides a safe error for bad credentials instead of exposing provider details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "invalid_request", error_description: "Invalid Authorization format" }, 400)));
    await expect(getHardcoverBook(901235)).rejects.toMatchObject({ status: 401, message: "مفتاح Hardcover غير صالح أو لا يملك صلاحية قراءة الكتالوج." });
  });

  it("does not turn a provider trending error into an empty successful result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { books_trending: { ids: [], error: "upstream failure" } } })));
    await expect(getHardcoverTrendingBooks(7)).rejects.toThrow("تعذر تحميل الكتب الرائجة من Hardcover.");
  });

  it("does not turn a provider search error into an empty successful result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { search: { ids: [], results: null, error: "upstream failure" } } })));
    await expect(searchHardcoverBooks(`search-error-${Date.now()}`)).rejects.toThrow("تعذر البحث عن الكتب في Hardcover.");
  });

  it("rejects malformed successful responses and unsafe cover URLs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: {} }))
      .mockResolvedValueOnce(jsonResponse({ data: { books: [{ id: 901237, title: "Unsafe", image: { url: "https://127.0.0.1/private" } }] } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getHardcoverBook(901236)).rejects.toThrow("غير مكتملة");
    await expect(getHardcoverBook(901237)).rejects.toThrow("لم يُعثر على الكتاب في Hardcover.");
  });

  it("coalesces simultaneous identical requests", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: { books: [{ id: 901238, title: "Shared request", image: { url: "https://assets.hardcover.app/shared.jpg" } }] } }));
    vi.stubGlobal("fetch", fetchMock);
    const [first, second] = await Promise.all([getHardcoverBook(901238), getHardcoverBook(901238)]);
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
