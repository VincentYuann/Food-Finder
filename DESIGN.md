---
name: FoodFinder
description: A group restaurant decision tool that feels like exploring a food court with friends.
colors:
  tomato: "#ff6347"
  tomato-hover: "#e5533d"
  star-gold: "#f59e0b"
  surface-white: "#ffffff"
  surface-off-white: "#fcfcfc"
  doodle-bg: "#f7f7f7"
  text-primary: "#333333"
  text-secondary: "#666666"
  text-muted: "#777777"
  text-heading-dark: "#111111"
  border-light: "#eeeeee"
  border-input: "#dddddd"
  status-active-bg: "#dcfce7"
  status-active-text: "#166534"
  status-eating-bg: "#ffedd5"
  status-eating-text: "#9a3412"
  status-closed-bg: "#fee2e2"
  status-closed-text: "#991b1b"
  danger-bg: "#fef2f2"
  danger-text: "#dc2626"
typography:
  display:
    fontFamily: "Poppins, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 500
    lineHeight: 1.3
  subtitle:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Lato, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Poppins, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 500
    lineHeight: 1.4
  small:
    fontFamily: "Lato, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  xxl: "2.5rem"
  section: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.tomato}"
    textColor: "{colors.surface-white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.tomato-hover}"
  button-secondary:
    backgroundColor: "#f0f0f0"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.25rem"
  card-restaurant:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "0"
  input-text:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.8rem 1rem"
---

# Design System: FoodFinder

## Overview

**Creative North Star: "The Food Court Map"**

FoodFinder's design is casual, social, and navigational — like wandering through a food court with friends, pointing at options, debating, and deciding. The interface should feel energetic and playful without being childish; it's a tool people use in the moment, often on their phones, often while hungry and impatient.

The signature personality lives in the **ambient food doodle background** — a translucent, repeating SVG pattern of food shapes (pizza slices, utensils, plates) that bleeds through behind the main content containers. This layer gives every page a sense of place and warmth that generic white-on-white apps lack. Content surfaces (cards, panels, sidebars) are opaque white, floating above the doodle layer.

