import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../server/_core/env";
import { getComicVineComic, searchComicVine } from "../server/comic-vine";

const originalKey = ENV.comicVineApiKey;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

describe("Comic Vine integration", () => {
  beforeEach(() => { ENV.comicVineApiKey = "test-comicvine-key"; });
  afterEach(() => {
    ENV.comicVineApiKey = originalKey;
    vi.unstubAllGlobals();
  });

  it("uses the server key and filters search results without covers", async () => {
    const query = `cover-filter-${Date.now()}`;
    const fetchMock = vi.fn(async () => jsonResponse({
      status_code: 1,
      number_of_total_results: 2,
      results: [
        { id: 4001, name: "No cover", image: null },
        { id: 4002, resource_type: "issue", name: "Has cover", image: { original_url: "https://comicvine.gamespot.com/cover.jpg" }, publisher: { name: "Publisher" } },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchComicVine(query, 1, 20);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ id: 4002, resourceType: 'issue', title: "Has cover", coverUrl: "https://comicvine.gamespot.com/cover.jpg" });
    const request = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(request[0])).toContain("api_key=test-comicvine-key");
  });
});


  it("preserves volume identity and requests the volume endpoint instead of an issue with the same numeric suffix", async () => {
    const id = 987654321;
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      expect(url).toContain(`/volume/4050-${id}/`);
      return jsonResponse({
        status_code: 1,
        results: {
          id: `4050-${id}`,
          resource_type: "volume",
          api_detail_url: `https://comicvine.gamespot.com/api/volume/4050-${id}/`,
          name: "Volume identity test",
          image: { original_url: "https://comicvine.gamespot.com/volume-cover.jpg" },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getComicVineComic(id, "volume");
    expect(result).toMatchObject({ id, resourceType: "volume", title: "Volume identity test" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
