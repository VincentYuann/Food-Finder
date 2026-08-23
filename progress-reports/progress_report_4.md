# FoodFinder — Progress Report 4

**Course:** CS 375 — Web Development

**Repository:** https://github.com/VincentYuann/Food-Finder

**Reporting period:** Week of August 16 – August 22, 2026

**Group members:** Jeffrey Cheung, Vincent Yuan, Alvin Cheung

---

## 1. Contract Feature Checklist

- [x] **User accounts, profile, login/password**
- [x] **Restaurant search (via Google Places or Yelp API) + save to a personal list**
- [x] **Lobby creation and joining** (friends join a lobby for an outing)
- [ ] **Voting system** — friends pick from saved restaurants, majority wins
  *(voting itself now works end to end; the majority-wins result is not yet
  completed)*
- [x] **Real-time lobby chat (WebSocket)**
- [ ] **Account archive** — past visited restaurants + past lobby chats

---

## 2. Work Completed Last Week

**Alvin Cheung** — built the voting UI, across 8 commits.

- Added a **voting phase**: when every member marks ready, the lobby flips from
  `active` to `voting` automatically and everyone's ready flag resets for the
  new phase (43 insertions in `lobbyController.js`)
- Built the client-side voting controls in `lobby.js` — a Vote button per
  restaurant option, a live vote count badge, and a "Voted ✓" state — replacing
  the placeholder that had been there since Report 2
- Gated voting so it is only offered while the lobby is in the `voting` status,
  and locked further changes once every member has cast a vote
  (84 insertions in `lobby.js`)
- Restricted option removal so a member can only remove a restaurant they added
  themselves

**Vincent Yuan** — 8 commits, mostly on cost control and the Google Places
caching layer.

- Extended the `Restaurant` model with `primary_type`, `user_rating_count`,
  `phone_number`, `website_url`, `google_maps_url` and `opening_hours`, and made
  the Google-owned columns nullable so the purge can blank them
- Built the shared details modal (`modal.js`), added a cuisine dropdown and
  mile-based distance to search, and filled in the CSS — the stylesheets that
  had been empty since Report 2 are now ~1,100 lines, plus a logo and favicon
- Added loading restaurant options into a lobby from either the saved list or a
  search, and removing them again (273 insertions)

**Jeffrey Cheung** — 2 commits making the lobby member list live.

- Added `services/lobbyMemberService.js` as the single source of the member-list
  shape, so the socket snapshot and `GET /api/lobbies/:id/members` return the
  identical payload and one renderer handles both
- Broadcast the member list over Socket.IO after any join, removal, or ready
  change, so ready tallies and the host's Close Lobby button update without a
  refresh

---

## 3. Planned Work for the Coming Week

**Group priority:** finish voting by declaring a winner, and start the account
archive — the only contract feature with no work at all, now in its third
consecutive report.

**Alvin Cheung**

- Implement the **majority-wins calculation** (carried over from Reports 2
  and 3). Votes are cast, stored, and counted on screen, but nothing tallies
  them into a result: `chosen_restaurant_id` exists in the schema and is read
  back by `getLobby`, and no code ever writes it
- Move the lobby to `closed` and show the winning restaurant once the tally
  resolves

**Jeffrey Cheung**

- Begin the **account archive** (carried over from Report 3). The dashboard's
  "Your Lobbies" section lists closed lobbies, but a closed lobby can be deleted
  outright, so there is no record of past visits or past chats

**Vincent Yuan**

- **Rebuild the test suite** (carried over from Reports 2 and 3). `backend/tests/`
  is still gone, `npm test` still invokes Jest, and the project has now shipped
  three weeks of features with no automated tests

---

## 4. Git Contributors

Output of `git log --all | grep 'Author:' | sort | uniq`:

```
Author: Alvin Cheung <ac4633@drexel.edu>
Author: Jeffrey <jc4759@drexel.edu>
Author: Vincent Yuan <vincentyuan1020@gmail.com>
```
