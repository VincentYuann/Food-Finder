# FoodFinder Architecture & Technical Specifications

FoodFinder is a high-performance, real-time collaborative restaurant discovery, shortlisting, and consensus voting application. It solves the group coordination dilemma ("Where should we eat?") through synchronous geospatial search, multi-user shortlist curation, live chat, and instant democratic voting.

---

## 1. High-Level System Architecture

The application is architected around a decoupled client-server model optimized for low-latency WebSocket events, efficient external API utilization, and horizontal scalability.

```mermaid
graph TB
    subgraph ClientTier["Client Tier (Web Browser)"]
        Browser["React 19 SPA (Vite + Tailwind CSS)<br/>• TanStack Query Server State Cache<br/>• Socket.IO Real-Time Client<br/>• Nominatim Geocoding Engine"]
    end

    subgraph EdgeTier["Web / Edge Tier"]
        Nginx["Nginx Reverse Proxy & Static File Server<br/>• Dockerized Alpine Container (Port 3000)<br/>• Cache-Control: Immutable for /assets/<br/>• Cache-Control: No-Store for /index.html"]
    end

    subgraph APITier["Application & Real-Time Tier"]
        ExpressApp["Express 5 REST API (Port 5000)<br/>• Route Controllers & JWT Middleware<br/>• Rate-Limiting & Input Validation"]
        SocketServer["Socket.IO 4 Real-Time Engine<br/>• Room Partitioning (lobby:id)<br/>• Ephemeral Ticket & Cookie Auth<br/>• State Snapshot Broadcasts"]
        NodeCache["In-Memory Cache (node-cache)<br/>• 5-Minute TTL for Hot Queries<br/>• Sub-millisecond Cache Retrieval"]
    end

    subgraph DataTier["Data & Persistence Tier"]
        PrismaORM["Prisma 7 ORM Client<br/>• @prisma/adapter-pg Driver Adapter<br/>• Connection Pooling & Query Engine"]
        PostgresDB[("PostgreSQL 16 Database<br/>• Users, Lobbies, Members, Options<br/>• Votes, Messages, Saved Places<br/>• Persistent Google Place Cache")]
        CronPurge["Background Cache Purger<br/>• Daily Cron: Cleans Cached Spots > 30 Days"]
    end

    subgraph ExternalTier["External Cloud Services"]
        GooglePlaces["Google Places API (New)<br/>• /places:searchText with X-Goog-FieldMask<br/>• Places Photo CDN via Backend Proxy"]
        AWSS3["AWS S3 Storage<br/>• Direct-to-S3 Presigned URL Uploads<br/>• User Avatars & Profile Pictures"]
        Nominatim["OpenStreetMap Nominatim API<br/>• Zero-Cost Geocoding & Reverse Geocoding"]
    end

    Browser -->|HTTP Static Assets| Nginx
    Browser -->|REST API with HttpOnly JWT Cookie| ExpressApp
    Browser -->|WebSocket Handshake & Live Events| SocketServer
    Browser -->|Forward / Reverse Geocoding| Nominatim

    ExpressApp -->|Read / Write| PrismaORM
    ExpressApp -->|Check / Populate| NodeCache
    ExpressApp -->|Field-Masked Search & Photo Proxy| GooglePlaces
    ExpressApp -->|Generate Presigned PUT URLs| AWSS3
    Browser -->|Direct Image Upload via Presigned URL| AWSS3

    SocketServer -->|Membership & State Verification| PrismaORM
    SocketServer -.->|Broadcast Triggers| ExpressApp

    PrismaORM -->|Connection Pool| PostgresDB
    CronPurge -->|DELETE query| PostgresDB
```

---

## 2. Frontend Architecture (React 19 + Vite)

The frontend is a single-page application (SPA) built on React 19 and Vite 6, using a modular hook-driven architecture that strictly separates UI rendering from server state management.

