# NoboNG

NoboNG is a full-stack storefront built as a proper workspace setup. It has a Vite frontend, an Expo mobile app, a Node.js REST API, and MySQL for persistence. The idea was to keep the web and mobile experiences clean, modern, and easy to run from one repo.

## Technologies Used

- Frontend: React, TypeScript, Vite, React Query, Tailwind CSS
- Mobile: Expo, React Native, NativeWind, TypeScript
- Backend: Node.js, Express, REST APIs, MySQL
- Tooling: Yarn workspaces, Docker Compose, dotenv

## Instructions for Running the Application

### 1. Install dependencies

From the project root:

```bash
yarn install
```

### 2. Set up the backend

Create `backend/.env` from `backend/.env.example`.

Example:

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=nobong
PORT=4000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

Make sure your MySQL database exists, then apply `backend/schema.sql`.

### 3. Set up the frontend

Create `frontend/.env.local` from `frontend/.env.example`.

Example:

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_HOST=127.0.0.1
VITE_PORT=3000
```

### 4. Set up the mobile app

Create `mobile/.env.local` from `mobile/.env.example`.

Example:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

If you are using:

- iOS simulator: `localhost` works fine
- Android emulator: use `http://10.0.2.2:4000`
- physical device: use your Mac LAN IP, for example `http://192.168.1.10:4000`

### 5. Run the apps

If you only want the web app and backend:

```bash
yarn dev
```

If you want backend, web, and mobile together:

```bash
yarn dev:all
```

If you want the iOS simulator specifically:

```bash
yarn dev:all:ios
```

If you only want the mobile app:

```bash
yarn dev:mobile
```

The frontend usually runs on:

```text
http://localhost:3000
```

## Project / Architecture Structure

```text
nobo-ng/
├── backend/
│   ├── schema.sql
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── config.js
│       ├── db.js
│       └── services/
│           ├── orders.js
│           └── products.js
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── types.ts
│   └── vite.config.ts
├── mobile/
│   ├── App.tsx
│   ├── app.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── types.ts
│   └── tailwind.config.js
├── scripts/
│   ├── dev.mjs
│   └── dev-all.mjs
└── README.md
```

How the pieces fit together:

- The backend exposes the REST API and talks to MySQL.
- The frontend uses React Query to fetch products and submit checkout requests.
- The mobile app uses the same backend API, just with a native interface.
- `scripts/dev.mjs` starts the web stack.
- `scripts/dev-all.mjs` starts web plus mobile, and also handles the iOS simulator case.

## Key Technical Decisions

- I kept the frontend, backend, and mobile app in separate workspaces so each one can have its own dependencies and build setup.
- The backend uses REST APIs instead of trying to share UI logic with the clients. That keeps it simple and easier to deploy.
- Checkout writes to MySQL inside a transaction, so stock updates and order creation stay in sync.
- The frontend uses React Query because the catalog data is server-driven and benefits from caching and invalidation.
- The mobile app uses Expo because it gives a good developer experience on iOS and Android without fighting native setup too early.
- Tailwind was used on the frontend, and NativeWind on mobile, so the UI work stays fast and consistent across both clients.
- Environment variables are split by app, which makes local development and deployment easier to reason about.

## Assumptions Made

- I assumed one shared backend would serve both the web app and the mobile app.
- I assumed the storefront does not need user accounts yet, so checkout is guest-style.
- I assumed payments are simulated for now, with the backend deciding whether an order succeeds or fails.
- I assumed the main local setup is on macOS, since the iOS simulator flow is part of the project.
- I assumed MySQL is available locally or through Docker before the apps are started.

## What I Would Improve If I Had More Time

- Add proper authentication and user accounts.
- Add real payment integration instead of simulated success/failure.
- Add order history and order detail screens on both web and mobile.
- Add stronger form validation and nicer error states.
- Add tests for backend services and client flows.
- Add a proper CI pipeline for linting, type checking, and builds.
- Add production deployment docs for each app separately.
- Tighten the mobile design system so it feels even more native and polished.

