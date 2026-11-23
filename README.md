# Eagler Vault

A black-and-mint, local-first Eaglercraft launcher for Vercel. Version and client-type filters and search run entirely in the browser: no server pings, remote search, analytics, fonts, or image services.

## Local preview

Use Node.js 22.9+ (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Local development streams the original uploaded HTML files without copying 2 GB into a build.

## Upload clients and deploy to Vercel

1. Create a **public Vercel Blob store** in the Vercel project's Storage tab. Only upload clients you are authorized to distribute.
2. Copy `.env.example` to `.env.local` and set `BLOB_READ_WRITE_TOKEN` locally. Never commit or put this token in the browser, catalog, or a `NEXT_PUBLIC_` environment variable.
3. Run:

   ```sh
   npm ci
   npm run catalog
   npm run upload
   ```

   Uploads are sequential, streamed, multipart, and content-addressed. Identical files are stored once. Re-running skips existing blobs with the expected size; failures stop explicitly. Uploading the collection uses paid storage/bandwidth where applicable.

4. The upload command prints the public store URL. Set `CLIENT_ASSET_BASE_URL` to that URL in `.env.local` and in Vercel's Production/Preview environment settings. The URL must be HTTPS, for example `https://your-store.public.blob.vercel-storage.com`.
5. Commit the launcher and generated [catalog](data/clients.json), then import the repository into Vercel. [vercel.json](vercel.json) selects the static build and output directory. Original root HTML payloads are excluded by [.vercelignore](.vercelignore); they are **not** bundled into the deployment or sent through a Vercel Function.

   ```sh
   npm run build
   ```

   The build requires the public storage URL and includes only the small launcher plus catalog. It does not upload clients automatically. Upload first, then deploy. No token is needed for the static production build.

**Large files:** several uploads exceed GitHub's 100 MB per-file limit. Original root HTML uploads are Git-ignored to prevent accidental oversized commits. Keep your source uploads backed up separately; the generated catalog is sufficient to build the launcher after uploading to Blob.

## Browser storage and launching

- **Save** downloads one client into Cache Storage. **Download all** saves all playable clients regardless of the current filters, skips previously saved content, and deduplicates byte-identical uploads.
- Bulk downloads show byte progress, support cancellation, and resume remaining files when clicked again. Closing the downloading tab interrupts the active file; completed files remain saved.
- This is browser/origin storage, shared by tabs, **not sessionStorage**. Multi-gigabyte downloads cannot fit in normal tab storage. The UI checks available quota and reports incomplete downloads, HTTP errors, and quota failures. Browsers may impose tighter limits than reported.
- **Keep storage** requests protection from automatic eviction; the browser can decline. Clearing site data, private browsing cleanup, or changing domains removes access to saved clients. Use a stable production domain.
- The service worker saves the launcher shell and serves complete cached HTML clients from `/__clients/<hash>.html`. Launching opens a new tab without an opener, downloads the client if needed, and launches the stored response without creating a huge in-memory Blob URL.
- Pixel's single-build wrappers are started automatically. Their loading overlay is hidden when the game canvas or crash screen is mounted rather than waiting for the missing startup log their wrapper expects. Log targets stay mounted so subsequent boot messages do not throw errors. A small runtime adapter is appended to the served response; original downloads and their content hashes remain unchanged. Other client startup screens are preserved.
- The launcher and self-contained saved clients can open offline. Multiplayer and any assets/servers referenced externally by a client still require internet. WASM/GC clients need a compatible browser.
- Uploaded clients execute as trusted HTML on the launcher origin to preserve game storage and browser APIs. Review uploads before publishing; do not host sensitive applications on this origin. This launcher does not audit or modify third-party client code. Use hack clients only where permitted.
- The server must allow public cross-origin GET requests for browser downloads. Public Vercel Blob URLs support this; if you use another CDN, configure CORS accordingly.

## Catalog maintenance

After adding or replacing root HTML uploads, run `npm run catalog`, then upload and redeploy. SHA-256 IDs change when file contents change, preventing old browser saves from masquerading as new builds. Old versions remain saved until removed; automatic updates do not delete browser game worlds.

Game versions are extracted from filenames and HTML metadata. Tuff builds in this collection are 1.12.2; uncertain versions are labeled **Unknown**. Client types use explicit hack-module strings where available, recognized standard/PvP families, and **Unverified** otherwise. This is a catalog aid, not a safety guarantee; compressed/obfuscated modules may not be detected. Review the generated metadata before publication.

The uploaded [Eaglercraft1.14.html](Eaglercraft1.14.html) is an incomplete informational webpage, not a playable client. It remains visible with an explanation, is stored with the original collection in Blob, and is excluded from playable downloads. Replace it with a real client to enable launching.

## Verification

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Unit tests cover catalog inference, local filters, URL generation, deduplication, storage quotas, truncation, cancellation, and resume. Browser tests use tiny local fixtures to verify the real service worker, offline launches, persistence, download failures/retry, and mobile search without downloading the full collection.

When changing shell assets, increment `SHELL_CACHE` in [public/sw.js](public/sw.js) so installed launchers atomically refresh their offline shell. Client caches are deliberately retained.
