# Hardcover book catalog

Blinkr reads public book metadata from the Hardcover GraphQL API on the server. The home screen uses trending book IDs; search resolves ranked results to book records; and book details include available authors, description, cover, publication information, edition ISBN and aggregate ratings. Missing fields remain empty rather than being invented. Hardcover's catalog is continually updated, and the API may change.

## Configuration

Set `Hardcover_API` on the Render **Blinkr** service to a Hardcover API token. The server also accepts `HARDCOVER_API_TOKEN` or `HARDCOVER_API_KEY` if the preceding names are not set. Either the bare token or `Bearer <token>` is accepted; the server sends exactly one Bearer prefix. Never put this value in source control, a client-side environment variable, a mobile bundle, or logs. The token must be unexpired and have catalog search and data access, such as `read:catalog`. Regenerate or replace it in Render if it is revoked or expires. Changing a service environment variable can cause Render to redeploy, according to the dashboard's selected action.

The server caches search and trending responses for five minutes and book details for six hours, in process memory. Rate limits and availability are controlled by Hardcover. Responses can omit covers, ISBNs, descriptions or other metadata. Do not treat a missing cover as evidence that a book does not exist.

The GraphQL API returns ordered search and trending IDs; Blinkr preserves that order when retrieving full records. Each ISBN identifies a specific edition, not the work itself. Aggregate rating data and book information are attributed to Hardcover in the app.

Identical in-flight GraphQL requests are coalesced; the server also applies a best-effort per-process limit of 45 upstream requests per minute and eight concurrent requests. These controls reset on restart and do not replace provider quotas or per-client abuse protection.

**Existing library records:** new book reviews and reading statuses carry only `mediaSource: "hardcover"`; no Open Library book source is supported or fetched by the app. Existing nullable records are preserved and are not rewritten. A legacy row with no source remains separate from new Hardcover rows, so it cannot overwrite a newly saved Hardcover row.

## Verification

Run `pnpm exec vitest run tests/hardcover.test.ts`, `pnpm check`, and `pnpm build`. These tests use mocked API responses and do not verify that the Render token is valid. To verify the deployed service, call the public `books.trending`, `books.search`, and `books.detail` tRPC procedures and confirm that real results include metadata and cover URLs. Do not log or expose the API key.

The web app is published from the root of the repository on GitHub Pages. After changing client source, regenerate the Expo web export with `EXPO_BASE_URL=/Blinkr` and `EXPO_PUBLIC_API_BASE_URL=https://blinkr-5o8q.onrender.com`, and update the generated web files in the repository. A backend-only deploy does not rebuild the mobile app or its installed APK.

Hardcover states that images can be user-uploaded and recommends a DMCA takedown policy for sites that display them publicly; verify the application's copyright policy and the provider's terms before public or commercial use.

References: [Hardcover API getting started](https://docs.hardcover.app/api/getting-started/), [search](https://docs.hardcover.app/api/guides/searching/), [books](https://docs.hardcover.app/api/graphql/schemas/books/).