```mermaid
graph TD
    subgraph UIComponents["View & Component Layer"]
        App["App.jsx (Router, Providers, Layout)"]
        Nav["Navbar.jsx (Auth Status, Navigation, Global Profile)"]
        
        subgraph Pages["Page Views"]
            LoginPage["LoginPage.jsx (Auth Forms)"]
            DashPage["DashboardPage.jsx (Lobbies & Saved Places)"]
            SearchPage["SearchPage.jsx (Discovery & Filtering)"]
            LobbyPage["LobbyPage.jsx (Real-Time Room)"]
        end

        subgraph LobbyUI["Lobby Subcomponents"]
            LobbyHeader["LobbyHeader.jsx (Code, Status, Invite)"]
            MemberList["MemberList.jsx (Users, Ready Badges)"]
            Shortlist["RestaurantShortlist.jsx (Candidates & Voting Cards)"]
            LiveChat["LiveChat.jsx (Synchronous Chat & S3 Media)"]
            AddDrawer["AddRestaurantDrawer.jsx (Nominations)"]
            WinnerSpot["WinnerSpotlight.jsx (Consensus Hero)"]
        end
    end

    subgraph StateLayer["State Management & Custom Hooks"]
        subgraph Contexts["Global UI Contexts"]
            AuthContext["AuthContext (Current User, Login, Logout)"]
            ToastContext["ToastContext (Flash Notifications)"]
            ModalContext["ModalContext (Global Modals)"]
        end

        subgraph QueryHooks["Server State (TanStack Query v5)"]
            useRestaurantsQuery["useRestaurantSearch()<br/>• 3-Page Candidate Pooling<br/>• In-Radius Haversine Filter<br/>• 5m Stale / 30m GC"]
            useSavedRestaurants["useSavedRestaurants()<br/>• Optimistic Favorite Toggles"]
            useLobbiesQuery["useLobbiesQuery()<br/>• User Lobby Membership Cache"]
            useRestaurantDetails["useRestaurantDetails()<br/>• Instant Modal Hydration Cache"]
        end

        subgraph SocketHooks["Real-Time Synchronization"]
            useLobbySocket["useLobbySocket()<br/>• Ephemeral Ticket Auth<br/>• Stable Callback Refs<br/>• Automatic Room Resync<br/>• Offline Fallback Handling"]
        end

        subgraph GeoHooks["Geospatial Engine"]
            useGeolocation["useGeolocation()<br/>• HTML5 GPS Acquisition<br/>• High-Accuracy Mode<br/>• Nominatim Fallback Geocoder"]
        end
    end

    subgraph NetworkAPI["API Client Layer"]
        AxiosClient["apiClient (Axios with withCredentials: true)"]
        AuthAPI["authApi (Login, Register, Ticket)"]
        RestAPI["restaurantApi (Nearby, Text, Saved)"]
        LobbyAPI["lobbyApi (CRUD, Ready, Vote, Options)"]
        SocketIOClient["socket.io-client (Engine.IO v4)"]
    end

    App --> Nav
    App --> Pages
    LobbyPage --> LobbyUI

    SearchPage --> useRestaurantsQuery
    SearchPage --> useGeolocation
    SearchPage --> useSavedRestaurants
    LobbyPage --> useLobbySocket
    LobbyPage --> LobbyAPI
    DashPage --> useLobbiesQuery
    DashPage --> useSavedRestaurants

    useRestaurantsQuery --> RestAPI
    useSavedRestaurants --> RestAPI
    useLobbiesQuery --> LobbyAPI
    useRestaurantDetails --> RestAPI
    useLobbySocket --> SocketIOClient
    useLobbySocket --> AuthAPI

    RestAPI --> AxiosClient
    LobbyAPI --> AxiosClient
    AuthAPI --> AxiosClient
```

### Frontend State Segregation
1. **Server State (TanStack Query v5):** All data sourced from the backend (`restaurants`, `saved_restaurants`, `lobbies`, `details`) is managed via TanStack Query with structured query keys (`queryKeys.restaurants.search(...)`). Stale times are tuned to 5 minutes, eliminating redundant API hits during active navigation.
2. **Ephemeral Real-Time State (Socket.IO Hook):** Live lobby membership, shortlist mutations, vote tallies, and chat messages are handled by `useLobbySocket`. Stable callback refs (`callbacksRef.current`) prevent unwanted socket teardowns and reconnections across re-renders.
3. **Session & Global UI Context:** Pure client state (authentication status, notification toasts, confirmation dialogs) lives in lightweight React Context providers.
4. **URL Synchronization:** Search query parameters (`q`, `cuisine`, `radius`, `lat`, `lng`, `customLoc`, `mode`) are mirrored in `URLSearchParams`, enabling direct bookmarking and shareable discovery states.

