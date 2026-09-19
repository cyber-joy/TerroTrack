# Movie & TV Gallery — a single-plugin media tracker for Obsidian

Everything lives in plain JSON files. Everything else — search, filters, an
"Add" flow with live TMDB search, a full detail view, editable personal
ratings and notes, stats, backup/import — is one self-contained plugin.
No Dataview, no Templater, nothing else required. Movies and TV shows
share one install, one TMDB key, one settings screen — switch between
them with the tabs at the top of the block.

## Install

1. In your vault: `.obsidian/plugins/movie-gallery/`
2. Copy `manifest.json`, `main.js`, `styles.css` into that folder.
3. Settings → Community plugins → enable "Movie Gallery."
4. Settings → Movie Gallery → paste your TMDB API key.
5. In any note:
   ````
   ```movie-gallery
   ```
   ````

That one block gives you both **🎬 Movies** and **📺 TV Shows** tabs. Works
the same way on desktop and mobile.

## Using it

**Adding movies/shows** — click "+ Add Movie" or "+ Add Show." Search
TMDB at the top (results update as you type), or skip straight to the
"OR ENTER MANUALLY" form below it for anything not on TMDB.

**The gallery** — search matches title, director/creator, or cast. Status
and Genre filters sit in the main toolbar; the funnel icon expands Year,
Language, Rating, and My Rating. Sort by whatever you like. ⚙ opens
Gallery Settings, 📊 opens Stats — each tab (Movies/TV) has its own.

**A detail view** — click any poster. Status and My Rating are editable
right there (click Status to toggle, use the My Rating dropdown) — no
need to open Edit for either. Edit covers everything else. TV shows get
their own fields too: First Air Date, Episode Runtime, Seasons, Episodes,
Creator, and the series' own TMDB status (Ended/Returning). Similar
Movies/Shows at the bottom pulls from TMDB's recommendations, with a
one-tap add.

**Gallery Settings** — choose which fields show on each card, set a fixed
column count or let it size itself, and:
- **Update Database** re-fetches TMDB info for everything (one request
  each), preserving your watched status, notes, and personal ratings.
- **Backup** exports as `.csv` (every field, fully restorable) or `.txt`
  (a plain numbered title/year list). On desktop this opens the OS save
  dialog so you choose exactly where it goes; on mobile it saves to the
  vault root.
- **Import** auto-detects the file. For movies: this plugin's own `.csv`
  backup (full round-trip), **Letterboxd** exports (`watched.csv`,
  `ratings.csv`, `diary.csv`, `watchlist.csv`), and **IMDb** exports
  (ratings or watchlist). For TV shows: this plugin's own backup, and
  **IMDb** exports too — IMDb's export mixes movies and TV in one file
  (a "Title Type" column tells them apart), so importing the same file
  into Movies and then into TV Shows picks up the right entries in each
  and skips the rest automatically. All IMDb matching goes through the
  exact IMDb ID when possible, falling back to a title/year search.
  IMDb/Letterboxd import needs your TMDB key, since neither export
  includes posters on its own. Letterboxd doesn't track TV shows, so
  that format is movies-only.

**Stats** — total/watched/to-watch counts, a "total watch time" banner
with a playful tier badge, a Watched% donut, a genre breakdown pie with
dynamic leader lines, and Viewing Habits (favorite year, top
director/creator, most-seen actor). Tap a habit tile to jump straight to
those titles in your gallery.

## Data

Movies live in one JSON file (`movies.json` by default), TV shows in
another (`tvshows.json` by default) — both configurable in settings.

Movie entry:

```json
{
  "id": 438631,
  "title": "Dune",
  "year": "2021",
  "poster_path": "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "rating": "8.2",
  "myRating": "9",
  "watched": true,
  "release_date": "2021-10-22",
  "runtime": 155,
  "original_language": "en",
  "budget": 165000000,
  "genres": "Science Fiction, Adventure",
  "director": "Denis Villeneuve",
  "cast": "Timothée Chalamet, Rebecca Ferguson, ...",
  "overview": "...",
  "notes": "",
  "trailer_key": "8g18jFHCLXk"
}
```

TV show entry:

```json
{
  "id": 1396,
  "name": "Breaking Bad",
  "year": "2008",
  "poster_path": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  "rating": "8.9",
  "myRating": "10",
  "watched": true,
  "first_air_date": "2008-01-20",
  "episode_runtime": 47,
  "original_language": "en",
  "genres": "Drama, Crime",
  "creators": "Vince Gilligan",
  "cast": "Bryan Cranston, Aaron Paul, ...",
  "overview": "...",
  "notes": "",
  "trailer_key": "",
  "number_of_seasons": 5,
  "number_of_episodes": 62,
  "show_status": "Ended"
}
```

Both are plain text — hand-edit them directly if you ever want to, or fix
things outside Obsidian entirely.

