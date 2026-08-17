# Assessment

A full-stack storefront prototype with a React + TypeScript frontend, a React Native + Expo mobile app, a Node.js REST API backend, and MySQL persistence.

## Stack

- Frontend: Vite, React, TypeScript, React Query
- Mobile: Expo, React Native, Tailwind via NativeWind
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
├── mobile/
│   ├── App.tsx
│   ├── app.json
│   ├── babel.config.js
│   ├── global.css
│   ├── index.js
│   ├── metro.config.js
│   ├── nativewind-env.d.ts
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── types.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
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
3. Create `backend/.env` from [`backend/.env.example`](backend/.env.example):

   ```bash
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=nobong
   PORT=4000
   HOST=0.0.0.0
   CORS_ORIGIN=http://localhost:5173
   ```

4. Create `frontend/.env.local` from [`frontend/.env.example`](frontend/.env.example):

   ```bash
   VITE_API_BASE_URL=http://localhost:4000
   VITE_HOST=127.0.0.1
   VITE_PORT=3000
   ```

5. Create `mobile/.env.local` from [`mobile/.env.example`](mobile/.env.example):

   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
   ```

   If you are running the app on an Android emulator, use `http://10.0.2.2:4000`.
   If you are testing on a physical device, use your Mac's LAN IP address instead.

6. Install dependencies at the repo root:

   ```bash
   yarn install
   ```

7. Start the web stack locally:

   ```bash
   yarn dev
   ```

8. Open the frontend:

   ```text
   http://localhost:3000
   ```

   This command starts the local backend and frontend workspace processes.
   If `4000` is already in use, the backend launcher will pick the next free port and print it in the terminal.

9. Start the mobile app in a separate terminal:

   ```bash
   yarn dev:mobile
   ```

   Expo will start the React Native app and connect it to the backend URL from `mobile/.env.local`.

10. Or start backend, web, and mobile together from the root:

    ```bash
    yarn dev:all
    ```

    This command starts the backend, the Vite frontend, and the Expo mobile app in one shot.
    It also injects a LAN-based API URL into the mobile app so a physical device can reach the backend during local development.

## Docker

To run the full stack with MySQL, backend, and frontend together:

```bash
yarn dev:docker
```

This starts:

- MySQL on port `3306`
- Backend on port `4000`
- Frontend on port `3000`

The container setup uses the same source tree, so changes on your host are reflected in the running app.

## API

- `GET /api/health`
- `GET /api/products`
- `GET /api/orders`
- `POST /api/checkout`

## Notes

- The frontend uses React Query to fetch products and submit checkout requests.
- The mobile app uses Expo, NativeWind, and the same backend checkout API.
- The backend uses MySQL transactions so checkout and stock updates stay consistent.
- Orders are persisted in MySQL, not in local JSON files.
- If you deploy the frontend and backend separately, set `VITE_API_BASE_URL` in the frontend build environment.
- If you run the mobile app against a device or emulator, set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env.local`.

## Scripts

- `yarn dev` starts the local backend and frontend together
- `yarn dev:local` starts the local backend and frontend workspace processes
- `yarn dev:all` starts the backend, frontend, and mobile app together
- `yarn dev:docker` starts MySQL, backend, and frontend together
- `yarn dev:backend` starts only the backend
- `yarn dev:frontend` starts only the frontend
- `yarn dev:mobile` starts the Expo mobile app
- `yarn build:frontend` builds the Vite app
- `docker compose up --build` also starts MySQL, backend, and frontend together