---

## 3. Backend Architecture (Express 5 + Socket.IO)

The backend is built with modern ES Modules (Node.js 24+) following a layered separation of concerns:

```mermaid
graph TD
    subgraph Inbound["Inbound Network Traffic"]
        HTTPRequest["HTTP Requests (:5000/api/*)"]
        WSRequest["WebSocket Handshake (:5000/socket.io/*)"]
    end

    subgraph MiddlewareLayer["Middleware Pipeline"]
        CORS["corsConfig.js (Strict Origin & Credentials)"]
        CookieParser["cookie-parser (Signed Cookie Extraction)"]
        JWTGuard["verifyJWT.js (Bearer / HttpOnly Token Auth)"]
        LobbyMemberGuard["isLobbyMember.js (Room Membership Guard)"]
        LobbyCreatorGuard["isLobbyCreator.js (Host Role Verification)"]
    end

    subgraph ControllerLayer["Controllers (Request Validation & Response Mapping)"]
        UserController["userController.js<br/>• Auth, Tickets, Profile, S3 Presign"]
        RestaurantController["restaurantController.js<br/>• Adaptive Search, Details, Saved, Photo Proxy"]
        LobbyController["lobbyController.js<br/>• Lifecycle, Nominations, Ready State, Voting"]
    end

    subgraph ServiceLayer["Domain Services (Business Logic)"]
        GooglePlacesService["googlePlacesService.js<br/>• Field-Masked SearchText Proxy<br/>• Adaptive Prominence vs Distance Strategy"]
        LobbyChatService["lobbyChatService.js<br/>• Message Validation & Room Broadcast"]
        LobbyStateService["lobbyStateService.js<br/>• State Transitions & Consensus Resolution"]
        LobbyVoteService["lobbyVoteService.js<br/>• Atomic Ballot Tallying & Winner Detection"]
        LobbyMemberService["lobbyMemberService.js<br/>• Membership Management & Ready Sync"]
        LobbyOptionService["lobbyOptionService.js<br/>• Shortlist Nominations & Duplication Guards"]
        S3Service["s3Service.js<br/>• AWS SDK v3 Presigned PUT Signatures"]
    end

    subgraph SocketLayer["Real-Time Engine (socket/index.js)"]
        SocketAuth["Handshake Auth (Cookie or Ephemeral Ticket)"]
        SocketRouter["Socket Event Handlers (join, leave, chat:send)"]
        SocketEmitter["Socket Emitter (State, Members, Options, Votes, Chat)"]
    end

    subgraph PersistenceLayer["Data & Cache Layer"]
        PrismaClient["Prisma 7 Client (@prisma/adapter-pg)"]
        NodeCacheInstance["node-cache (In-Memory Key/Value)"]
        Postgres[(PostgreSQL 16 Database)]
    end

    HTTPRequest --> CORS --> CookieParser
    CookieParser --> JWTGuard
    JWTGuard --> LobbyMemberGuard
    LobbyMemberGuard --> LobbyCreatorGuard

    JWTGuard --> UserController
    JWTGuard --> RestaurantController
    LobbyMemberGuard --> LobbyController

    UserController --> S3Service
    UserController --> PrismaClient
    RestaurantController --> GooglePlacesService
    RestaurantController --> NodeCacheInstance
    RestaurantController --> PrismaClient
    LobbyController --> LobbyStateService
    LobbyController --> LobbyVoteService
    LobbyController --> LobbyMemberService
    LobbyController --> LobbyOptionService

    WSRequest --> SocketAuth --> SocketRouter
    SocketRouter --> LobbyChatService
    LobbyChatService --> SocketEmitter
    LobbyStateService --> SocketEmitter
    LobbyVoteService --> SocketEmitter
    LobbyMemberService --> SocketEmitter
    LobbyOptionService --> SocketEmitter

    GooglePlacesService --> NodeCacheInstance
    GooglePlacesService --> PrismaClient
    LobbyStateService --> PrismaClient
    LobbyVoteService --> PrismaClient
    LobbyMemberService --> PrismaClient
    LobbyOptionService --> PrismaClient

    PrismaClient --> Postgres
```

