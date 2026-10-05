# TerroTrack

An [Obsidian](https://obsidian.md) plugin for tracking **Movies & TV Shows**. Discover trending titles and add them to your collection directly from the plugin. Your data is stored as plain JSON and can be exported as CSV.

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

---

# 🎬 Movies & 📺 TV Shows

## Adding Movies & Shows

Click:

* **+ Add Movie**
* **+ Add Show**

You can search TMDB and select a result, or skip the search and use the **OR ENTER MANUALLY** form for titles that aren't available on TMDB.

---

## 🖼️ Gallery

The gallery provides a poster-based view of your library.

### Search

Search by:

* Title
* Director / Creator
* Cast

### Filters

The main toolbar provides:

* Status
* Genre

The **funnel icon** expands additional filters:

* Year
* Language
* TMDB Rating
* My Rating

### Sorting

Sort your library using the available sorting options.

### Gallery Controls

* ⚙️ **Gallery Settings**
* 📊 **Stats**

Movies and TV Shows maintain their own gallery settings and statistics.

---

# 📖 Detail View

Click any poster to open its detail view.

### Quick Editing

You can change:

* **Status** — click the status directly
* **My Rating** — use the rating dropdown

There is no need to open the Edit screen for these fields.

### Edit

The Edit screen provides access to the remaining metadata and personal information.

### TV Show Information

TV shows have additional fields:

* First Air Date
* Episode Runtime
* Seasons
* Episodes
* Creator
* TMDB Series Status

The series status can be:

* Ended
* Returning

### Similar Titles

The detail view can display similar movies or shows using TMDB recommendations.

A recommended title can be added to your library with one tap.

---

# ⚙️ Gallery Settings

Gallery Settings lets you customize how your library is displayed.

### Card Fields

Choose which fields appear on each gallery card.

### Column Layout

Choose between:

* Fixed column count
* Automatic sizing

### Update Database

**Update Database** re-fetches TMDB information for every item in your library.

Your personal data is preserved, including:

* Watched status
* Notes
* Personal ratings

Each item requires one TMDB request.

---

# 💾 Backup

TerroTrack supports two backup formats.

### CSV

Exports every available field and can be fully restored through the import system.

### TXT

Exports a simple numbered list containing:

```text
1. Dune (2021)
2. Interstellar (2014)
3. The Dark Knight (2008)
```

### Desktop

The operating system's save dialog lets you choose exactly where the backup is saved.

### Mobile

Backups are saved to the vault root.

---

# 📥 Import

TerroTrack automatically detects supported import formats.

## Movies

Supported formats:

* TerroTrack CSV backups
* Letterboxd `watched.csv`
* Letterboxd `ratings.csv`
* Letterboxd `diary.csv`
* Letterboxd `watchlist.csv`
* IMDb ratings exports
* IMDb watchlist exports

## TV Shows

Supported formats:

* TerroTrack CSV backups
* IMDb exports

IMDb exports can contain both movies and TV shows.

The **Title Type** column is used to determine which entries belong to Movies or TV Shows.

Therefore, the same IMDb export can be imported into both libraries:

1. Import it into **Movies** → movie entries are added.
2. Import the same file into **TV Shows** → TV entries are added.

Entries belonging to the other library are skipped automatically.

### IMDb Matching

IMDb imports use the exact IMDb ID whenever possible.

If an exact ID match isn't available, TerroTrack falls back to a **title + year search**.

### TMDB API Key

IMDb and Letterboxd exports don't contain poster information, so a **TMDB API key is required** to retrieve the corresponding TMDB data.

> Letterboxd does not track TV shows, so Letterboxd imports are available for Movies only.

---

# 📊 Statistics

The Stats view provides information about your library and viewing habits.

### Library Statistics

* Total titles
* Watched titles
* To-watch titles
* Total watch time

### Watch Time

The total watch time is displayed with a playful tier badge based on your accumulated viewing time.

### Watched Percentage

A donut chart displays your watched percentage.

### Genre Breakdown

A pie chart shows the distribution of genres, with dynamic leader lines for readability.

### Viewing Habits

The Viewing Habits section includes:

* Favorite year
* Top director / creator
* Most-seen actor

Clicking a habit tile takes you directly to the corresponding titles in the gallery.

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