The tomato-red accent (#ff6347) unifies the whole experience: headings, CTAs, active chat bubbles, focus rings, and the doodle strokes. It's a food color — warm, appetizing, and unmistakable.

**Key Characteristics:**
- Warm and energetic, not corporate or sterile
- Ambient background texture (food doodles) behind clean white surfaces
- Tomato-red as the single dominant accent
- Flat-by-default: depth appears only on interaction (hover lifts, focus rings)
- Friendly, casual typographic voice (Poppins headings + Lato body)

## Colors

The palette is deliberately narrow: one warm accent, clean neutrals, and semantic status colors. Restraint keeps the food imagery and restaurant photos as the richest visual layer.

### Primary
- **Tomato** (#ff6347): The signature accent. Headings, primary buttons, links, focus rings, chat bubbles (own messages), member avatars, spinner accents, and the food doodle strokes. Named for the CSS color keyword it descends from.
- **Tomato Hover** (#e5533d): Darkened primary for button hover and pressed states.

### Secondary
- **Star Gold** (#f59e0b): Restaurant star ratings only. Never used as a general accent or button color.

### Neutral
- **Surface White** (#ffffff): Cards, containers, modals, chat containers, sidebar widgets. The opaque layer above the doodle background.
- **Surface Off-White** (#fcfcfc): Dashboard sidebar background. Barely warmer than white, creating a subtle distinction without a hard edge.
- **Doodle Background** (#f7f7f7): The body background behind the SVG food pattern. A cool near-white that lets the translucent doodle strokes float.
- **Text Primary** (#333): Body text, card titles, labels.
- **Text Secondary** (#666): Meta information, descriptions, chat author names.
- **Text Muted** (#777): Addresses, timestamps, tertiary info.
- **Border Light** (#eee): Card borders, dividers, sidebar separators.
- **Border Input** (#ddd): Default input field borders.

### Status
- **Active/Open** (bg: #dcfce7, text: #166534): Active lobbies, open restaurants.
- **Eating** (bg: #ffedd5, text: #9a3412): Lobby in eating phase.
- **Closed** (bg: #fee2e2, text: #991b1b): Closed lobbies, closed restaurants.

### Named Rules
**The Tomato Monopoly Rule.** Tomato red is the only chromatic accent in the base system. Star Gold exists for ratings and nothing else. If a new feature needs color differentiation, derive it from the status palette, not from a new accent.

## Typography

**Display Font:** Poppins (with system sans-serif fallback)
**Body Font:** Lato (with -apple-system, BlinkMacSystemFont, Segoe UI, Roboto fallback)

**Character:** Poppins brings rounded, approachable geometry to headings — it reads as friendly without being informal. Lato carries the body text with neutral readability. Together they feel like a well-designed menu board: clear hierarchy, easy scanning, personality in the titles.

### Hierarchy
- **Display** (700, 2.2rem, 1.2 line-height): Page titles — "Your Dashboard", "Find Your Next Meal". Always tomato-colored.
- **Title** (500, 1.6rem, 1.3 line-height): Section headings — "Restaurant Options", "Lobby Chat". Dark text (#333).
- **Subtitle** (500, 1.1rem, 1.4 line-height): Sidebar section headings, widget titles. Muted (#555).
- **Body** (400, 1rem, 1.5 line-height): All running text, descriptions, chat messages. Lato.
- **Label** (500, 0.95rem, 1.4 line-height): Button text, form labels, nav links. Poppins.
- **Small** (400, 0.85rem, 1.4 line-height): Addresses, timestamps, meta text. Lato.

### Named Rules
**The Poppins Headings Rule.** Poppins is used exclusively for headings, buttons, and labels. Body text is always Lato. Mixing them (Poppins body or Lato headings) breaks the hierarchy.

## Layout

The app uses a sidebar + main content pattern for the dashboard, and a centered container pattern for search, lobby, and auth pages. Max container widths are 1400px (dashboard, lobby) and 1200px (search).

- **Dashboard:** Two-column flex layout. Sidebar is 280px fixed, main content fills remaining space. Collapses to single column below 768px.
- **Search/Lobby:** Full-width centered container with 2rem body padding. Lobby has a main + sidebar (300px) flex layout that collapses below 992px.
- **Auth:** Centered single card, 450px max-width, vertically centered on viewport.
- **Restaurant grids:** CSS Grid with `auto-fill, minmax(280-300px, 1fr)` — responsive without explicit breakpoints.
- **Spacing rhythm:** Based on rem multiples. Section gaps use 2-2.5rem, internal padding uses 1-1.5rem, element gaps use 0.5-0.75rem.

## Elevation & Depth

**The Flat-by-Default Rule.** Surfaces rest flat. Shadows appear only as a response to state — hover, focus, or modal overlay. This keeps the resting UI clean and lets the food doodle background breathe through the gaps.

### Shadow Vocabulary
- **Ambient rest** (`box-shadow: 0 2px 8px rgba(0,0,0,0.04)`): Dashboard cards at rest. Barely visible — just enough to separate from the white sidebar.
- **Container** (`box-shadow: 0 5px 25px rgba(0,0,0,0.05)`): Search controls panel, lobby header, sidebar widgets, auth container. The primary "surface" shadow.
- **Hover lift** (`box-shadow: 0 8px 25px rgba(0,0,0,0.1)` + `translateY(-5px)`): Restaurant cards on hover. The lift + shadow increase makes the card feel pickable.
- **Card hover (dashboard)** (`box-shadow: 0 4px 12px rgba(0,0,0,0.08)` + `translateY(-2px)`): Subtler lift for dashboard list cards.
- **Modal overlay** (`backdrop-filter: blur(4px)` + `rgba(0,0,0,0.6)` background): Full-viewport dim with blur behind restaurant detail modals.
- **Modal content** (`box-shadow: 0 10px 30px rgba(0,0,0,0.2)`): The modal card itself. The heaviest shadow in the system.
- **Button hover** (`box-shadow: 0 4px 12px rgba(255,99,71,0.3)` + `translateY(-2px)`): Primary buttons emit a tomato-tinted glow on hover.

## Shapes

Gently curved edges throughout. The radius scale expresses three levels of containment:

- **Small elements** (6px): Status pills, meta tags, input radii on some pages.
- **Interactive elements** (8px): Buttons, text inputs, small cards, scrollbar thumbs.
- **Container elements** (12px): Restaurant cards, search panel, lobby header, chat container, modals, sidebar widgets. The dominant radius in the system.
- **Auth container** (16px): The largest radius, used only on the auth card for a softer, centered feel.
- **Pill** (999px): Chat status badges, tags.

No sharp corners anywhere. No circular containers (only member avatars use `border-radius: 50%`).

## Components

### Buttons
- **Shape:** Gently rounded (8px radius)
- **Primary:** Tomato background, white text, Poppins 500, 0.75rem × 1.25rem padding.
- **Hover:** Darkens to #e5533d, lifts 2px, emits a tomato-tinted shadow glow.
- **Secondary:** Light gray (#f0f0f0) background, dark text, 1px #ddd border.
- **Danger:** Near-white red (#fef2f2) background, red text (#dc2626), 1px red border (#fecaca).
- **Warning:** Near-white amber (#fffbeb), amber text (#b45309), 1px amber border (#fde68a).

### Cards / Containers
- **Restaurant Card:** White background, 12px radius, 1px #eee border (lobby) or no border (search). Vertical stack: image → info → action buttons. Hover lifts 5px with shadow increase.
- **Dashboard Card:** White background, 12px radius, 1px #eee border. Horizontal layout: content left, action buttons right. Hover lifts 2px.
- **Container Panels:** White, 12px radius, container shadow. Used for search controls, lobby header, chat, sidebar widgets.

### Inputs / Fields
- **Style:** White background, 1px #ddd border, 8px radius, Lato font.
- **Focus:** Border shifts to tomato, emits a 3px tomato-tinted ring (`rgba(255,99,71,0.2)`).
- **Sidebar inputs:** Same treatment, slightly larger padding (0.8rem × 1rem).

### Chat Bubbles
- **Others' messages:** Light gray (#f1f1f1) background, dark text, 12px radius. Left-aligned, max-width 75%.
- **Own messages:** Tomato background, white text, 12px radius. Right-aligned. This is one of the strongest expressions of the tomato accent.

### Member Avatars
- **Style:** 32px circle, tomato background, white uppercase initial letter.
- **Creator badge:** Crown emoji (👑) appended after the name.

### Status Badges
- **Style:** Pill-shaped (999px radius), semantic background + text color pairs, small font (0.85rem), bold weight.

### The Ambient Background (Signature)
- **What:** An inline SVG pattern (`background-image` on `body`) of translucent food doodles — pizza slices, utensils, plates, wavy lines — in tomato and gray strokes at low opacity (0.15-0.20).
- **Why:** This is the design's signature element. It adds warmth, personality, and a sense of "food place" without competing with content. All content containers sit opaque white on top of it.
- **Rule:** The doodle layer lives on `body` only. Don't repeat it inside cards or modals. Don't increase opacity. Don't remove it — it's the one thing that separates FoodFinder from generic white-box apps.

## Do's and Don'ts

### Do:
- **Do** keep the food doodle background on every page. It's the visual identity.
- **Do** use tomato (#ff6347) as the sole chromatic accent for interactive and brand elements.
- **Do** use Poppins for headings/buttons and Lato for body/inputs. Consistency is the whole game.
- **Do** lift cards on hover — the `translateY` + shadow increase makes the interface feel responsive and alive.
- **Do** use the tomato-tinted focus ring (`0 0 0 3px rgba(255,99,71,0.2)`) on all focusable inputs.
- **Do** use semantic status colors (green/amber/red backgrounds) for lobby and restaurant states.

### Don't:
- **Don't** introduce new accent colors. No purple, no blue, no teal. The tomato + gold + status triad is the full palette.
- **Don't** use shadows at rest except the minimal ambient rest shadow on dashboard cards. Flat-by-default.
- **Don't** put the food doodle pattern inside cards, modals, or overlays — it belongs on the body only.
- **Don't** use Poppins for body text or Lato for headings. The pairing only works with clear role separation.
- **Don't** use generic placeholder images. If a restaurant has no photo, show the text fallback in the gray placeholder area — no stock food photography.
- **Don't** use bounce or elastic easing on hover animations. The current `ease` and `ease-out` curves are correct.
