# FoodFinder — Progress Report 3

**Course:** CS 375 — Web Development

**Repository:** https://github.com/VincentYuann/Food-Finder

**Reporting period:** Week of August 9 – August 15, 2026

**Group members:** Jeffrey Cheung, Vincent Yuan, Alvin Cheung

---

## 1. Contract Feature Checklist

- [x] **User accounts, profile, login/password**
- [x] **Restaurant search (via Google Places or Yelp API) + save to a personal list**
- [x] **Lobby creation and joining** (friends join a lobby for an outing)
- [ ] **Voting system** — friends pick from saved restaurants, majority wins
- [x] **Real-time lobby chat (WebSocket)**
- [ ] **Account archive** — past visited restaurants + past lobby chats

---

## 2. Work Completed Last Week

**Jeffrey Cheung** — implemented real-time chat, the fifth contract feature,
across 5 commits.

- Attached Socket.IO to the existing Express server so live chat shares one port.
  The handshake authenticates with the same HttpOnly JWT cookie the REST API uses
- Added lobby close/delete controls and extracted the helpers each page had been
  duplicating into `api.js` (881 insertions, 738 deletions)

**Vincent Yuan** — 8 commits repairing frontend-to-backend communication.

- Traced and fixed the cookie configuration that was blocking authenticated
  cross-origin requests, over three commits in `userController.js`, including
  the logout rebound bug
- Reverted the attempt to hide the backend URL in `.env`; the vanilla frontend
  has no build step to substitute the value, so `API_BASE_URL` is derived from
  `window.location.hostname` in `api.js`
- Converted the frontend to ES modules, with `api.js` exporting the shared
  helpers and each page script importing them, replacing the global-script
  arrangement that an earlier attempt at `"type": "module"` had broken

**Alvin Cheung** — added member ready-status, across 6 commits.

- Added a `ready` boolean to `LobbyMember` in `schema.prisma` so a lobby can
  track who has confirmed before an outing starts
- Gated lobby closing on it: the creator can only close once every other member
  is marked ready (52 insertions in `lobby.js`)
- Reworked how members render, showing a Ready button to members and a Close
  button to the creator, and removed a stray committed image asset

---

## 3. Planned Work for the Coming Week

**Group priority:** the voting system, the last contract feature with a
foundation already in place. The account archive still has no work at all.

**Jeffrey Cheung**

- Wire the personal saved list into the dashboard UI (carried over from
  Report 2)
- Begin the **account archive**, the only contract feature not started

**Vincent Yuan**

- **Rebuild the test suite.** `backend/tests/` was deleted in `f2c02e8` rather
  than repaired, so the project now has no tests while `npm test` still invokes
  Jest — this is a regression from the plan in Report 2
- Restore a per-environment backend URL that does not depend on a build step

**Alvin Cheung**

- Build the **voting UI**. The Vote button still fires a "coming soon" alert,
  though `POST` and `GET /api/lobbies/:id/votes` both work
- Implement the **majority-wins calculation** — tally votes per restaurant,
  compare against member count, set `chosen_restaurant_id` automatically

---

## 4. Git Contributors

Output of `git log --all | grep 'Author:' | sort | uniq`:

```
Author: Alvin Cheung <ac4633@drexel.edu>
Author: Jeffrey <jc4759@drexel.edu>
Author: Vincent Yuan <vincentyuan1020@gmail.com>
```
