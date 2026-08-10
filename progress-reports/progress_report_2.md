# FoodFinder — Progress Report 2

**Course:** CS 375 — Web Development

**Repository:** https://github.com/J-Cheung123/foodfinder

**Reporting period:** Week of August 2 – August 8, 2026

**Group members:** Jeffrey Cheung, Vincent Yuan, Alvin Cheung

---

## 1. Contract Feature Checklist

- [x] **User accounts, profile, login/password**
- [x] **Restaurant search (via Google Places or Yelp API) + save to a personal list**
- [x] **Lobby creation and joining** (friends join a lobby for an outing)
- [ ] **Voting system** — friends pick from saved restaurants, majority wins
- [ ] **Real-time lobby chat (WebSocket)**
- [ ] **Account archive** — past visited restaurants + past lobby chats

---

## 2. Work Completed Last Week
**Alvin Cheung** — implemented restaurant search, the second contract feature.

- Chose Google Places over Yelp Fusion and validated the free tier
- Wrote `googlePlacesService.js` and extended the restaurant routes with search,
  details-with-caching, and save-to-cache endpoints (337 lines added)
- Built the search UI — `search.html` and `search.js`, 664 lines — with
  geolocation, an adjustable radius, and result cards

**Vincent Yuan** — refactoring and integration work across 6 commits.

- Refactored the restaurant routes, moving request handling out of
  `restaurantRoutes.js` into a dedicated `restaurantController.js` and cleaning
  up the corresponding frontend (772 insertions, 626 deletions)
- Removed the friend controller and routes per the group's scope decision
- Handled two merges from the shared remote

**Jeffrey Cheung** — implemented the lobby system, then recovered it.

- Built `lobbyController.js` with 14 endpoint handlers, plus
  `isLobbyMember` and `isLobbyCreator` middleware; lobby routes previously had
  no authorization checks
- Implemented join-by-invite-code; codes were generated but nothing consumed
  them, so joining was impossible
- Built the lobby page (`lobby.html`, `lobby.js`) and wired the dashboard's
  create and join forms

---

## 3. Planned Work for the Coming Week

**Group priority:** the voting system and real-time chat — the two remaining
contract features with active work. The account archive has not been started.

**Jeffrey Cheung**

- Implement the **majority-wins calculation** — tally votes per restaurant,
  compare against member count, set `chosen_restaurant_id` automatically
  (carried over; the lobby foundation it needs is now in place)
- Build the voting UI, which has no client-side logic yet

**Vincent Yuan**

- **Integrate WebSockets for live chat.** The message table and REST endpoints
  are already working, so this is live push only. Note that the JWT cookie is
  `httpOnly` with `sameSite: 'strict'`, so the token cannot be read by client
  JavaScript and is not sent on a cross-origin handshake — this needs either
  same-origin serving or a short-lived ticket endpoint
- **Repair the test suite** (carried over). It uses CommonJS `require` through
  `jest.mock()` hoisting in an ESM project and does not run at all

**Alvin Cheung**

- Wire the personal saved list into the dashboard UI
- Fill in the four CSS files, all still empty (carried over) — the app has no
  styling

---

## 4. Git Contributors

Output of `git log --all | grep 'Author:' | sort | uniq`:

```
Author: Alvin Cheung <ac4633@drexel.edu>
Author: Jeffrey <jc4759@drexel.edu>
Author: Vincent Yuan <vincentyuan1020@gmail.com>
```
