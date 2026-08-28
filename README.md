<div align="center">

<img src="frontend/assets/logo.svg" alt="FoodFinder Logo" width="88" height="88" />

# FoodFinder

**Real-time collaborative restaurant discovery, shortlisting, and instant group voting.**

[![Node Version](https://img.shields.io/badge/node-%3E%3D24.0.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-5.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16%2B-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/prisma-7.x-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Socket.IO](https://img.shields.io/badge/socket.io-4.x-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)

[Quickstart](#quickstart) • [Architecture](#architecture) • [Environment Config](#configuration) • [API & Sockets](#api-reference) • [CI/CD](#cicd-pipeline)

</div>

---

## Overview

FoodFinder eliminates the back-and-forth friction of deciding where to eat in a group. Instead of passing links across fragmented messaging apps, a host creates a real-time lobby with a 6-character code. Members join, explore nearby spots filtered by GPS radius and cuisine, nominate candidates to a shared room shortlist, chat live, and vote to declare a winner.

---

## Engineering Highlights

- **Real-Time Room Synchronization:** Sub-50ms lobby state updates and chat broadcasts powered by Socket.IO over shared HTTP server ports.
- **Two-Tier Cost-Optimized Caching:** Google Places API responses are cached in-memory (`node-cache`) and persisted in PostgreSQL via Prisma, reducing external API billing while retaining fast response times.
- **Stateless Media Direct Uploads:** User profile pictures and chat images leverage AWS S3 presigned URLs, keeping backend containers memory-efficient and horizontally scalable.
- **Strict Cookie-Based Auth:** Session tokens are delivered via `HttpOnly`, `SameSite=Lax` JWT cookies, which automatically authenticate both REST routes and WebSocket handshakes without client token exposure.

---

## Architecture

```mermaid
flowchart TD
    Client["Frontend SPA (Vanilla JS / Nginx)"]
    API["Express 5 API Gateway"]
    WS["Socket.IO Server"]
    DB[("PostgreSQL (Prisma ORM)")]
    MemoryCache["In-Memory TTL Cache (node-cache)"]
    PlacesAPI["Google Places API (New & Classic)"]
    S3["AWS S3 / Object Storage"]

    Client -->|REST (HttpOnly JWT Cookie)| API
    Client <-->|Bidirectional WS Events| WS
    API -->|Prisma Client Queries| DB
    API -->|1. Check Cache| MemoryCache
    MemoryCache -->|2. Miss| PlacesAPI
    PlacesAPI -->|3. Upsert Cache| DB
    Client -->|Direct Upload via Presigned URL| S3
```

### Tech Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Frontend** | Vanilla JavaScript (ES Modules), HTML5, Custom CSS3 | Fast zero-build client served via Nginx |
| **Backend** | Node.js 24+, Express 5, Socket.IO 4 | REST routing, WebSocket room management, auth middleware |
| **Database & ORM** | PostgreSQL 16+, Prisma ORM | Relational schema modeling and database migrations |
| **Storage & Cache** | AWS S3, `node-cache` (Memory) | Presigned profile avatar storage and fast API response caching |
| **DevOps** | Docker, Docker Compose, Jenkins, ESLint | Multi-container orchestration, linting, CI automation |

---

## Directory Structure

```text
foodfinder/
├── backend/
│   ├── config/              # Prisma DB client, JWT, S3, and CORS configurations
│   ├── controllers/         # Request handlers (lobbies, restaurants, users)
│   ├── cron/                # Scheduled jobs (cache purger)
│   ├── middleware/          # JWT auth guard, creator and membership checks
│   ├── prisma/              # Schema definitions and migration history
│   ├── routes/              # Express API route modules
│   ├── services/            # Google Places proxy, S3 presigner, lobby services
│   ├── socket/              # Socket.IO connection handlers & room emitters
│   └── server.js            # Main HTTP & WebSocket server entry point
├── frontend/
│   ├── assets/              # SVGs, brand assets, and favicon
│   ├── css/                 # Design system sheets (auth, dashboard, lobby, main, search)
│   ├── JavaScripts/         # ES Modules (api, auth, dashboard, lobby, modal, search)
│   ├── index.html           # User dashboard & personal saved favorites
│   ├── lobby.html           # Collaborative room (live chat, nominations, voting)
│   ├── login.html           # Authentication portal
│   └── search.html          # Geospatial restaurant discovery interface
├── docker-compose.yml       # Container composition with live reload watch
├── Jenkinsfile              # Declarative CI pipeline (lint, build, test, notify)
├── DESIGN.md                # Design tokens and visual specifications
└── PRODUCT.md               # Product requirements and operating parameters
```

---

## Quickstart

### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/) *(recommended)*
- Or **Node.js >= 24.0.0** and a running **PostgreSQL >= 16** instance

---

### Option A: Docker Compose (Fastest)

1. **Clone repository and configure environment variables:**
   ```bash
   git clone https://github.com/VincentYuann/Food-Finder.git
   cd Food-Finder
   cp backend/.env.example backend/.env
   # Edit backend/.env with your Google Places API Key and database credentials
   ```

2. **Start services:**
   ```bash
   docker compose up --build
   ```

3. **Development with hot reload:**
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

2. **Serve frontend:**
   ```bash
   # From root directory
   npx serve frontend -p 3000
   ```

---

## Configuration

Set the following variables in `backend/.env`:

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET` | **Yes** | — | Secret string used for signing authentication cookies |
| `GOOGLE_PLACES_API_KEY`| **Yes** | — | Google Cloud API Key with Places API enabled |
| `PORT` | No | `5000` | Backend port |
| `FRONTEND_URL` | No | `http://localhost:3000` | Allowed CORS origin |
| `NODE_ENV` | No | `development` | Environment mode (`development` / `production`) |
| `S3_ENDPOINT` | No | `https://s3.amazonaws.com` | S3 endpoint URL |
| `S3_ACCESS_KEY_ID` | No | — | AWS S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | — | AWS S3 secret key |
| `S3_BUCKET` | No | — | Target S3 bucket name for avatars |

> [!IMPORTANT]
> In production environments, ensure `FRONTEND_URL` matches your exact domain. JWT cookies are configured with `SameSite=Lax` and require HTTPS in non-local environments.

---

## API Reference

### REST Endpoints

#### Authentication & User Profiles (`/api/users`)
| Method | Route | Access | Description |
|---|---|:---:|---|
| `POST` | `/api/users/register` | Public | Create a new user account |
| `POST` | `/api/users/login` | Public | Validate credentials and issue HTTP-only auth cookie |
| `POST` | `/api/users/logout` | Auth | Invalidate session and clear auth cookie |
| `GET` | `/api/users/profile` | Auth | Fetch user profile and avatar URL |
| `PUT` | `/api/users/profile` | Auth | Update username or avatar link |
| `GET` | `/api/users/profile/saved-restaurants` | Auth | List user's bookmarked restaurants |
| `GET` | `/api/users/profile/lobbies` | Auth | Fetch all lobbies user has joined or created |

#### Restaurant Search & Bookmarks (`/api/restaurants`)
| Method | Route | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/restaurants/search/nearby` | Public | Search restaurants by GPS latitude/longitude and radius |
| `GET` | `/api/restaurants/search/text` | Public | Query restaurants by text keywords and cuisine filter |
| `GET` | `/api/restaurants/details/:placeId` | Auth | Fetch full restaurant details (cached) |
| `GET` | `/api/restaurants/photo/:photoName` | Public | Proxy Google Places photo requests |
| `GET` | `/api/restaurants/saved` | Auth | Fetch user saved restaurants list |
| `POST` | `/api/restaurants/save` | Auth | Save restaurant to favorites |
| `DELETE`| `/api/restaurants/saved/:restaurantId` | Auth | Remove restaurant from favorites |

#### Collaborative Lobbies (`/api/lobbies`)
| Method | Route | Access | Description |
|---|---|:---:|---|
| `GET` | `/api/lobbies` | Auth | Get active user lobbies |
| `POST` | `/api/lobbies` | Auth | Create a new lobby session |
| `POST` | `/api/lobbies/join` | Auth | Join a lobby via 6-character code |
| `GET` | `/api/lobbies/:id` | Member | Fetch lobby room details and state |
| `PATCH` | `/api/lobbies/:id` | Host | Update lobby status (`active` ➔ `voting` ➔ `closed`) |
| `DELETE`| `/api/lobbies/:id` | Host | Delete lobby room |
| `GET` | `/api/lobbies/:id/members` | Member | Get list of participants in lobby |
| `PATCH` | `/api/lobbies/:id/members/ready` | Member | Toggle user ready flag |
| `GET` | `/api/lobbies/:id/restaurants` | Member | Get restaurant candidates in lobby |
| `POST` | `/api/lobbies/:id/restaurants` | Member | Nominate a restaurant to lobby pool |
| `DELETE`| `/api/lobbies/:id/restaurants/:restaurantId` | Member | Remove nominated restaurant |
| `POST` | `/api/lobbies/:id/votes` | Member | Cast or update vote for a restaurant |
| `GET` | `/api/lobbies/:id/messages` | Member | Fetch historical chat messages |

---

### Socket.IO Event Contract

<details>
<summary><b>View WebSocket Event Payloads</b></summary>

#### Client ➔ Server Events
| Event | Arguments | Description |
|---|---|---|
| `lobby:join` | `(lobbyId: number, ack: Function)` | Joins the room channel for the given lobby ID |
| `lobby:leave` | `(lobbyId: number, ack: Function)` | Leaves the room channel |
| `chat:send` | `({ lobbyId, content, imageUrl }, ack: Function)` | Sends a new chat message |

#### Server ➔ Client Broadcasts
| Event | Payload | Description |
|---|---|---|
| `chat:message` | `{ id, lobby_id, user_id, content, image_url, sent_at, user: { username, profile_image_url } }` | Dispatched to all members when a new message is posted |
| `lobby:members` | `[{ id, user_id, ready, user: { username, profile_image_url } }]` | Dispatched on member join, leave, or ready toggle |

</details>

---

## Design System

The visual language follows **"The Food Court Map"** design specification detailed in [`DESIGN.md`](./DESIGN.md):

- **Palette:** Tomato Red (`#ff6347` / `#e5533d`) primary accent, Star Gold (`#f59e0b`) rating indicator, neutral white card surfaces resting above a subtle ambient SVG food doodle background.
- **Typography:** Poppins (geometric headings and interactive labels) paired with Lato (clean body text).
- **Responsive Layout:** Adaptive CSS Grid with `minmax(280px, 1fr)` cards, responsive sidebar drawers, and fluid modals.

---

## CI/CD Pipeline

The repository integrates a declarative **Jenkinsfile** pipeline:

1. **Linting:** Node 24 Alpine container running `eslint` on `backend` and `frontend`.
2. **Secret Injection:** Injects production `.env` securely via Jenkins credential store.
3. **Build & Deploy:** Runs `docker compose build` and deploys background containers.
4. **Discord Webhooks:** Automatically transmits build pass/fail alerts and build log attachments.

---

## Contributors

Developed for **CS 375 — Web Development**:

- **Jeffrey Cheung** ([@J-Cheung123](https://github.com/J-Cheung123) / `jc4759@drexel.edu`)
- **Vincent Yuan** ([@VincentYuann](https://github.com/VincentYuann) / `vincentyuan1020@gmail.com`)
- **Alvin Cheung** (`ac4633@drexel.edu`)

---

## License

This project is created for educational and portfolio demonstration purposes. All rights reserved.
