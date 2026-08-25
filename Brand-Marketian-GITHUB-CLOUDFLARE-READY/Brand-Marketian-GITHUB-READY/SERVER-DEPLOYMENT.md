# Backend deployment

The backend lives in `server/` and is a Node.js/Express API using MongoDB.

1. Deploy `server/` to a Node-compatible host.
2. Run `npm install`.
3. Set all variables from `server/.env.example` as production environment variables.
4. Set `CORS_ORIGIN` to the production website origin, e.g. `https://brandmarketian.com`.
5. Start with `npm start`.
6. Verify `GET /api/health` returns `{ "ok": true }`.

Never upload a real `.env` file or database/JWT/SMTP credentials to GitHub.
