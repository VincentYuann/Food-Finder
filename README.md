<div align="center">

<img src="frontend/assets/logo.svg" alt="FoodFinder Logo" width="88" height="88" />

# FoodFinder

**Real-time collaborative restaurant discovery, shortlisting, and instant group voting.**

[![Node Version](https://img.shields.io/badge/node-%3E%3D24.0.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18%20%2F%2019-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/vite-6.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Express](https://img.shields.io/badge/express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16%2B-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/prisma-7.x-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Socket.IO](https://img.shields.io/badge/socket.io-4.x-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
[![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3.x-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)

[Quickstart](#quickstart) • [Architecture](#architecture) • [Environment Config](#configuration) • [API Reference](#api-reference) • [Socket.IO Contract](#socketio-event-contract) • [CI/CD](#cicd-pipeline)

</div>

---

## Overview

FoodFinder eliminates the friction of deciding where to eat in a group. Instead of endless texting and fragmented link-sharing across messaging apps, FoodFinder enables a host to spin up a collaborative lobby with a 6-character invite code. 

Participants explore nearby spots filtered by GPS radius, neighborhood geocoding, and cuisine, curate a shared shortlist, chat in real-time, and run a live democratic vote to crown the winning restaurant.

> [!TIP]
> **Looking for deep architectural diagrams and sequence flows?**
> Check out [`architecture.md`](./architecture.md) for detailed Mermaid system diagrams, component hierarchies, database ERDs, and state synchronization flows.

---

## Engineering Highlights

- **Synchronous Lobby Voting & State Engine:** Sub-50ms room state broadcasts powered by Socket.IO over shared HTTP server ports. Real-time synchronizations include member readiness, shortlist nominations, atomic ballot tallying, and winner spotlight transitions.
- **Resilient Ephemeral Ticket Reconnection:** Implements an ephemeral single-use ticket mechanism (`/api/users/profile/socket-ticket`) that allows clients to cleanly re-authenticate and auto-resync room state during network drops without exposing long-lived credentials.
- **Adaptive Discovery & 3-Page Candidate Pooling:** Smart radius query semantics dynamically switch between proximity ranking (`DISTANCE`) for tight radiuses ($\le 2$ mi) and regional prominence (`best restaurants`) for wide radiuses ($> 2$ mi). The client query engine pools candidates across up to 3 Google Places API (New) pages to present an exact 18+18 two-batch card grid.
- **Two-Tier Cost-Optimized Caching:** External Google Places API responses are cached in-memory via `node-cache` (5-minute TTL) and persisted in PostgreSQL via Prisma with an automated 30-day cron purge, maximizing speed while minimizing external API billing.
- **Stateless Direct-to-S3 Media Uploads:** User profile pictures leverage AWS S3 presigned PUT URLs, completely bypassing backend memory buffers and keeping Node.js containers horizontally scalable.
- **Strict Cookie & Token Security:** REST sessions utilize `HttpOnly`, `SameSite=Lax` JWT cookies with HTTPS enforcement in production, preventing token exfiltration via XSS attacks.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     React 19 SPA (Vite + Tailwind)                      │
│        TanStack Query Cache • Custom Hook State • Lucide Vector UI      │
└──────────────────┬───────────────────────────────────────▲──────────────┘
                   │ HTTP Requests (HttpOnly Cookie)       │ WebSocket (Live Sync & Chat)
                   ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Express 5 Backend Server                         │
│             Socket.IO Room Manager • REST Route Controllers             │
└──────────────────┬───────────────────────────────────────┬──────────────┘
                   │ Prisma 7 ORM                          │ Cache Layer
                   ▼                                       ▼
┌─────────────────────────────────────┐         ┌─────────────────────────┐
│             PostgreSQL              │         │   In-Memory TTL Cache   │
│ (Users, Lobbies, Shortlists, Votes) │         │       (node-cache)      │
└─────────────────────────────────────┘         └────────────┬────────────┘
                                                             │ Cache Miss
                                                             ▼
                                                ┌─────────────────────────┐
                                                │    Google Places API    │
                                                └─────────────────────────┘
```

For full system diagrams, database ERDs, and sequence flows, refer to [`architecture.md`](./architecture.md).

### Tech Stack

| Layer | Technology | Version / Spec | Purpose |
|---|---|---|---|
| **Frontend Framework** | React + Vite | React 18/19, Vite 6 | High-performance SPA with instant HMR |
| **Server State & Cache** | TanStack Query | v5.102+ | Declarative caching, candidate pooling, optimistic updates |
| **Styling & Icons** | Tailwind CSS & Lucide React | v3.4+ / v0.469+ | Responsive design system and clean SVG vector icons |
| **Routing** | React Router | v6.28+ | Client-side routing with URL query param sync |
| **Backend Runtime** | Node.js (ESM) | 24+ Alpine | Asynchronous REST and real-time backend |
| **API Framework** | Express | 5.x | REST routing, middleware pipelines, error handling |
| **Real-Time Engine** | Socket.IO | 4.x | Low-latency room broadcasting and ephemeral ticket auth |
| **Database & ORM** | PostgreSQL & Prisma | PG 16+, Prisma 7 | Relational modeling, migrations, connection pooling |
| **Cloud Storage** | AWS S3 SDK v3 | `@aws-sdk/client-s3` | Presigned client-side avatar uploads |
| **External APIs** | Google Places (New) & Nominatim | REST / v1 | Field-masked restaurant discovery and free OSM geocoding |
| **Container & CI/CD** | Docker & Jenkins | Compose v2, Alpine | Multi-stage container builds and automated lint/test CI |

---

## Directory Structure

```text
foodfinder/
├── architecture.md          # Complete system architecture and sequence diagrams
├── DESIGN.md                # Design tokens, color palette, and component specs
├── PRODUCT.md               # Product requirements and operating parameters
├── docker-compose.yml       # Production/development container orchestration
├── Jenkinsfile              # Declarative CI pipeline (lint, build, notify)
├── backend/
│   ├── config/              # Prisma client, JWT, S3, and CORS configurations
│   ├── controllers/         # REST controllers (users, restaurants, lobbies)
│   ├── cron/                # Scheduled jobs (daily 30-day cache purge)
│   ├── middleware/          # JWT auth guard, lobby creator & member checks
│   ├── prisma/              # Prisma schema definitions and migration history
│   ├── routes/              # Express route definitions
│   ├── services/            # Google Places client, S3 presigner, lobby domain logic
│   ├── socket/              # Socket.IO connection handlers and room emitters
│   ├── Dockerfile           # Alpine Node.js 24 backend container definition
│   └── server.js            # Express & Socket.IO server bootstrap
└── frontend/
    ├── nginx.conf           # Static server config with immutable asset caching
    ├── Dockerfile           # Multi-stage Vite build & Nginx deployment
    ├── index.html           # SPA entry template
    ├── package.json         # Frontend dependencies and Vite scripts
    └── src/
        ├── api/             # Axios client, authApi, restaurantApi, lobbyApi, queryClient
        ├── components/
        │   ├── auth/        # LoginForm, RegisterForm
        │   ├── common/      # Button, Modal, ConfirmDialog, Navbar, LoadingSpinner
        │   ├── lobby/       # LobbyHeader, MemberList, Shortlist, LiveChat, WinnerSpotlight
        │   └── restaurants/ # RestaurantCard, RestaurantDetailsModal, SavedRestaurantItem
        ├── context/         # AuthContext, ToastContext, ModalContext
        ├── hooks/           # useRestaurantSearch, useLobbySocket, useGeolocation, useAuth
        ├── pages/           # DashboardPage, LobbyPage, LoginPage, SearchPage, NotFoundPage
        ├── index.css        # Tailwind utility directives and design system tokens
        ├── main.jsx         # React application entry point
        └── App.jsx          # Providers, router routes, and root layout
```

---

## Quickstart

### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) *(recommended)*
- Or **Node.js >= 24.0.0** and a running **PostgreSQL >= 16** instance

---

### Option A: Docker Compose (Recommended)

1. **Clone repository and configure environment variables:**
   ```bash
   git clone https://github.com/VincentYuann/Food-Finder.git
   cd Food-Finder
   cp backend/.env.example backend/.env
   # Edit backend/.env with your Google Places API Key and database credentials
   ```

2. **Build and launch containers:**
   ```bash
   docker compose up --build
   ```

3. **Development with file synchronization:**
   ```bash
   docker compose watch
   ```

- **Frontend Application:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`

---

### Option B: Local Setup (without Docker)

1. **Configure and start backend:**
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm start
   ```

2. **Configure and start frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

---

## Configuration

Set the following variables in `backend/.env`:

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET` | **Yes** | — | Secret key used for signing session cookies and ephemeral tickets |
| `GOOGLE_PLACES_API_KEY`| **Yes** | — | Google Cloud API Key with Places API (New) enabled |
| `PORT` | No | `5000` | Backend listening port |
| `FRONTEND_URL` | No | `http://localhost:3000` | Allowed CORS origin |
| `NODE_ENV` | No | `development` | Environment mode (`development` / `production`) |
| `S3_ENDPOINT` | No | `https://s3.amazonaws.com` | AWS S3 endpoint URL |
| `S3_ACCESS_KEY_ID` | No | — | AWS IAM access key for S3 uploads |
| `S3_SECRET_ACCESS_KEY` | No | — | AWS IAM secret key for S3 uploads |
| `S3_BUCKET` | No | — | Target AWS S3 bucket name for avatars |

Optional Frontend Environment Variables (`frontend/.env`):
| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend API root URL |
| `VITE_SOCKET_BASE_URL`| `http://localhost:5000` | Real-time WebSocket server root URL |

---

## API Reference

### REST Endpoints

#### Authentication & User Profiles (`/api/users`)
| Method | Route | Access | Description |
|---|---|:---:|---|
| `POST` | `/api/users/register` | Public | Register new user account |
| `POST` | `/api/users/login` | Public | Verify credentials and issue HttpOnly auth cookie |
| `POST` | `/api/users/logout` | Auth | Invalidate session and clear auth cookie |
| `GET` | `/api/users/profile` | Auth | Fetch authenticated user profile |
| `GET` | `/api/users/profile/socket-ticket` | Auth | Generate short-lived ephemeral ticket for WebSocket auth |
| `PUT` | `/api/users/profile` | Auth | Update username or avatar URL |
| `DELETE`| `/api/users/profile` | Auth | Delete user account |
| `GET` | `/api/users/profile/saved-restaurants`| Auth | Fetch user's bookmarked restaurants |
| `POST` | `/api/users/profile/saved-restaurants`| Auth | Save restaurant to user's favorites |
| `DELETE`| `/api/users/profile/saved-restaurants/:id`| Auth | Remove restaurant from user's favorites |
| `GET` | `/api/users/profile/lobbies` | Auth | Fetch all lobbies user created or joined |

#### Restaurant Search & Bookmarks (`/api/restaurants`)
| Method | Route | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/restaurants/search/nearby` | Public | Adaptive geospatial search (`radius`, `latitude`, `longitude`, `keyword`) |
| `GET` | `/api/restaurants/search/text` | Public | Text query search with optional location bias |
| `GET` | `/api/restaurants/details/:placeId` | Auth | Fetch detailed place info (cached in L1/L2) |
| `GET` | `/api/restaurants/photo/:photoName` | Public | Secure photo proxy shielding Google API keys |
| `GET` | `/api/restaurants/saved` | Auth | Fetch user's saved restaurant list |
| `GET` | `/api/restaurants/saved-ids` | Auth | Fetch array of saved place IDs for quick UI lookup |
| `POST` | `/api/restaurants/save` | Auth | Save restaurant to personal favorites |
| `DELETE`| `/api/restaurants/saved/:restaurantId` | Auth | Remove restaurant from personal favorites |
| `GET` | `/api/restaurants/:id` | Public | Fetch cached restaurant record by database ID |

#### Collaborative Lobbies (`/api/lobbies`)
| Method | Route | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/lobbies` | Auth | Get user's active lobbies |
| `POST` | `/api/lobbies` | Auth | Create a new lobby session (generates 6-char code) |
| `POST` | `/api/lobbies/join` | Auth | Join a lobby via 6-character code |
| `GET` | `/api/lobbies/:id` | Member | Fetch full lobby state, options, and members |
| `PATCH` | `/api/lobbies/:id` | Host | Update lobby status (`active` ➔ `voting` ➔ `closed`) |
| `DELETE`| `/api/lobbies/:id` | Host | Delete lobby room and associated data |
| `GET` | `/api/lobbies/:id/members` | Member | List participants and their ready statuses |
| `PATCH` | `/api/lobbies/:id/members/ready` | Member | Toggle user ready flag |
| `DELETE`| `/api/lobbies/:id/members/:userId` | Member | Remove member or leave lobby |
| `GET` | `/api/lobbies/:id/restaurants` | Member | Fetch nominated restaurant shortlist |
| `POST` | `/api/lobbies/:id/restaurants` | Member | Nominate a restaurant to the lobby shortlist |
| `DELETE`| `/api/lobbies/:id/restaurants/:restaurantId` | Member | Remove restaurant from shortlist |
| `GET` | `/api/lobbies/:id/votes` | Member | Fetch vote distribution in lobby |
| `POST` | `/api/lobbies/:id/votes` | Member | Cast or update vote for a shortlist option |
| `GET` | `/api/lobbies/:id/messages` | Member | Fetch historical chat messages |
| `POST` | `/api/lobbies/:id/messages` | Member | Post a chat message with optional S3 image |

---

### Socket.IO Event Contract

The real-time layer operates on room channels partitioned by lobby ID (`lobby:${lobbyId}`).

#### Client ➔ Server Emitters
| Event | Payload | Acknowledgment | Description |
|---|---|:---:|---|
| `lobby:join` | `(lobbyId: number)` | `(response: { ok: boolean, error?: string })` | Joins the room channel after verifying DB membership |
| `lobby:leave` | `(lobbyId: number)` | `(response: { ok: boolean })` | Leaves the room channel |
| `chat:send` | `{ lobbyId, content, imageUrl }` | `(response: { ok: boolean, messageId?: number })` | Sends chat message; broadcasts to room on success |

#### Server ➔ Room Broadcasts
| Event | Payload | Description |
|---|---|---|
| `lobby:state` | `{ id, name, status, chosen_restaurant_id, closed_at }` | Dispatched when room status changes (`active` ➔ `voting` ➔ `closed`) |
| `lobby:members` | `[{ id, user_id, ready, user: { username, profile_image_url } }]` | Dispatched when members join, leave, or toggle ready |
| `lobby:options` | `[{ id, restaurant_id, added_by, restaurant: {...}, adder: {...} }]` | Dispatched when a spot is nominated or removed |
| `lobby:votes` | `[{ id, user_id, restaurant_id, voted_at }]` | Dispatched live as ballots are cast or changed |
| `chat:message` | `{ id, lobby_id, user_id, content, image_url, sent_at, user: {...} }` | Dispatched when a new chat message is validated |

---

## Design System

The visual language follows **"The Food Court Map"** design specification detailed in [`DESIGN.md`](./DESIGN.md):

- **Palette:** Tomato Red (`#ff6347` / `#e5533d`) primary accent, Star Gold (`#f59e0b`) rating indicator, clean white card surfaces resting over a subtle ambient food doodle texture.
- **Typography:** Poppins (headings, numbers, badges) paired with Lato (clean, legible body text).
- **Responsive Layout:** Adaptive CSS Grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) with smooth 18-card batch pagination, responsive sliding drawers, and animated modals.

---

## CI/CD Pipeline

The repository integrates a declarative **Jenkinsfile** automation pipeline:

1. **Linting:** Node 24 Alpine container running `eslint` across `backend` and `frontend`.
2. **Secret Injection:** Injects production `.env` securely via the Jenkins credential vault.
3. **Build & Test:** Executes `docker compose build` and validates container health.
4. **Discord Webhooks:** Automatically dispatches build status updates, run durations, and log artifacts to the team Discord channel.

---

## Contributors

Developed for **CS 375 — Web Development**:

- **Jeffrey Cheung** ([@J-Cheung123](https://github.com/J-Cheung123) / `jc4759@drexel.edu`)
- **Vincent Yuan** ([@VincentYuann](https://github.com/VincentYuann) / `vincentyuan1020@gmail.com`)
- **Alvin Cheung** (`ac4633@drexel.edu`)

---

## License

This project is created for educational and portfolio demonstration purposes. All rights reserved.
