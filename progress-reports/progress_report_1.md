# FoodFinder — Progress Report 1

**Course:** CS 375 — Web Development

**Repository:** https://github.com/VincentYuann/Food-Finder

**Reporting period:** Week of July 27 – August 1, 2026

**Group members:** Jeffrey Cheung, Vincent Yuan, Alvin Cheung

---

## 1. Contract Feature Checklist

- [x] **User accounts, profile, login/password**
- [ ] **Restaurant search (via Google Places or Yelp API) + save to a personal list**
- [ ] **Lobby creation and joining** (friends join a lobby for an outing)
- [ ] **Voting system** — friends pick from saved restaurants, majority wins
- [ ] **Real-time lobby chat (WebSocket)**
- [ ] **Account archive** — past visited restaurants + past lobby chats

---

## 2. Work Completed Last Week

**Vincent Yuan** — contributed the `Prototype (#1)` merge, ~30 files and the
largest single contribution of the period.

- Implemented the full auth flow: bcrypt, JWT, cookie sessions, `verifyJWT`
- Built frontend scaffolding (`index.html`, `login.html`, `auth.js`, `dashboard.js`)
- Added Docker/docker-compose config and a Jest + Supertest test file
- Earlier: initial project setup, `.env.example`, first merge-conflict resolution

**Jeffrey Cheung** — established the database layer and backend foundation.

- Configured the Express + Prisma + PostgreSQL stack and got the server booting,
  including the driver adapter newly required by Prisma 7
- Built the SQL design into a full Prisma schema — column types,
  cascade rules, and composite unique constraints, producing 18 foreign keys
- Generated and applied the migrations; removed `bills` and `bill_splits` after
  the group's scope decision

**Alvin Cheung** — repository setup and housekeeping.

- Two initial test commits verifying repository access
- Added `.gitignore` entries and removed committed `.DS_Store` files

---

## 3. Planned Work for the Coming Week

**Group priority:** fix the JWT payload mismatch (Section 4) and the broken test
suite. One small defect disables six endpoints, and little else can be tested
until it lands.

**Jeffrey Cheung**

- Fix the JWT defect and verify each affected route end to end
- Implement the **majority-wins calculation** — tally votes per restaurant,
  compare against member count, set `chosen_restaurant_id` automatically
- Add an endpoint exposing live vote tallies

**Vincent Yuan**

- **Research WebSockets** and integrate `socket.io` so vote counts update live
  for every lobby member; extend the same layer to chat
- Write `frontend/JavaScripts/lobby.js`, currently empty — the voting UI has no
  client-side logic
- Repair and expand the test suite to cover lobby and voting routes

**Alvin Cheung**

- **Decide between Google Places and Yelp Fusion**, validate the free tier, and
  implement the search endpoint that caches results into `restaurants`
- Wire search into the dashboard UI
- Fill in the four CSS files, all currently empty — the app has no styling

---


## 4. Git Contributors

Output of `git log --all | grep 'Author:' | sort | uniq`:

```
Author: Alvin Cheung <ac4633@drexel.edu>
Author: Jeffrey <jc4759@drexel.edu>
Author: Vincent Yuan <vincentyuan1020@gmail.com>
```