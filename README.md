# Fava — Streaming Gateway & Large File Management

چالش فنی استخدام: درگاه استریم و مدیریت فایل‌های حجیم.

یک Full-stack file gateway که آپلود/دانلود فایل‌های حجیم را **به‌صورت Streaming** از طریق Express به Object Storage سازگار با S3 (MinIO) انجام می‌دهد — بدون ذخیره روی دیسک Backend و بدون بافر کردن کل فایل در حافظه.

---

## خروجی‌های مورد انتظار (Deliverables)

این مخزن شامل موارد خواسته‌شده در صورت‌مسئله است:

| مورد | وضعیت |
|------|--------|
| سورس‌کد کامل پروژه | ✅ |
| فایل `docker-compose.yml` | ✅ |
| فایل `README.md` | ✅ (همین فایل) |
| فایل‌های کانفیگ لازم (`.env.example`, Nginx, Dockerfiles, CI) | ✅ |
| اجرای پروژه فقط با `docker-compose up -d` | ✅ |

پس از Push، **لینک همین ریپازیتوری GitHub/GitLab** را برای شرکت ارسال کنید.

---

## پیش‌نیازها و نحوه اجرا

### پیش‌نیازها

- Docker Engine
- Docker Compose v2 (دستور `docker compose` یا باینری قدیمی `docker-compose`)
- حدود ۲GB فضای دیسک برای imageها و volume

### اجرا (طبق صورت‌مسئله)

```bash
git clone <REPO_URL>
cd Fava
docker-compose up -d
```

اگر روی سیستم شما فقط Compose V2 نصب است:

```bash
docker compose up -d
```

> در اولین اجرا، Compose سرویس‌هایی که `build` دارند را خودکار بیلد می‌کند. اگر بعداً کد را عوض کردید: `docker compose up -d --build`

### آدرس‌ها

| سرویس | آدرس |
|--------|------|
| اپلیکیشن (از طریق Nginx) | http://localhost:8080 |
| MinIO API (اختیاری / دیباگ) | http://localhost:9000 |
| MinIO Console (اختیاری) | http://localhost:9001 — کاربر/رمز: `minioadmin` / `minioadmin` |

### توقف

```bash
docker-compose down
# یا
docker compose down
```

پاک کردن داده‌های ذخیره‌شده (volume):

```bash
docker compose down -v
```

تنظیمات اختیاری: فایل `.env.example` را به `.env` کپی کنید. بدون `.env` هم با مقادیر پیش‌فرض اجرا می‌شود.

---

## توضیح معماری سیستم

```
Browser
   │
   ▼
┌─────────────┐     /          ┌──────────────┐
│   Nginx     │───────────────▶│  Nuxt (SSR)  │
│  :8080      │                └──────────────┘
│  (proxy)    │     /api/      ┌──────────────┐     stream      ┌──────────┐
│             │───────────────▶│   Express    │───────────────▶│  MinIO   │
└─────────────┘                │  mem ≤150MB  │   Put/Get      │  (S3)    │
                               │  rate-limit  │                └──────────┘
                               └──────────────┘
```

| جزء | نقش |
|-----|-----|
| **Nginx** | Reverse Proxy. با `proxy_request_buffering off` بدنه آپلود را بافر نمی‌کند تا Streaming واقعی بماند. |
| **Nuxt 3** | رابط کاربری SSR برای آپلود، لیست و دانلود (UI فارسی RTL). |
| **Express** | با **Busboy** multipart را استریم می‌کند و با **`@aws-sdk/lib-storage`** به MinIO می‌فرستد. دانلود هم `GetObject` را مستقیم به کلاینت pipe می‌کند. |
| **MinIO** | Object Storage سازگار با S3. |

### چرا حافظه Backend زیر ۱۵۰MB می‌ماند؟

1. بدون `multer` (نه دیسک، نه بافر کامل در RAM)
2. بدون `express.json()` روی مسیر آپلود — درخواست خام به Busboy pipe می‌شود
3. آپلود Multipart به S3 با `partSize: 5MB` و `queueSize: 1`
4. Nginx: `proxy_request_buffering off` + `proxy_max_temp_file_size 0`
5. محدودیت Docker: `mem_limit: 150m` روی سرویس backend

---

## ساختار پروژه

```
Fava/
├── docker-compose.yml          # ارکستراسیون همه سرویس‌ها
├── .env.example                # نمونه متغیرهای محیطی
├── .github/workflows/ci.yml    # CI
├── nginx/nginx.conf            # Reverse proxy + streaming
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── routes/files.js
│       ├── services/storage.js
│       └── middleware/
│           ├── errorHandler.js
│           └── rateLimit.js
├── frontend/
│   ├── Dockerfile
│   ├── nuxt.config.ts
│   ├── app.vue
│   ├── pages/index.vue
│   ├── components/
│   │   ├── HeroHeader.vue
│   │   ├── FileUpload.vue
│   │   └── FileList.vue
│   ├── utils/format.ts
│   └── assets/css/main.css
└── README.md
```

