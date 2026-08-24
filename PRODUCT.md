# Product

impeccable:product-schema 1 

## Platform

web

## Users

Primary users are friend groups, couples, or coworkers trying to decide where to eat together — the classic "where should we go?" deadlock. Secondary use is solo discovery: browsing restaurants by cuisine, location, and name, and saving favorites for later.

Typical scenario: someone creates a lobby, shares the invite code, members join, everyone adds restaurant options from search or their saved list, and the group discusses and picks one via real-time chat.

## Product Purpose

FoodFinder turns the group restaurant decision from an endless back-and-forth into a structured, social, real-time experience. Users search for restaurants (by cuisine, name, and geolocation radius), save personal favorites, create lobbies with invite codes, collaboratively add restaurant options to a shared list, and chat in real time to reach a decision.

Success means the group lands on a restaurant faster than texting back and forth, and solo users build a personal collection of places they want to try.

## Positioning

The lobby mechanic — a shared, real-time room where everyone contributes restaurant options and discusses them with live chat — is the differentiator. Yelp and Google Maps are solo discovery tools. FoodFinder is a group decision tool that happens to include discovery.

## Operating Context

- Users search restaurants by cuisine type (15 categories), restaurant name, and GPS-based radius (1–30 miles).
- Users save restaurants to a personal list visible on their dashboard.
- Lobby flow: create → get invite code → share code → others join → members add restaurants from search or saved → real-time chat → decide.
- Real-time communication via Socket.IO.
- Auth is JWT-based with cookie storage.

## Capabilities and Constraints

**Existing capabilities:**
- User registration and login (bcrypt + JWT)
- Restaurant search via external API (Yelp/similar, proxied through backend)
- Personal saved restaurant list (CRUD)
- Lobby creation, joining via invite code, member management
- Real-time lobby chat (Socket.IO)
- Adding restaurants to a lobby from search or saved list
- Profile with avatar (S3 presigned uploads)
- Dockerized deployment (docker-compose with frontend + backend)
- Prisma ORM with PostgreSQL

**Tech stack:**
- Frontend: vanilla HTML/CSS/JS (no framework), ES modules, Poppins + Lato fonts
- Backend: Express 5, Prisma, PostgreSQL, Socket.IO, S3
- Deployment: Docker Compose, Jenkins CI pipeline

**Undecided:**
- Whether to add a voting/ranking mechanic for lobby restaurants (currently discussion-only)
- Whether to ship publicly or keep as a portfolio piece

## Evidence on Hand

- Working frontend with 4 pages: login, dashboard, search, lobby
- Custom SVG logo and favicon exist at `frontend/assets/`
- No testimonials, case studies, or marketing copy — this is a personal build
- No analytics or user research data

## Product Principles

1. **Group decisions over solo browsing.** The lobby is the core loop; solo discovery supports it.
2. **Low friction to participate.** A short invite code gets someone into a lobby — no app install, no complex onboarding.
3. **Real-time over async.** Chat and shared restaurant lists update live. The tool is for right-now decisions, not planning days ahead.
4. **Honest scope.** Ship what exists well rather than pretending features that don't exist yet.
