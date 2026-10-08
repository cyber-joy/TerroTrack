# TerroTrack

An [Obsidian](https://obsidian.md) plugin for tracking **Movies & TV Shows**. Discover trending titles and add them to your collection directly from the plugin. Your data is stored as plain JSON and can be exported as CSV.

![](Attachments/movie_library.png)
![](Attachments/tv_library.png)

## Quick Navigation

**[✨ Features](#-features)** ·
**[📖 Usage](#-usage)** ·
**[📸 Screenshots](#-screenshots)** ·
**[📦 Installation](#-installation)** ·
**[🚀 Quick Start](#quick-start)** ·
**[💾 Backup & Import](#-backup--import)** ·

## ✨ Features

**Libraries**
- 🎬 Movie & 📺 TV show libraries, each with its own card fields, filters, and stats
- 🖼️ Poster-based gallery with adjustable card size and column count
- 🎛️ Four-way status: **To Watch · Watching · Watched · Trashed**
- ❤️ Favourites — one-tap heart on posters, plus a favourites-only toolbar filter
- ⭐ Personal star ratings, 5 stars at half-star precision
- 📝 Personal notes with a preview card and a full reading/editing layer
- 📺 TV progress tracks seasons and episodes together, with a per-day logging date

**Discover** *(requires a TMDB API key)*
- ✨ Picked for you — recommendations built from your own ratings, genres, and watch history
- 🔥 Trending this week
- 🆕 In theaters now / On the air
- 📅 Coming soon — upcoming releases and new series

**Search, filter, sort**
- 🔍 Search by title, director/creator, and cast
- 🏷️ Filter by genre, year, language, TMDB rating, and your own rating (+ series status on TV)
- 📆 Dual-handle year picker with Range and Individual modes
- ↕️ Sort by Recently added, Title, Year, Rating, or Runtime, ascending or descending

**Stats**
- ⏱️ Total watch time with a playful tier badge
- 🍩 Watched / Watching / To Watch / Trashed breakdown as a donut
- 🥧 Genre distribution as a labelled pie
- 🎯 Viewing habits — favourite year, top director/creator, most-seen actor — click to jump to those titles
- 🗓️ GitHub-style activity heatmap with Week / Month / Year / All-time views, a Movies/TV/All filter, and current/longest streak tiles

**Data**
- 📄 Plain JSON storage — inspect, edit, or move it outside Obsidian
- 💾 CSV backups (full round-trip) and TXT exports
- 📥 Import from TerroTrack backups, IMDb, and Letterboxd (movies only)
- 🔄 Update database — re-fetch TMDB metadata while keeping your status, notes, ratings, and progress

---

## 📖 Usage

### Managing Your Library

**Add a title → Rate it → Track seasons & episodes → Add personal notes → Edit details → Update information → Watch trailer**

![](Attachments/demo-1.gif)

### Searching Your Library

Search your collection by title, director (creator, for TV), and cast.
> Title is always searched. Director and Cast can be toggled in **Gallery Settings** (both are on by default).

![](Attachments/demo-2.gif)

---

## 📸 Screenshots

<details>
<summary><strong>Similar Titles</strong></summary>
<br>

<p align="center">
  <img src="Attachments/similar_titles.png" width="48%" />
</p>

</details>

<details>
<summary><strong>⚙️ Gallery settings</strong></summary>
<br>

<p align="center">
  <img src="Attachments/gallery_settings.png" width="48%" />
  <img src="Attachments/import%26export.png" width="48%" />
</p>

</details>

<details>
<summary><strong>🎛️ Filters</strong></summary>
<br>

<p align="center">
  <img src="Attachments/filter-1.png" width="48%" />
  <img src="Attachments/filter-2.png" width="48%" />
  <img src="Attachments/filter-3.png" width="48%" />
  <img src="Attachments/filter-4.png" width="48%" />    
</p>

</details>

<details>
<summary><strong>📊 Library Stats</strong></summary>
<br>

<p align="center">
  <img src="Attachments/library_stats.png" width="48%" align="left" />
  <img src="Attachments/heatmap-1.png" width="48%" />
  <br>
  <img src="Attachments/heatmap-2.png" width="48%" />
  <br>    
  <img src="Attachments/heatmap-3.png" width="48%" />
</p>


</details>

---

## 📦 Installation

### Manual Installation

> Make sure to turn off restricted mode.
#### 1. Download
- Download **TerroTrack** from the [latest release](https://github.com/cyber-joy/TerroTrack/releases).
- Extract the ZIP file.
#### 2. location
- Open your Obsidian vault's plugin folder.
- Copy the entire plugin folder into it.
      
```
YourVault/
└── .obsidian/
    └── plugins/
```

#### 3. Enable the Plugin
- Open Obsidian **Settings** → **Community plugins**
- Find **TerroTrack** in the installed plugins list.
- Enable it.

<p>
    <img src="Attachments/plugin_installation.png" width="600"/>
</p>

---

## Quick start

### 1. Add your TMDB API key

- Go to **Settings → TerroTrack → TMDB API key**.
- Paste your key.

Don't have one? See [How to get your free TMDB API key](#How-to-get-your-free-TMDB-API-key).

### 2. Open your Library

In any note, add either:

````
```terro-movie

```
````
or
````
```terro-tv

```
````

Both render the same interface with **Movies / TV Shows** tabs. The only difference is which tab opens first.

![](Attachments/demo-3.gif)

### 3. Add your first title

Click `+ Add Movie` or `+ Add Show`.

Search TMDB and select a result, or use **OR ENTER MANUALLY** for titles that aren't available on TMDB.

---

## 💾 Data storage

By default, TerroTrack writes three files to your vault root:

| File            | Contents                                 |
| --------------- | ---------------------------------------- |
| `movies.json`   | Your movie library                       |
| `tvshows.json`  | Your TV library                          |
| `activity.json` | Daily activity counts behind the heatmap |

All three paths can be changed in **Settings → TerroTrack**.

Everything is plain JSON — you can open, edit, or move it outside Obsidian.

<details>
<summary><strong>Movie entry example</strong></summary>

```json
{
  "id": 438631,
  "title": "Dune",
  "year": "2021",
  "poster_path": "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
  "rating": "8.2",
  "myRating": "9",
  "watched": true,
  "watchedDate": "2026-02-14",
  "favorite": true,
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

</details>

<details>
<summary><strong>TV entry example</strong></summary>

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
  "last_air_date": "2013-09-29",
  "show_status": "Ended",
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
  "season_episodes": [7, 13, 13, 13, 16],
  "seasonsWatched": 2,
  "episodesWatched": 20
}
```

</details>

---

## 💾 Backup & Import

TerroTrack supports library backup and import through **Gallery Settings → Data**.

- **CSV** — Full library backup that can be re-imported.
- **TXT** — Simple numbered list of your library.
- **TerroTrack** — Import previous CSV backups.
- **IMDb** — Import movie and TV exports.
- **Letterboxd** — Import movie exports, including ratings and watchlists.

---

## 🔄 Updating

Download the latest release and replace the existing `TerroTrack` plugin folder with the new version.

Your library data will remain intact.

---

## How to get your free TMDB API key
1. Create a free account at [themoviedb.org](https://www.themoviedb.org).
2. Go to **Settings → [API](https://www.themoviedb.org/settings/api)**.
3. Request an API key and choose the **Developer** option.
4. Copy the **API Key (v3 auth)** — a 32-character hex string.
5. Paste it into **Settings → TerroTrack → TMDB API key**.

The key is stored in the plugin's `data.json` and stays on your machine.

Without it, the plugin still works — manual entry, gallery, filters, sorting, notes, ratings, backups, and native-backup imports all function. You lose TMDB search, Discover, metadata updates, and IMDb/Letterboxd enrichment.

---

## 📱 Compatibility

* **Desktop:** Windows · macOS · Linux
* **Mobile:** Android · iOS

---

## 📄 License

MIT — see [LICENSE](LICENSE).
