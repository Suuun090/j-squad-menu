# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Use British English in all text output, comments, user-facing strings, and code (variable names, function names, etc.).

## Project Overview

Double J Menu is a static PWA for managing a digital menu. It uses vanilla JavaScript with Supabase as the backend (no build step required).

## Running Locally

No build process exists. Serve files with any static HTTP server:

```bash
python3 -m http.server 8000
```

## Architecture

**Stack:** Vanilla JS + CSS, Supabase (PostgreSQL + real-time), Service Worker for offline support.

**Key files:**
- `index.html` — Single-page app entry point with the add/edit form and menu container
- `js/supabase-config.js` — Supabase client init + `db` object (exposed as `window.db`) with `getMenuItems`, `addMenuItem`, `updateMenuItem`, `deleteMenuItem`, `subscribeToChanges`
- `js/app.js` — All application logic: DOM manipulation, form handlers, tag management, real-time subscription handling, toast notifications, online/offline indicator
- `js/install.js` — PWA install prompt handling
- `service-worker.js` — Cache-first offline strategy (cache name: `double-j-menu-v4`)
- `css/style.css` — Main styles with CSS variables (primary: `#89CFF0`)
- `css/tags.css` — Tag input/display styles
- `supabase-migration.sql` — DB schema: migrated `tag` → `tags TEXT[]` on `menu_items` table

**Data model:** Single `menu_items` table with `id`, `name`, `description`, `tags TEXT[]`, `created_at`.

**Global state:** `window.selectedTags` array tracks tags for the currently edited item.

**Script load order matters** (in `index.html`): Supabase CDN → `supabase-config.js` → `app.js` → `install.js`. The `db` object must be on `window` before `app.js` runs.

## Real-time Updates

Supabase Postgres Changes subscription is set up in `subscribeToChanges()` — any INSERT/UPDATE/DELETE on `menu_items` triggers a full re-render via `loadMenuItems()`.
