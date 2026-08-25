# Deploy to GitHub + Cloudflare

## 1. GitHub

Upload the **contents of this folder** to the root of the `Brand-Marketian` repository. Keep the folders exactly as they are:

```text
frontend/
server/
wrangler.jsonc
.gitignore
README.md
```

Do not upload `node_modules/` or any `.env` file.

## 2. Cloudflare Worker

Create/connect the Worker to the GitHub repository and use:

- Build command: `None` / blank
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Do not set the asset directory to `.`. `wrangler.jsonc` already tells Wrangler to use `./frontend`.

## 3. Expected result

Cloudflare should deploy the files under `frontend/` only. It must not scan `server/` or `node_modules/` as website assets.

## 4. Domain

After the Worker deploys successfully, open the Worker **Domains** section and add `brandmarketian.com` (and `www` if required).

## 5. Backend

The API is a Node/Express + MongoDB application and is not deployed by the static frontend Worker. Deploy `server/` separately on a Node-compatible host, then set the production API URL in the frontend's `bm-api` metadata / `window.BM_API` configuration when the API is ready.
