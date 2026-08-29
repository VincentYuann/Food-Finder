# FoodFinder — Progress Report 5

**Course:** CS 375 — Web Development

**Repository:** https://github.com/VincentYuann/Food-Finder

**Reporting period:** Week of August 23 – August 29, 2026

**Group members:** Jeffrey Cheung, Vincent Yuan, Alvin Cheung

---

## 1. Contract Feature Checklist

- [x] **User accounts, profile, login/password**
- [x] **Restaurant search (via Google Places or Yelp API) + save to a personal list**
- [x] **Lobby creation and joining** 
- [x] **Voting system**
- [x] **Real-time lobby chat (WebSocket)**
- [ ] **Account archive**

---

## 2. Work Completed Last Week

**Vincent Yuan** — 9 commits, ~1,550 insertions, on the frontend build-out and
project documentation.

- Wrote the project documentation the repo had been missing: `DESIGN.md`
  (248 lines) and `PRODUCT.md` (67 lines), then `README.md` (274 lines, revised
  the next day) covering the architecture overview, quickstart, and API spec
- Added `ui-feedback.js` (146 lines) — accessible toast notifications backed by
  an `aria-live` region and in-page confirmation dialogs, replacing the browser
  `alert()`/`confirm()` calls the dashboard and lobby had been using
- Built the **winner spotlight** on the lobby page: once a lobby closes, the
  most-voted restaurant is banner-lined at the top ("Tonight's Pick") with its
  vote count, and the shortlist re-sorts so the winner leads

**Jeffrey Cheung** — 2 commits, 542 insertions, making the rest of the lobby
live and fixing restaurant photos.

- Options, votes, and the lobby record itself (status, members, chosen
  restaurant) now broadcast over Socket.IO after every write, so vote cards, the
  ready button, and the phase change appear without a reload. Cache
  invalidation moved inside the broadcast helpers, so a write path can no longer
  push a fresh status while the REST endpoint serves the old one for an hour
- Added `rehydrate()` in `lobbyOptionService`: a shortlisted restaurant whose
  cached columns were purged is re-fetched from Google rather than rendering as
  a nameless card
- Fixed restaurant images. Photos are now served through presigned S3 URLs, with
  a health probe (`isS3Usable`) that range-GETs a single byte, caches the verdict
  for 60 seconds, and falls back to Google Places when the credentials are
  rejected — so bad S3 config degrades instead of breaking every image

**Alvin Cheung** — 3 commits, small but structural (52 insertions, 92 deletions).

- Removed the creator-only finalize step. Any member's ready toggle now advances
  the lobby: `active` -> `voting` when everyone is ready, and `voting` ->  `closed`
  when everyone is ready again, stamping `closed_at`. This deleted 91 lines of
  creator-vs-member branching from `lobby.js`
- Broadcast the votes on that phase change, so tallies are correct the moment a
  lobby flips rather than on the next click
- Added the **live vote tally banner** shown during the voting phase —
  "Live Vote Count: *n* / *m* votes cast" — updating as votes stream in

---

## 4. Git Contributors

Output of `git log --all | grep 'Author:' | sort | uniq`:

```
Author: Alvin Cheung <ac4633@drexel.edu>
Author: Jeffrey <jc4759@drexel.edu>
Author: Vincent Yuan <vincentyuan1020@gmail.com>
```
