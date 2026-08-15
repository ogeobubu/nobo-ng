# Assessment

A full-stack storefront prototype with a React + TypeScript frontend, a Node.js REST API backend, and MySQL persistence.

## Stack

- Frontend: Vite, React, TypeScript, React Query
- Backend: Node.js, Express, REST APIs
- Database: MySQL

## Project structure

```text
nobo-ng/
├── backend/
│   ├── package.json
│   ├── schema.sql
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── catalog.js
│       ├── config.js
│       ├── db.js
│       └── services/
│           ├── orders.js
│           └── products.js
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── index.css
│   │   ├── main.tsx
│   │   ├── types.ts
│   │   └── vite-env.d.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── package.json
├── scripts/
│   └── dev.mjs
└── README.md
```

## Local setup

1. Create a MySQL database and user, or use an existing instance.
2. Apply the schema in [`backend/schema.sql`](backend/schema.sql).
3. Create environment variables for the backend:

   ```bash
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=nobong
   PORT=4000
   CORS_ORIGIN=http://localhost:5173
   ```

4. Install dependencies at the repo root:

   ```bash
   npm install
   ```

5. Start both apps:

   ```bash
   npm run dev
   ```

6. Open the frontend:

   ```text
   http://localhost:5173
   ```

## API

- `GET /api/health`
- `GET /api/products`
- `GET /api/orders`
- `POST /api/checkout`

## Notes

- The frontend uses React Query to fetch products and submit checkout requests.
- The backend uses MySQL transactions so checkout and stock updates stay consistent.
- Orders are persisted in MySQL, not in local JSON files.
- If you deploy the frontend and backend separately, set `VITE_API_BASE_URL` in the frontend build environment.

## Scripts

- `npm run dev` starts both backend and frontend
- `npm run dev:backend` starts only the backend
- `npm run dev:frontend` starts only the frontend
- `npm run build:frontend` builds the Vite app