---

## 4. Database Schema (Prisma 7 / PostgreSQL)

The database schema models user identities, cached restaurant entities, collaborative lobby sessions, shortlists, live ballots, and messages.

```mermaid
erDiagram
    users ||--o{ saved_restaurants : "saves"
    users ||--o{ lobbies : "creates"
    users ||--o{ lobby_members : "participates"
    users ||--o{ lobby_restaurant_options : "nominates"
    users ||--o{ votes : "casts"
    users ||--o{ messages : "sends"

    restaurants ||--o{ saved_restaurants : "bookmarked_by"
    restaurants ||--o{ lobbies : "selected_as_winner"
    restaurants ||--o{ lobby_restaurant_options : "option_in"
    restaurants ||--o{ votes : "target_of"

    lobbies ||--o{ lobby_members : "contains"
    lobbies ||--o{ lobby_restaurant_options : "shortlists"
    lobbies ||--o{ votes : "ballots_in"
    lobbies ||--o{ messages : "chat_history"

    users {
        int id PK "auto-increment"
        varchar username UK "unique 50 chars"
        varchar email UK "unique 255 chars"
        varchar password_hash "bcrypt hashed"
        string profile_image_url "S3 image location"
        timestamp created_at "now()"
    }

    restaurants {
        int id PK "auto-increment"
        varchar api_place_id UK "Google Place ID"
        varchar name "Restaurant name"
        string address "Formatted address"
        decimal latitude "Decimal(9,6)"
        decimal longitude "Decimal(9,6)"
        decimal rating "Decimal(2,1)"
        int price_level "1 to 4"
        string photo_url "Proxy photo URI"
        varchar primary_type "Primary cuisine/type"
        int user_rating_count "Review count"
        varchar phone_number "Contact phone"
        string website_url "Official website"
        string google_maps_url "Maps deep link"
        json opening_hours "Serialized hours"
        timestamp cached_at "now()"
    }

    saved_restaurants {
        int id PK
        int user_id FK "Cascade on delete"
        int restaurant_id FK "Cascade on delete"
        timestamp saved_at "now()"
    }

    lobbies {
        int id PK
        varchar name "Room title"
        int created_by FK "Creator user"
        varchar status "active | voting | eating | closed"
        int chosen_restaurant_id FK "Winning restaurant"
        varchar invite_code UK "6-char alphanumeric"
        timestamp created_at "now()"
        timestamp closed_at "nullable"
    }

    lobby_members {
        int id PK
        int lobby_id FK "Cascade on delete"
        int user_id FK "Cascade on delete"
        boolean ready "Default false"
        timestamp joined_at "now()"
    }

    lobby_restaurant_options {
        int id PK
        int lobby_id FK "Cascade on delete"
        int restaurant_id FK "Restaurant reference"
        int added_by FK "Nominated by user"
    }

    votes {
        int id PK
        int lobby_id FK "Cascade on delete"
        int user_id FK "Unique per (lobby, user)"
        int restaurant_id FK "Selected restaurant"
        timestamp voted_at "now()"
    }

    messages {
        int id PK
        int lobby_id FK "Cascade on delete"
        int user_id FK "Cascade on delete"
        string content "Chat text content"
        string image_url "Optional S3 image attachment"
        timestamp sent_at "now()"
    }
```

---

## 5. Detailed Execution Workflows & Sequence Diagrams

### 5.1 Real-Time Collaborative Lobby & Voting Consensus Flow

This flow illustrates the synchronous lifecycle of a room: from host creation and member joins to nominations, status transitions, live ballot updates, and final consensus spotlighting.

