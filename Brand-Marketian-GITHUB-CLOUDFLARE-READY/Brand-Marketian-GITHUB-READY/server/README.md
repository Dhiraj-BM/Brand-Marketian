# Brand Marketian API

Node + Express + MongoDB backend for the Brand Marketian website.

## Run locally

    cd server
    cp .env.example .env      # fill SMTP + JWT_SECRET
    npm install
    npm run seed              # creates the admin user and demo content
    npm run dev               # http://localhost:4000

## Public endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /api/leads | Contact + footer forms (rate limited, emails + WhatsApp ping) |
| POST | /api/newsletter | Newsletter signup |
| POST | /api/applications | Careers form, multipart with \`resume\` file |
| GET | /api/posts, /api/posts/:slug | Blog |
| GET | /api/case-studies, /api/case-studies/:slug | Work (filter ?segment=d2c\|b2b\|local) |
| GET | /api/jobs | Open roles |
| GET | /api/health | Uptime check |

## Admin endpoints (JWT, Bearer token)

| Method | Path |
|---|---|
| POST | /api/admin/auth/login |
| GET | /api/admin/auth/me |
| GET / PATCH | /api/admin/leads, /api/admin/leads/:id |
| GET | /api/admin/stats |
| CRUD | /api/admin/posts, /api/admin/case-studies, /api/admin/jobs |
| GET | /api/admin/applications, /api/admin/subscribers |

### CMS content workflow (draft → review → publish)

| Method | Path | Who |
|---|---|---|
| GET | /api/admin/content | all signed-in |
| GET | /api/admin/content/:key | all signed-in |
| PUT | /api/admin/content/:key/draft | editor+ |
| POST | /api/admin/content/:key/submit | editor+ |
| POST | /api/admin/content/:key/revert-draft | editor+ |
| POST | /api/admin/content/:key/approve | admin+ |
| POST | /api/admin/content/:key/publish | admin+ |
| GET | /api/admin/content/:key/versions | all signed-in |
| POST | /api/admin/content/:key/restore/:versionId | editor+ |

`data` = the published content the public site reads via `GET /api/content/:key`
(unchanged). `draft` never reaches the public site until someone publishes.

### Media & users

| Method | Path | Who |
|---|---|---|
| GET / POST / PATCH | /api/admin/media | editor+ (delete: admin+) |
| GET / POST / PATCH / DELETE | /api/admin/users | super_admin |

Roles: `super_admin`, `admin`, `editor`, `designer`, `viewer`
(`client` is legacy, treated as viewer). Only super_admin and admin can publish.

## Collections

leads, subscribers, posts, caseStudies, jobs, applications, users, siteContents, media.

## Wiring the frontend

Set one constant in the site and point the forms at it:

    const API = 'https://api.brandmarketian.com';
    fetch(API + '/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

## Deploy notes

- Mongo Atlas for the database, Railway / Render / any Node host for the API.
- Set CORS_ORIGIN to the site's real domain before going live.
- Resume uploads land in \`server/uploads\`; mount a volume or swap the multer storage for S3 / Cloudinary.
