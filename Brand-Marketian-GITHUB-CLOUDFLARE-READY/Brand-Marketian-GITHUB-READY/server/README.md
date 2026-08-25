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

## Collections

leads, subscribers, posts, caseStudies, jobs, applications, users.

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
