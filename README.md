# Fava — Streaming File Gateway

Small full-stack project for uploading and downloading large files without parking them on disk or loading the whole thing into memory. Files stream through Express into MinIO (S3-compatible). UI is Nuxt (SSR, Persian RTL). Everything runs with Docker Compose.

## Prerequisites

- Docker + Docker Compose
- A couple GB of free disk for images/volumes

## Run

```bash
git clone https://github.com/mhmd-rouhani/fava-streaming-gateway.git
cd fava-streaming-gateway
docker-compose up -d
```

If your machine only has Compose V2:

```bash
docker compose up -d
```

First run builds the images. After code changes, use `docker compose up -d --build`.

App: **http://localhost:8080**

| What | Where |
|------|--------|
| App (Nginx) | http://localhost:8080 |
| MinIO API | http://localhost:9000 |
| MinIO console | http://localhost:9001 (`minioadmin` / `minioadmin`) |

Stop with `docker compose down`. Add `-v` if you also want to wipe stored files.

Optional: copy `.env.example` to `.env`. Defaults work fine without it.

## Architecture

```
Browser
   │
   ▼
 Nginx :8080
   ├── /      → Nuxt (SSR)
   └── /api/  → Express (≤150MB) ──stream──▶ MinIO (S3)
```

Nginx sits in front and turns off request buffering, so upload bodies aren't held on the proxy. Express reads multipart with Busboy and sends the stream to MinIO through `@aws-sdk/lib-storage` (5MB parts, one at a time). Downloads go the other way: MinIO → Express → client. No temp files on the backend disk.

Why the backend stays under 150MB:

- no multer / disk storage
- no `express.json()` on the upload path
- S3 multipart with `queueSize: 1`
- Nginx `proxy_request_buffering off`
- Docker `mem_limit: 150m` on the backend service

## Project structure

```
├── docker-compose.yml
├── .env.example
├── .github/workflows/ci.yml
├── nginx/nginx.conf
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── routes/files.js
│       ├── services/storage.js
│       └── middleware/
└── frontend/
    ├── Dockerfile
    ├── nuxt.config.ts
    ├── pages/
    ├── components/
    └── utils/
```

## Design choices

- Object keys look like `{timestamp}-{uuid8}-{originalName}` so they stay unique and still readable.
- One file per upload request.
- Default max upload size is 5GB (`MAX_UPLOAD_BYTES`).
- Rate limits are per IP (15 min window): 30 uploads, 120 other `/files` calls.
- Bucket `uploads` is created on backend startup, with retries while MinIO comes up.
- MinIO credentials in the defaults are demo-only — change them via `.env` if this ever leaves your machine.
- Frontend talks to `/api` on the same origin through Nginx, so the browser never hits MinIO directly.
- Kept the bonus list short on purpose. Quality over feature pile-up — no Keycloak, no chunk/resume.

## Testing upload / download

1. `docker-compose up -d`
2. Open http://localhost:8080
3. Drop a file (or pick one)
4. Check it shows up in the list
5. Download it and confirm it matches
6. Optional: `docker stats` — backend should stay under 150MB during a large upload

curl:

```bash
curl -X POST http://localhost:8080/api/files/upload -F "file=@./README.md"
curl http://localhost:8080/api/files
curl -OJ "http://localhost:8080/api/files/<key>/download"
```

Rate limit smoke test (you should start seeing `429` after ~30 uploads):

```bash
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -F "file=@./README.md" http://localhost:8080/api/files/upload
done
```

## Bonus features

| Item | Done? |
|------|-------|
| Nuxt SSR | yes |
| Rate limiting | yes |
| CI/CD (GitHub Actions) | yes |
| Request logging (`morgan`) + Helmet | yes |
| Chunk upload | no |
| Resume upload | no |
| Keycloak / forward auth | no |
| Integration tests | no |

## API

Base path behind the proxy: `/api`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/health` | not rate-limited |
| `GET` | `/files` | list |
| `POST` | `/files/upload` | multipart field `file` |
| `GET` | `/files/:key/download` | streamed download |
| `GET` | `/files/:key/meta` | metadata |
| `DELETE` | `/files/:key` | delete |

## Limitations

- UI progress is client → gateway, not S3 part progress.
- No user auth. Fine for a local challenge demo; don't expose it publicly as-is.
- MinIO ports `9000`/`9001` are published for debugging — remove them from compose if you don't need them.