```mermaid
sequenceDiagram
    autonumber
    actor Host as Host User
    actor Member as Participant
    participant FE as Frontend Client
    participant Express as Express API
    participant Socket as Socket.IO Hub
    participant DB as PostgreSQL (Prisma)

    Host->>Express: POST /api/lobbies { name: "Dinner Crew" }
    Express->>DB: INSERT INTO lobbies (created_by, invite_code: "K7X9PQ", status: "active")
    DB-->>Host: 201 Created { id: 42, invite_code: "K7X9PQ" }

    Host->>Socket: emit('lobby:join', 42)
    Socket->>Socket: socket.join('lobby:42')

    Member->>Express: POST /api/lobbies/join { invite_code: "K7X9PQ" }
    Express->>DB: INSERT INTO lobby_members (lobby_id: 42, user_id: member.id)
    Express->>Socket: emitLobbyMembers(42, updatedMembers)
    Socket-->>Host: 'lobby:members' broadcast
    Socket-->>Member: 'lobby:members' broadcast

    Member->>Express: POST /api/lobbies/42/restaurants { api_place_id: "ChIJ..." }
    Express->>DB: INSERT INTO lobby_restaurant_options
    Express->>Socket: emitLobbyOptions(42, fullShortlist)
    Socket-->>Host: 'lobby:options' broadcast (Live Shortlist Update)
    Socket-->>Member: 'lobby:options' broadcast

    Host->>Express: PATCH /api/lobbies/42 { status: "voting" }
    Express->>DB: UPDATE lobbies SET status = "voting"
    Express->>Socket: emitLobbyState(42, { status: "voting" })
    Socket-->>Host: 'lobby:state' (Vote Cards Render)
    Socket-->>Member: 'lobby:state' (Vote Cards Render)

    Member->>Express: POST /api/lobbies/42/votes { restaurant_id: 101 }
    Express->>DB: UPSERT INTO votes (lobby_id: 42, user_id: member.id, restaurant_id: 101)
    Express->>Socket: emitLobbyVotes(42, allVotes)
    Socket-->>Host: 'lobby:votes' (Tally increments live)
    Socket-->>Member: 'lobby:votes' (Tally increments live)

    Host->>Express: PATCH /api/lobbies/42 { status: "closed", chosen_restaurant_id: 101 }
    Express->>DB: UPDATE lobbies SET status = "closed", chosen_restaurant_id = 101
    Express->>Socket: emitLobbyState(42, { status: "closed", winner: 101 })
    Socket-->>Host: 'lobby:state' (WinnerSpotlight Hero activates)
    Socket-->>Member: 'lobby:state' (WinnerSpotlight Hero activates)
```

---

### 5.2 Ephemeral Socket Ticket Authentication & Reconnection Resync

To ensure cross-origin security and support reliable reconnections across mobile or unreliable networks without exposing session credentials, FoodFinder utilizes an ephemeral socket ticket protocol.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Hook as useLobbySocket Hook
    participant AuthAPI as authApi.getSocketTicket()
    participant SocketClient as Socket.IO Client
    participant Express as Express Server
    participant SocketServer as Socket.IO Server

    Hook->>AuthAPI: GET /api/users/profile/socket-ticket
    Note over AuthAPI,Express: Carries HttpOnly JWT Session Cookie
    Express->>Express: Verify Session JWT -> Sign Ephemeral Ticket (60s TTL)
    Express-->>AuthAPI: 200 OK { ticket: "ey..." }

    Hook->>SocketClient: io(SOCKET_BASE_URL, { auth: { ticket } })
    SocketClient->>SocketServer: WS Handshake (Headers + ticket)
    SocketServer->>SocketServer: jwt.verify(ticket, JWT_SECRET)
    SocketServer-->>SocketClient: Handshake Authorized (Connected)

    SocketClient->>SocketServer: emit('lobby:join', lobbyId, ackCallback)
    SocketServer->>SocketServer: Verify DB Membership
    SocketServer-->>SocketClient: ack({ ok: true, lobbyId })
    SocketClient-->>Hook: connectionStatus = 'online'

    Note over SocketClient,SocketServer: Network Flake / Sleep Disconnect
    SocketServer--xSocketClient: Connection Dropped
    SocketClient-->>Hook: connectionStatus = 'connecting'

    Note over Hook,SocketServer: Automatic Reconnection Sequence
    SocketClient->>Hook: Trigger auth() token callback
    Hook->>AuthAPI: Fetch Fresh Ephemeral Ticket
    AuthAPI-->>Hook: New Ticket
    SocketClient->>SocketServer: Re-Handshake with Fresh Ticket
    SocketServer-->>SocketClient: Reconnected!
    SocketClient->>SocketServer: emit('lobby:join', lobbyId)
    SocketServer-->>SocketClient: ack({ ok: true })
    Hook->>Hook: callbacksRef.current.onResync() -> Refetch REST State
    Hook-->>User: Seamless, Lossless State Hydration