---

## فرضیات و تصمیمات طراحی

- **کلید فایل‌ها:** `{timestamp}-{uuid8}-{sanitizedOriginalName}` برای یکتایی + خوانایی
- **یک فایل در هر درخواست** (`files: 1` در Busboy)
- **سقف حجم آپلود:** پیش‌فرض ۵GiB (`MAX_UPLOAD_BYTES`) — با `Content-Length` و `fileSize` در Busboy
- **Rate limit:** per IP در پنجره ۱۵ دقیقه‌ای — ۳۰ آپلود / ۱۲۰ درخواست دیگر روی `/files`
- **Bucket** به نام `uploads` در استارت Backend ساخته/چک می‌شود (با retry تا آماده شدن MinIO)
- **اعتبارنامه MinIO** پیش‌فرض دموی محلی است (`minioadmin`) — برای محیط واقعی از `.env` عوض شود
- **Frontend** فقط با `/api` روی همان origin حرف می‌زند (از طریق Nginx) تا مرورگر مستقیم به MinIO وصل نشود
- **SSR** در Nuxt فعال است
- **UI فارسی و RTL** برای تجربه کاربری بومی
- **کیفیت طراحی مهم‌تر از تعداد فیچر** — عمداً Keycloak و Chunk/Resume اضافه نشد تا معماری ساده و قابل دفاع بماند

---

## نحوه تست Upload / Download

### از UI

1. پروژه را بالا بیاورید: `docker-compose up -d`
2. مرورگر: http://localhost:8080
3. یک فایل را Drag & Drop کنید یا انتخاب کنید
4. در بخش «فایل‌ها» ظاهر شدن آن را ببینید
5. روی **دانلود** بزنید و فایل را بررسی کنید
6. (اختیاری) حافظه Backend را ببینید:

```bash
docker stats
```

سرویس backend باید حتی هنگام آپلود فایل بزرگ زیر **۱۵۰MB** بماند.

### با curl

```bash
# Upload
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@./README.md"

# List
curl http://localhost:8080/api/files

# Download (کلید را از پاسخ list بردارید)
curl -OJ "http://localhost:8080/api/files/<key>/download"
```

### تست سریع Rate Limit

```bash
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -F "file=@./README.md" http://localhost:8080/api/files/upload
done
```

بعد از حدود ۳۰ آپلود در ۱۵ دقیقه باید `429` ببینید.

---

## لیست بخش‌های امتیازی پیاده‌سازی‌شده

| بخش امتیازی | وضعیت |
|-------------|--------|
| Nuxt SSR | ✅ پیاده‌سازی شده |
| Rate Limiting | ✅ با `express-rate-limit` (سخت‌گیرانه‌تر روی upload) |
| CI/CD | ✅ GitHub Actions (syntax بک‌اند، بیلد Nuxt، validate کردن compose) |
| Logging | ✅ `morgan` + هدرهای امنیتی Helmet |
| Chunk Upload | ❌ (عمداً خارج از اسکوپ برای تمرکز روی طراحی) |
| Resume Upload | ❌ |
| Forward Auth / Keycloak | ❌ |
| Integration Tests | ❌ |

---

## API (مرجع کوتاه)

Base (از طریق پروکسی): `/api`

| Method | Path | توضیح |
|--------|------|--------|
| `GET` | `/health` | Health (بدون rate limit) |
| `GET` | `/files` | لیست فایل‌ها |
| `POST` | `/files/upload` | آپلود استریمی (فیلد `file`) |
| `GET` | `/files/:key/download` | دانلود استریمی |
| `GET` | `/files/:key/meta` | متادیتا |
| `DELETE` | `/files/:key` | حذف |

---

## محدودیت‌ها (طبق خواست صورت‌مسئله)

- پیشرفت آپلود در UI مربوط به مسیر **کلاینت → Gateway** است، نه پیشرفت پارت‌های S3.
- احراز هویت کاربر نهایی وجود ندارد — برای دموی چالش؛ برای اینترنت عمومی مناسب نیست.
- پورت‌های MinIO (`9000`/`9001`) برای راحتی دیباگ publish شده‌اند؛ در صورت نیاز می‌توان از `docker-compose.yml` حذف کرد.

---

## امنیت و مدیریت خطا

- Helmet برای هدرهای امنیتی HTTP
- Sanitize نام فایل؛ نام خالی رد می‌شود
- سقف حجم → `413`
- Rate limit → `429`
- Error handler مرکزی؛ در production استک‌تریس لو نمی‌رود
- پاکسازی object ناقص در MinIO اگر آپلود به‌خاطر سقف حجم قطع شود

---

## License

Challenge submission — برای ارزیابی آزادانه قابل استفاده است.
