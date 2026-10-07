# TerroTrack

An [Obsidian](https://obsidian.md) plugin for tracking **Movies & TV Shows**. Discover trending titles and add them to your collection directly from the plugin. Your data is stored as plain JSON and can be exported as CSV.
<<<<<<< HEAD

|                         |                   |
| - - - - - - - - - - - - | - - - - - - - - - |
| ![](C:\Users\Joy\Downloads\2026-10-05_12-00.png) | ![](C:\Users\Joy\Downloads\2026-10-05_14-24.png) |
=======
>>>>>>> 6cdc73f039a6f55040561e24b6687574423fb161

## ✨ Features

* 🎬 Movie & 📺 TV show libraries
* 🔎 TMDB search and metadata
* 🖼️ Poster-based gallery
* 🔍 Search by title, director/creator, or cast
* 🎛️ Status, genre, year, language, rating, and personal rating filters
* ↕️ Multiple sorting options
* ⭐ Personal ratings
* 📝 Personal notes
* 🎞️ Similar movies/shows from TMDB
* 📊 Statistics and viewing habits
* ⚙️ Customizable gallery cards
* 💾 CSV and TXT backups
* 📥 Import from TMDB, IMDb, and Letterboxd
* 📱 Desktop and mobile support
* 📄 Plain JSON data storage

---

## 📦 Installation

### Manual Installation

> Make sure to turn off restricted mode.
<<<<<<< HEAD
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
    <img src="C:\Users\Joy\Downloads\2026-10-05_15-57.png"width="600"/>
</p>
=======

1. Download TerroTrack from the latest release.
2. Open Settings → Community plugins → Installed plugins folder.
3. Put the TerroTrack folder into it.
4. Open **Settings → Community plugins**.
5. Enable **TerroTrack**.

## Quick start
1. Add your TMDB API key.
Settings → TerroTrack → TMDB API key. See Getting a TMDB API key below — it's free.

2. Add a gallery to any note.
````
```terro-movie
```
````
or
````
```terro-tv
```
````
Both blocks render the same interface — a Movies / TV Shows / Discover tab bar. The only difference is which tab opens first.

3. Add your first title.
Click:

* **+ Add Movie**
* **+ Add Show**

You can search TMDB and select a result, or skip the search and use the **OR ENTER MANUALLY** form for titles that aren't available on TMDB.
>>>>>>> 6cdc73f039a6f55040561e24b6687574423fb161

---

## Quick start

### 1. Add your TMDB API key

- Go to **Settings → TerroTrack → TMDB API key**.
- Paste your key.

If you don't have one, see [How to get your free TMDB API key](#How-to-get-your-free-TMDB-API-key) below.

### 2. View your Library.

In any note, add one of these code blocks:

````
```terro-movie
```
````
or
````
```terro-tv
```
````
Both render the same interface — a **Movies / TV Shows** tab bar. The only difference is which tab opens first.

### 3. Add your first title.
Click:

* **+ Add Movie**
* **+ Add Show**

You can search TMDB and select a result, or skip the search and use the **OR ENTER MANUALLY** form for titles that aren't available on TMDB.

---

# 💾 Data Storage

TerroTrack stores your library as plain JSON files.

By default:

```text
movies.json
tvshows.json
```

Both filenames can be changed in the plugin settings.

The data is stored as regular text, making it easy to inspect, edit, back up, or move outside Obsidian.

---

## 🎬 Movie Data

Example:

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

---

## 📺 TV Show Data

Example:

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

Because the files are plain JSON, you can manually edit them whenever necessary or process them using external tools.

---

## How to get your free TMDB API key
1. Create a free account at [themoviedb.org](https://www.themoviedb.org).
2. Go to **Settings → [API](https://www.themoviedb.org/settings/api)**.
3. Request an API key and choose the **Developer** option.
4. Copy the **API Key (v3 auth)** — a 32-character hex string.
5. Paste it into **Settings → TerroTrack → TMDB API key**.

The key is stored in the plugin's `data.json` and stays on your machine.

Without it, the plugin still works — manual entry, gallery, filters, sorting, notes, ratings, backups, and native-backup imports all function. You lose TMDB search, Discover, metadata updates, and IMDb/Letterboxd enrichment.
## 🔑 TMDB API

TerroTrack uses **The Movie Database (TMDB)** to retrieve movie and TV metadata.

You need your own TMDB API key to use TMDB-powered features.

---

## 📱 Compatibility

TerroTrack is designed to work on:

* Windows
* macOS
* Linux
* Android
* iOS

through Obsidian's desktop and mobile applications.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