```

---

### 5.3 Adaptive Restaurant Search & 3-Page Candidate Pooling

FoodFinder utilizes an adaptive search algorithm that optimizes query semantics based on search distance, pooling candidates across up to 3 Google Places API pages to ensure an exact 18+18 two-batch grid layout.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Page as SearchPage.jsx
    participant Hook as useRestaurantSearch Hook
    participant Nominatim as OSM Nominatim
    participant Express as Backend Express
    participant Cache as Memory / Postgres Cache
    participant Google as Google Places API (New)

    User->>Page: Selects Radius: 10 Miles + Types "Center City"
    Page->>Nominatim: GET /search?q=Center+City&format=json
    Nominatim-->>Page: 200 OK { lat: 39.9526, lon: -75.1652 }

    Page->>Hook: useRestaurantSearch({ radius: 10, lat, lon })
    Note over Hook: Radius > 2 mi: Semantics set to "best restaurants"<br/>Rank Preference: Relevance (Prominence)

    Hook->>Express: GET /api/restaurants/search/nearby?radius=10&keyword=best+restaurants
    Express->>Cache: Check Memory TTL & DB
    alt Cache Hit
        Cache-->>Express: Return Cached Places
    else Cache Miss
        Express->>Google: POST /places:searchText (Page 1, pageSize=20)
        Google-->>Express: { places: [20], nextPageToken: "token_1" }
    end
    Express-->>Hook: { restaurants: [20], nextPageToken: "token_1" }

    Note over Hook: Candidate Pooling Loop (Filter by Haversine Distance <= 10 mi)<br/>Pool Count: 18 spots (< 36 target). Fetch Next Page!

    Hook->>Express: GET /api/restaurants/search/nearby?pageToken=token_1
    Express->>Google: POST /places:searchText (Page 2, pageToken="token_1")
    Google-->>Express: { places: [20], nextPageToken: "token_2" }
    Express-->>Hook: { restaurants: [20], nextPageToken: "token_2" }

    Note over Hook: Filter & Pool -> Total Valid Candidates = 36 reached.<br/>Break Pagination Loop!

    Hook-->>Page: Cached Dataset (36 Candidates)
    Page->>User: Renders Batch 1 (Cards 1-18)
    User->>Page: Clicks "Show 18 More Restaurants"
    Page->>User: Smoothly unrolls Batch 2 (Cards 19-36)
```

---

### 5.4 Direct-to-S3 Presigned Media Upload Flow

To keep the Express backend stateless, memory-efficient, and capable of high concurrency, profile avatar uploads bypass backend file buffers entirely.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Browser Client
    participant Express as Express Backend
    participant S3 as AWS S3 Bucket
    participant DB as PostgreSQL (Prisma)

    User->>Browser: Selects image file (avatar.png)
    Browser->>Express: GET /api/users/profile/avatar-upload-url?filename=avatar.png
    Note over Express: verifyJWT guard confirms authenticated user
    Express->>Express: Generate unique S3 object key: avatars/user_12_174123.png
    Express->>Express: Sign PutObjectCommand via @aws-sdk/s3-request-presigner (15m expiry)
    Express-->>Browser: 200 OK { uploadUrl: "https://s3.amazonaws.com/bucket/...", fileUrl: "..." }

    Browser->>S3: PUT /bucket/avatars/user_12_174123.png (Binary Stream)
    Note over Browser,S3: Direct TLS upload without backend CPU/memory overhead
    S3-->>Browser: 200 OK

    Browser->>Express: PUT /api/users/profile { profile_image_url: fileUrl }
    Express->>DB: UPDATE users SET profile_image_url = fileUrl WHERE id = 12
    DB-->>Express: Updated User Record
    Express-->>Browser: 200 OK { user: { profile_image_url: fileUrl } }
    Browser-->>User: Instant UI avatar refresh across Navbar & Lobbies
```

---

## 6. Security & Protection Architecture

1. **Authentication & Session Tokens:**
   - Stateless JWT tokens signed with `HS256` secret (`JWT_SECRET`).
   - Transported via `HttpOnly`, `SameSite=Lax` browser cookies, immunizing the application against cross-site scripting (XSS) credential theft.
   - In production environments, `secure: true` enforces HTTPS-only cookie transmission.
2. **WebSocket Single-Use Ephemeral Tickets:**
   - Eliminates the vulnerability of passing long-lived credentials over WebSocket handshakes.
   - Tickets are signed with a 60-second expiration window and verified strictly against the user ID in the database.
3. **Third-Party API Masking & Key Secrecy:**
   - The Google Places API key is never exposed to the frontend.
   - All external restaurant requests are brokered through the backend `/api/restaurants` proxy.
   - Image assets are proxied through `/api/restaurants/photo/:photoName`, shielding the client from upstream billing parameters and token leaks.
4. **Strict Authorization Guards:**
   - Multi-tiered middleware verification: `verifyJWT` -> `isLobbyMember` -> `isLobbyCreator`.
   - Ensures users cannot modify lobby settings, view room messages, or vote in lobbies they are not actively a part of.

---

## 7. Infrastructure & Deployment Topology

The application is structured for production deployment across Dockerized container platforms (e.g., AWS ECS, Google Cloud Run, or Kubernetes).

```mermaid
graph LR
    subgraph Internet["Public Internet"]
        ClientTraffic["HTTPS Client Requests"]
    end

    subgraph CDNEdge["Nginx Edge Container (Port 3000)"]
        StaticServer["Nginx 1.27 Alpine<br/>• Static React Bundle Assets<br/>• Brotli / Gzip Compression<br/>• Cache Control Headers"]
    end

    subgraph AppContainer["Express API Container (Port 5000)"]
        NodeRuntime["Node.js 24 Alpine<br/>• Express 5 Application<br/>• Socket.IO Real-Time Engine<br/>• node-cache Memory Store<br/>• Daily Cron Job"]
    end

    subgraph ManagedCloud["Managed Cloud Services"]
        PostgresInstance[("Managed PostgreSQL 16<br/>(e.g., AWS RDS / Cloud SQL)<br/>• Connection Pooling via Prisma<br/>• Automated Daily Snapshots")]
        S3Bucket["AWS S3 Bucket<br/>• CORS Configured for Direct PUT<br/>• Public Read Policy on /avatars/"]
        GoogleCloud["Google Cloud Platform<br/>• Places API (New) Quota / Billing"]
    end

    ClientTraffic -->|Port 3000| StaticServer
    ClientTraffic -->|Port 5000| NodeRuntime
    NodeRuntime --> PostgresInstance
    NodeRuntime --> GoogleCloud
    NodeRuntime --> S3Bucket
    ClientTraffic -->|Direct PUT (Avatars)| S3Bucket
```

### Cache & Performance Specifications
- **Client Cache (HTTP):** Static JS/CSS chunks compiled by Vite use content hashing with `Cache-Control: public, max-age=31536000, immutable`. The entry point `index.html` is served with `Cache-Control: no-cache, no-store, must-revalidate` to prevent stale bundle references.
- **Client Cache (TanStack Query):** Restaurant searches retain a 5-minute `staleTime` and 30-minute `gcTime`. Reopening an inspected restaurant details modal serves instantly from memory.
- **Backend Cache (L1 Memory):** In-memory `node-cache` caches recent restaurant detail responses with a 5-minute TTL.
- **Backend Cache (L2 Relational):** Google Places search results and detail queries are asynchronously persisted to the PostgreSQL `restaurants` table.
- **Scheduled Maintenance:** A scheduled cron job executes daily to purge cached restaurant entries older than 30 days (`cached_at < NOW() - INTERVAL '30 days'`), preventing database bloat while respecting Google API data caching terms.
