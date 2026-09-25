const { Plugin, Modal, Setting, PluginSettingTab, requestUrl, Notice, Platform } = require("obsidian");

const DEFAULT_SETTINGS = {
  tmdbApiKey: "",
  dataFile: "movies.json",
  tvDataFile: "tvshows.json",
  cardFields: {
    title: true,
    year: true,
    rating: true,
    genres: false,
    director: false,
    cast: false,
    status: false,
    release_date: false,
    runtime: false,
    language: false,
    budget: false,
    myRating: true,
    overview: false,
    notes: false,
  },
  cardsPerRow: "auto",
  cardSize: "medium",
  tvCardFields: {
    title: true,
    year: true,
    rating: true,
    genres: false,
    director: false,
    cast: false,
    status: false,
    release_date: false,
    runtime: false,
    language: false,
    seasons: false,
    episodes: false,
    network: false,
    myRating: true,
    overview: false,
    notes: false,
  },
  tvCardsPerRow: "auto",
  tvCardSize: "medium",
};

const POSTER_BASE = "https://image.tmdb.org/t/p/w300";

function getPosterUrl(m) {
  if (m.poster_path) return `${POSTER_BASE}${m.poster_path}`;
  if (m.custom_poster_url) return m.custom_poster_url;
  return "";
}

function makeFormRow(parent, full = false) {
  return parent.createDiv({ cls: "movie-add-row" + (full ? " movie-add-row-full" : "") });
}

function addFormField(parent, label, opts = {}) {
  const group = parent.createDiv({ cls: "movie-add-field" });
  group.createDiv({ cls: "movie-add-label", text: label });
  let el;
  if (opts.type === "textarea") {
    el = group.createEl("textarea", { attr: { placeholder: opts.placeholder || "" } });
    if (opts.value != null) el.value = opts.value;
  } else if (opts.type === "select") {
    el = group.createEl("select");
    opts.options.forEach(([value, text]) => {
      const o = el.createEl("option", { text, attr: { value } });
      if (String(opts.value) === String(value)) o.selected = true;
    });
  } else {
    el = group.createEl("input", { type: opts.type || "text", attr: { placeholder: opts.placeholder || "" } });
    if (opts.value != null) el.value = opts.value;
  }
  el.addEventListener(opts.type === "select" ? "change" : "input", () => {
    if (opts.onChange) opts.onChange(el.value);
  });
  if (opts.hint) group.createDiv({ cls: "movie-add-hint", text: opts.hint });
  return el;
}

class MovieGalleryPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.galleryEls = new Set();
    this.galleryStates = new Map();
    this.activeTabByEl = new Map();
    this.tvGalleryStates = new Map();

    this.addSettingTab(new MovieGallerySettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor("movie-gallery", (source, el) => {
      this.galleryEls.add(el);
      this.renderGallery(el);
    });

    this.registerMarkdownCodeBlockProcessor("tv-gallery", (source, el) => {
      this.galleryEls.add(el);
      if (!this.activeTabByEl) this.activeTabByEl = new Map();
      this.activeTabByEl.set(el, "tv");
      this.renderGallery(el);
    });

    this.addCommand({
      id: "add-movie",
      name: "Add movie",
      callback: () => new AddMovieModal(this.app, this).open(),
    });

    this.addCommand({
      id: "add-tv-show",
      name: "Add TV show",
      callback: () => new AddShowModal(this.app, this).open(),
    });

    this.addRibbonIcon("clapperboard", "Add movie", () => {
      new AddMovieModal(this.app, this).open();
    });
  }

  onunload() {
    this.galleryEls?.clear();
    this.galleryStates?.clear();
    this.tvGalleryStates?.clear();
    this.activeTabByEl?.clear();
  }

  async loadSettings() {
    const data = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.settings.cardFields = Object.assign({}, DEFAULT_SETTINGS.cardFields, data.cardFields || {});
    this.settings.tvCardFields = Object.assign({}, DEFAULT_SETTINGS.tvCardFields, data.tvCardFields || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async readMovies() {
    const path = this.settings.dataFile;
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return [];
    try {
      const content = await this.app.vault.adapter.read(path);
      return content.trim() ? JSON.parse(content) : [];
    } catch (e) {
      console.error("Movie Gallery: failed to read data file", e);
      new Notice("Movie Gallery: could not read " + path);
      return [];
    }
  }

  async writeMovies(movies) {
    const path = this.settings.dataFile;
    await this.app.vault.adapter.write(path, JSON.stringify(movies, null, 2));
  }

  async addMovie(movie) {
    const movies = await this.readMovies();
    if (movies.some((m) => m.id === movie.id)) {
      new Notice(`"${movie.title}" is already in the gallery.`);
      return;
    }
    movies.push(movie);
    await this.writeMovies(movies);
    new Notice(`Added "${movie.title}"`);
    this.refreshGalleries();
  }

  async removeMovie(id) {
    const movies = await this.readMovies();
    const filtered = movies.filter((m) => m.id !== id);
    await this.writeMovies(filtered);
    this.refreshGalleries();
  }

  async updateMovie(updatedMovie) {
    const movies = await this.readMovies();
    const idx = movies.findIndex((m) => m.id === updatedMovie.id);
    if (idx !== -1) movies[idx] = updatedMovie;
    await this.writeMovies(movies);
    this.refreshGalleries();
  }

  async fetchMovieDetails(id, fallback = {}) {
    try {
      const url =
        `https://api.themoviedb.org/3/movie/${id}?` +
        new URLSearchParams({
          api_key: this.settings.tmdbApiKey,
          append_to_response: "credits,videos",
        }).toString();

      const res = await requestUrl({ url });
      const data = res.json;

      const director = (data.credits?.crew || []).find((c) => c.job === "Director");
      const cast = (data.credits?.cast || []).slice(0, 10).map((c) => c.name).join(", ");
      const trailer =
        (data.videos?.results || []).find((v) => v.site === "YouTube" && v.type === "Trailer") ||
        (data.videos?.results || []).find((v) => v.site === "YouTube");

      return {
        id: data.id,
        title: data.title || fallback.title || "",
        year: (data.release_date || "????").slice(0, 4),
        poster_path: data.poster_path || fallback.poster_path || "",
        rating: (data.vote_average || 0).toFixed(1),
        myRating: "",
        notes: "",
        watched: false,
        release_date: data.release_date || "",
        runtime: data.runtime || null,
        original_language: data.original_language || "",
        budget: data.budget || 0,
        genres: (data.genres || []).map((g) => g.name).join(", "),
        director: director ? director.name : "",
        cast,
        overview: data.overview || "",
        trailer_key: trailer ? trailer.key : "",
      };
    } catch (e) {
      console.error("Movie Gallery: failed to fetch details", e);
      new Notice("Couldn't fetch full details, added with basic info only.");
      return {
        id: fallback.id,
        title: fallback.title || "",
        year: fallback.year || "????",
        poster_path: fallback.poster_path || "",
        rating: fallback.rating || "0.0",
        myRating: "",
        notes: "",
        watched: false,
      };
    }
  }

  async fetchSimilarMovies(id) {
    try {
      const url =
        `https://api.themoviedb.org/3/movie/${id}/recommendations?` +
        new URLSearchParams({ api_key: this.settings.tmdbApiKey }).toString();
      const res = await requestUrl({ url });
      return (res.json.results || []).slice(0, 8);
    } catch (e) {
      console.error("Movie Gallery: failed to fetch similar movies", e);
      return [];
    }
  }

  // ---------- TV shows ----------

  async readShows() {
    const path = this.settings.tvDataFile;
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return [];
    try {
      const content = await this.app.vault.adapter.read(path);
      return content.trim() ? JSON.parse(content) : [];
    } catch (e) {
      console.error("Movie Gallery: failed to read TV data file", e);
      new Notice("Movie Gallery: could not read " + path);
      return [];
    }
  }

  async writeShows(shows) {
    const path = this.settings.tvDataFile;
    await this.app.vault.adapter.write(path, JSON.stringify(shows, null, 2));
  }

  async addShow(show) {
    const shows = await this.readShows();
    if (shows.some((s) => s.id === show.id)) {
      new Notice(`"${show.name}" is already in your TV library.`);
      return;
    }
    shows.push(show);
    await this.writeShows(shows);
    new Notice(`Added "${show.name}"`);
    this.refreshGalleries();
  }

  async removeShow(id) {
    const shows = await this.readShows();
    await this.writeShows(shows.filter((s) => s.id !== id));
    this.refreshGalleries();
  }

  async updateShow(updatedShow) {
    const shows = await this.readShows();
    const idx = shows.findIndex((s) => s.id === updatedShow.id);
    if (idx !== -1) shows[idx] = updatedShow;
    await this.writeShows(shows);
    this.refreshGalleries();
  }

  async fetchShowDetails(id, fallback = {}) {
    try {
      const url =
        `https://api.themoviedb.org/3/tv/${id}?` +
        new URLSearchParams({ api_key: this.settings.tmdbApiKey, append_to_response: "credits,videos" }).toString();

      const res = await requestUrl({ url });
      const data = res.json;

      const cast = (data.credits?.cast || []).slice(0, 10).map((c) => c.name).join(", ");
      const creators = (data.created_by || []).map((c) => c.name).join(", ");
      const trailer =
        (data.videos?.results || []).find((v) => v.site === "YouTube" && v.type === "Trailer") ||
        (data.videos?.results || []).find((v) => v.site === "YouTube");

      return {
        id: data.id,
        name: data.name || fallback.name || "",
        year: (data.first_air_date || "????").slice(0, 4),
        poster_path: data.poster_path || fallback.poster_path || "",
        rating: (data.vote_average || 0).toFixed(1),
        myRating: "",
        notes: "",
        watched: false,
        episodesWatched: 0,
        first_air_date: data.first_air_date || "",
        last_air_date: data.last_air_date || "",
        show_status: data.status || "",
        number_of_seasons: data.number_of_seasons || null,
        number_of_episodes: data.number_of_episodes || null,
        episode_runtime:
          (data.episode_run_time && data.episode_run_time[0]) ||
          (data.last_episode_to_air && data.last_episode_to_air.runtime) ||
          (data.next_episode_to_air && data.next_episode_to_air.runtime) ||
          null,
        original_language: data.original_language || "",
        genres: (data.genres || []).map((g) => g.name).join(", "),
        creators,
        cast,
        overview: data.overview || "",
        trailer_key: trailer ? trailer.key : "",
      };
    } catch (e) {
      console.error("Movie Gallery: failed to fetch TV show details", e);
      new Notice("Couldn't fetch full details, added with basic info only.");
      return {
        id: fallback.id,
        name: fallback.name || "",
        year: fallback.year || "????",
        poster_path: fallback.poster_path || "",
        rating: fallback.rating || "0.0",
        myRating: "",
        notes: "",
        watched: false,
        episodesWatched: 0,
      };
    }
  }

  async fetchSimilarShows(id) {
    try {
      const url =
        `https://api.themoviedb.org/3/tv/${id}/recommendations?` +
        new URLSearchParams({ api_key: this.settings.tmdbApiKey }).toString();
      const res = await requestUrl({ url });
      return (res.json.results || []).slice(0, 8);
    } catch (e) {
      console.error("Movie Gallery: failed to fetch similar shows", e);
      return [];
    }
  }

  async refreshAllShows(onProgress) {
    const shows = await this.readShows();
    const total = shows.length;
    let updated = 0;

    for (let i = 0; i < shows.length; i++) {
      const s = shows[i];
      if (typeof s.id !== "number") continue;

      try {
        const fresh = await this.fetchShowDetails(s.id, s);
        fresh.watched = s.watched;
        fresh.myRating = s.myRating || "";
        fresh.notes = s.notes || "";
        fresh.episodesWatched = s.episodesWatched || 0;
        shows[i] = fresh;
        updated++;
      } catch (e) {
        console.error("Movie Gallery: failed to refresh", s.name, e);
      }

      if (onProgress) onProgress(i + 1, total);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await this.writeShows(shows);
    this.refreshGalleries();
    return updated;
  }

  buildShowsCsvBackup(shows) {
    const fields = [
      "id", "name", "year", "poster_path", "custom_poster_url", "rating", "myRating", "watched",
      "episodesWatched", "first_air_date", "last_air_date", "show_status", "number_of_seasons",
      "number_of_episodes", "episode_runtime", "original_language", "genres", "creators", "cast",
      "overview", "notes", "trailer_key",
    ];
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [fields.join(",")];
    for (const s of shows) lines.push(fields.map((f) => esc(s[f])).join(","));
    return lines.join("\n");
  }

  buildShowsTxtBackup(shows) {
    return shows.map((s, i) => `${i + 1}. ${s.name} (${s.year})`).join("\n");
  }

  async backupShows(format) {
    const shows = await this.readShows();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const ext = format === "csv" ? "csv" : "txt";
    const filename = `tvshows-backup-${timestamp}.${ext}`;
    const content = format === "csv" ? this.buildShowsCsvBackup(shows) : this.buildShowsTxtBackup(shows);

    if (Platform.isDesktopApp) {
      try {
        const electron = require("electron");
        const dialog = electron.remote ? electron.remote.dialog : electron.dialog;
        const fs = require("fs");
        const path = require("path");
        const app = electron.remote ? electron.remote.app : electron.app;
        const defaultDir = app ? app.getPath("downloads") : "";
        const defaultPath = defaultDir ? path.join(defaultDir, filename) : filename;

        const result = dialog.showSaveDialogSync
          ? dialog.showSaveDialogSync({ title: "Save TV show backup", defaultPath, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
          : (await dialog.showSaveDialog({ title: "Save TV show backup", defaultPath, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] }))?.filePath;

        if (!result) return null;
        fs.writeFileSync(result, content, "utf-8");
        return result;
      } catch (e) {
        console.error("Movie Gallery: native save dialog failed, saving to vault root instead", e);
        new Notice("Couldn't open the save dialog — saved to vault root instead.");
      }
    }

    await this.app.vault.adapter.write(filename, content);
    return filename;
  }

  buildBareShow(name, year, overlay = {}) {
    return {
      id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: name || "",
      year: year || "",
      poster_path: "",
      custom_poster_url: "",
      rating: "",
      myRating: overlay.myRating || "",
      watched: !!overlay.watched,
      episodesWatched: 0,
      first_air_date: overlay.first_air_date || "",
      last_air_date: "",
      show_status: "",
      number_of_seasons: null,
      number_of_episodes: null,
      episode_runtime: overlay.episode_runtime || null,
      original_language: "",
      genres: overlay.genres || "",
      creators: overlay.creators || "",
      cast: "",
      overview: "",
      notes: "",
      trailer_key: "",
    };
  }

  async resolveShowViaSearch(name, year, overlay = {}) {
    try {
      const url =
        "https://api.themoviedb.org/3/search/tv?" +
        new URLSearchParams({ api_key: this.settings.tmdbApiKey, query: name, first_air_date_year: year || "" }).toString();
      const res = await requestUrl({ url });
      const results = res.json.results || [];
      if (!results.length) return this.buildBareShow(name, year, overlay);
      const details = await this.fetchShowDetails(results[0].id, {
        name, year, poster_path: results[0].poster_path, rating: (results[0].vote_average || 0).toFixed(1),
      });
      return Object.assign(details, { myRating: overlay.myRating || "", watched: !!overlay.watched });
    } catch (e) {
      console.error("Movie Gallery: TV import search failed for", name, e);
      return this.buildBareShow(name, year, overlay);
    }
  }

  async resolveShowViaImdbId(imdbId, name, year, overlay = {}) {
    try {
      if (imdbId) {
        const url =
          `https://api.themoviedb.org/3/find/${imdbId}?` +
          new URLSearchParams({ api_key: this.settings.tmdbApiKey, external_source: "imdb_id" }).toString();
        const res = await requestUrl({ url });
        const match = (res.json.tv_results || [])[0];
        if (match) {
          const details = await this.fetchShowDetails(match.id, {
            name, year, poster_path: match.poster_path, rating: (match.vote_average || 0).toFixed(1),
          });
          return Object.assign(details, { myRating: overlay.myRating || "", watched: !!overlay.watched });
        }
      }
    } catch (e) {
      console.error("Movie Gallery: IMDb id lookup failed for", name, e);
    }
    return this.resolveShowViaSearch(name, year, overlay);
  }

  async importShows(csvText, filename, onProgress) {
    const rows = this.parseCsv(csvText);
    if (!rows.length) return { imported: 0, skipped: 0, failed: 0, format: "empty" };

    const headers = Object.keys(rows[0]);
    const format = this.detectImportFormat(headers);

    if (format === "imdb" && !this.settings.tmdbApiKey) {
      return { imported: 0, skipped: 0, failed: 0, format, error: "no_api_key" };
    }
    if (format === "letterboxd") {
      return { imported: 0, skipped: 0, failed: 0, format, error: "unsupported" };
    }

    const existing = await this.readShows();
    const existingIds = new Set(existing.map((s) => String(s.id)));
    const existingNames = new Set(existing.map((s) => `${s.name}|${s.year}`.toLowerCase()));

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let show = null;

      if (format === "native") {
        const rowId = row.id && row.id.trim() ? row.id.trim() : `custom-${Date.now()}-${i}`;
        const key = `${row.name}|${row.year}`.toLowerCase();
        if (existingIds.has(String(rowId)) || existingNames.has(key)) {
          skipped++;
          if (onProgress) onProgress(i + 1, rows.length);
          continue;
        }
        show = {
          id: isNaN(Number(rowId)) ? rowId : Number(rowId),
          name: row.name || "",
          year: row.year || "",
          poster_path: row.poster_path || "",
          custom_poster_url: row.custom_poster_url || "",
          rating: row.rating || "",
          myRating: row.myRating || "",
          watched: row.watched === "true",
          episodesWatched: row.episodesWatched ? parseInt(row.episodesWatched, 10) : 0,
          first_air_date: row.first_air_date || "",
          last_air_date: row.last_air_date || "",
          show_status: row.show_status || "",
          number_of_seasons: row.number_of_seasons ? parseInt(row.number_of_seasons, 10) : null,
          number_of_episodes: row.number_of_episodes ? parseInt(row.number_of_episodes, 10) : null,
          episode_runtime: row.episode_runtime ? parseInt(row.episode_runtime, 10) : null,
          original_language: row.original_language || "",
          genres: row.genres || "",
          creators: row.creators || "",
          cast: row.cast || "",
          overview: row.overview || "",
          notes: row.notes || "",
          trailer_key: row.trailer_key || "",
        };
      } else if (format === "imdb") {
        const name = row["Title"];
        const year = row["Year"];
        const imdbId = row["Const"];
        const key = `${name}|${year}`.toLowerCase();
        if (!name || !this.imdbRowMatchesKind(row, "tv") || existingNames.has(key)) {
          if (name) skipped++;
          else failed++;
          if (onProgress) onProgress(i + 1, rows.length);
          continue;
        }
        const yourRating = (row["Your Rating"] || "").trim();
        show = await this.resolveShowViaImdbId(imdbId, name, year, {
          myRating: yourRating,
          watched: !!yourRating,
          genres: row["Genres"] || "",
          creators: row["Directors"] || "",
          episode_runtime: row["Runtime (mins)"] ? parseInt(row["Runtime (mins)"], 10) : null,
        });
      }

      if (show) {
        existing.push(show);
        existingNames.add(`${show.name}|${show.year}`.toLowerCase());
        existingIds.add(String(show.id));
        imported++;
      } else {
        failed++;
      }

      if (onProgress) onProgress(i + 1, rows.length);
      if (format !== "native") await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await this.writeShows(existing);
    this.refreshGalleries();
    return { imported, skipped, failed, format };
  }

  formatRuntime(minutes) {
    if (!minutes) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }

  formatBudget(amount) {
    if (!amount) return "";
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(amount % 1e9 === 0 ? 0 : 1)}B`;
    if (amount >= 1e6) return `$${Math.round(amount / 1e6)}M`;
    return `$${amount.toLocaleString()}`;
  }

  formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  languageName(code) {
    if (!code) return "";
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(code);
    } catch {
      return code;
    }
  }

  async refreshAllMovies(onProgress) {
    const movies = await this.readMovies();
    const total = movies.length;
    let updated = 0;

    for (let i = 0; i < movies.length; i++) {
      const m = movies[i];
      if (typeof m.id !== "number") continue;

      try {
        const fresh = await this.fetchMovieDetails(m.id, m);
        fresh.watched = m.watched;
        fresh.myRating = m.myRating || "";
        fresh.notes = m.notes || "";
        movies[i] = fresh;
        updated++;
      } catch (e) {
        console.error("Movie Gallery: failed to refresh", m.title, e);
      }

      if (onProgress) onProgress(i + 1, total);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await this.writeMovies(movies);
    this.refreshGalleries();
    return updated;
  }

  buildCsvBackup(movies) {
    const fields = [
      "id", "title", "year", "poster_path", "custom_poster_url", "rating", "myRating", "watched",
      "release_date", "runtime", "original_language", "budget", "genres", "director",
      "cast", "overview", "notes", "trailer_key",
    ];
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [fields.join(",")];
    for (const m of movies) lines.push(fields.map((f) => esc(m[f])).join(","));
    return lines.join("\n");
  }

  buildTxtBackup(movies) {
    return movies.map((m, i) => `${i + 1}. ${m.title} (${m.year})`).join("\n");
  }

  async backupMovies(format) {
    const movies = await this.readMovies();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const ext = format === "csv" ? "csv" : "txt";
    const filename = `movies-backup-${timestamp}.${ext}`;
    const content = format === "csv" ? this.buildCsvBackup(movies) : this.buildTxtBackup(movies);

    if (Platform.isDesktopApp) {
      try {
        const electron = require("electron");
        const dialog = electron.remote ? electron.remote.dialog : electron.dialog;
        const fs = require("fs");
        const path = require("path");
        const app = electron.remote ? electron.remote.app : electron.app;
        const defaultDir = app ? app.getPath("downloads") : "";
        const defaultPath = defaultDir ? path.join(defaultDir, filename) : filename;

        const result = dialog.showSaveDialogSync
          ? dialog.showSaveDialogSync({
              title: "Save movie backup",
              defaultPath,
              filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
            })
          : (await dialog.showSaveDialog({
              title: "Save movie backup",
              defaultPath,
              filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
            }))?.filePath;

        if (!result) return null;
        fs.writeFileSync(result, content, "utf-8");
        return result;
      } catch (e) {
        console.error("Movie Gallery: native save dialog failed, saving to vault root instead", e);
        new Notice("Couldn't open the save dialog — saved to vault root instead.");
      }
    }

    await this.app.vault.adapter.write(filename, content);
    return filename;
  }

  formatWatchTime(totalMinutes) {
    if (!totalMinutes) return "0h";
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${totalMinutes % 60}m`;
  }

  getWatchTimeBadge(totalMinutes) {
    const tiers = [
      { max: 1, emoji: "🍿", title: "Fresh Start", quip: "The popcorn's barely popped." },
      { max: 180, emoji: "🎬", title: "Warming Up", quip: "A solid opening act." },
      { max: 600, emoji: "📺", title: "Casual Viewer", quip: "Respectable. Very respectable." },
      { max: 1440, emoji: "🌙", title: "Night Owl", quip: "That's a full day, minus the sleeping." },
      { max: 4320, emoji: "🎞️", title: "Certified Cinephile", quip: "Your popcorn budget concerns us." },
      { max: 10080, emoji: "🛋️", title: "Couch Commander", quip: "The remote recognizes your fingerprints now." },
      { max: Infinity, emoji: "👑", title: "Movie Marathon Legend", quip: "At this point, movies watch you." },
    ];
    return tiers.find((t) => totalMinutes < t.max) || tiers[tiers.length - 1];
  }

  async computeStats() {
    const movies = await this.readMovies();
    const watched = movies.filter((m) => m.watched);
    const toWatch = movies.filter((m) => !m.watched);

    const totalMinutes = watched.reduce((sum, m) => sum + (m.runtime || 0), 0);

    const genreCounts = {};
    for (const m of movies) {
      (m.genres || "")
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const rated = movies.filter((m) => m.myRating !== "" && m.myRating != null);
    const avgMyRating = rated.length
      ? (rated.reduce((sum, m) => sum + parseFloat(m.myRating), 0) / rated.length).toFixed(1)
      : null;

    const topOf = (arr, extract) => {
      const counts = {};
      for (const item of arr) {
        const values = extract(item);
        (Array.isArray(values) ? values : [values]).forEach((v) => {
          if (!v) return;
          counts[v] = (counts[v] || 0) + 1;
        });
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return sorted.length ? sorted[0] : null;
    };

    const topYear = topOf(watched, (m) => m.year);
    const topDirector = topOf(watched, (m) => m.director);
    const topCast = topOf(watched, (m) =>
      (m.cast || "").split(",").map((c) => c.trim()).filter(Boolean)
    );

    return {
      total: movies.length,
      watchedCount: watched.length,
      toWatchCount: toWatch.length,
      totalMinutes,
      topGenres,
      avgMyRating,
      badge: this.getWatchTimeBadge(totalMinutes),
      topYear,
      topDirector,
      topCast,
    };
  }

  async computeShowStats() {
    const shows = await this.readShows();
    const watched = shows.filter((s) => s.watched);
    const toWatch = shows.filter((s) => !s.watched);

    const totalMinutes = watched.reduce((sum, s) => sum + (s.episode_runtime || 0) * (s.number_of_episodes || 1), 0);

    const genreCounts = {};
    for (const s of shows) {
      (s.genres || "")
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
        .forEach((g) => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const rated = shows.filter((s) => s.myRating !== "" && s.myRating != null);
    const avgMyRating = rated.length
      ? (rated.reduce((sum, s) => sum + parseFloat(s.myRating), 0) / rated.length).toFixed(1)
      : null;

    const topOf = (arr, extract) => {
      const counts = {};
      for (const item of arr) {
        const values = extract(item);
        (Array.isArray(values) ? values : [values]).forEach((v) => {
          if (!v) return;
          counts[v] = (counts[v] || 0) + 1;
        });
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return sorted.length ? sorted[0] : null;
    };

    const topYear = topOf(watched, (s) => s.year);
    const topDirector = topOf(watched, (s) => s.creators);
    const topCast = topOf(watched, (s) =>
      (s.cast || "").split(",").map((c) => c.trim()).filter(Boolean)
    );

    return {
      total: shows.length,
      watchedCount: watched.length,
      toWatchCount: toWatch.length,
      totalMinutes,
      topGenres,
      avgMyRating,
      badge: this.getWatchTimeBadge(totalMinutes),
      topYear,
      topDirector,
      topCast,
    };
  }

  // Attaches a small "×" clear button to a search input. The button
  // only shows when the input has content.
  attachSearchClear(inputEl) {
    const parent = inputEl.parentElement;
    if (!parent) return;
    if (parent.classList.contains("movie-gallery-search-wrap")) return;

    const wrap = document.createElement("div");
    wrap.className = "movie-gallery-search-wrap";
    parent.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "movie-gallery-search-clear";
    clearBtn.setAttribute("aria-label", "Clear search");
    clearBtn.innerHTML = "×";
    wrap.appendChild(clearBtn);

    const syncVisibility = () => {
      clearBtn.classList.toggle("is-visible", inputEl.value.length > 0);
    };
    inputEl.addEventListener("input", syncVisibility);
    syncVisibility();

    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!inputEl.value) return;
      inputEl.value = "";
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.focus();
    });
  }

  // Builds the SVG markup for the rating trend line.
  // ratings: array of numbers in insertion order.
  // Downsamples to at most 40 plotted points so the line stays readable
  // no matter how large the library grows.
  buildRatingTrendSvg(ratings) {
    const allValues = ratings;
    if (allValues.length < 2) return null;

    const maxPoints = 40;
    let values;
    if (allValues.length <= maxPoints) {
      values = allValues;
    } else {
      const step = allValues.length / (maxPoints - 1);
      values = [];
      for (let i = 0; i < maxPoints - 1; i++) {
        values.push(allValues[Math.floor(i * step)]);
      }
      values.push(allValues[allValues.length - 1]);
    }

    const width = 500;
    const height = 55;
    const padTop = 6;
    const padBottom = 14;
    const padLeft = 2;
    const padRight = 2;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const span = Math.max(1, maxV - minV);
    const domainMin = Math.max(0, minV - span * 0.2);
    const domainMax = Math.min(10, maxV + span * 0.2);
    const domainSpan = Math.max(0.5, domainMax - domainMin);

    const x = (i) => padLeft + (i / (values.length - 1)) * plotW;
    const y = (v) => padTop + plotH - ((v - domainMin) / domainSpan) * plotH;

    const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const linePath = "M " + points.join(" L ");

    const baselineY = padTop + plotH;
    const areaPath =
      `M ${x(0).toFixed(1)},${baselineY.toFixed(1)} ` +
      "L " + points.join(" L ") +
      ` L ${x(values.length - 1).toFixed(1)},${baselineY.toFixed(1)} Z`;

    const dotIndexes = [
      0,
      Math.floor(values.length * 0.25),
      Math.floor(values.length * 0.5),
      Math.floor(values.length * 0.75),
      values.length - 1,
    ];
    const uniqueDotIndexes = [...new Set(dotIndexes)];

    const dots = uniqueDotIndexes
      .map((i) => {
        const isLast = i === values.length - 1;
        const cx = x(i).toFixed(1);
        const cy = y(values[i]).toFixed(1);
        if (isLast) {
          return `<circle cx="${cx}" cy="${cy}" r="3" fill="#eab308" stroke="#fff" stroke-width="1.5" />`;
        }
        return `<circle cx="${cx}" cy="${cy}" r="2" fill="#eab308" stroke="#1e1e1e" stroke-width="1.2" />`;
      })
      .join("");

    const firstLabel = "1st";
    const lastLabel = `${allValues.length}th`;
    const lastLabelX = x(values.length - 1).toFixed(1);
    const gradId = "mg-trend-grad-" + Math.random().toString(36).slice(2, 8);

    return `
      <svg class="mg-trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="height: ${height}px;">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#eab308" stop-opacity="0.38"/>
            <stop offset="100%" stop-color="#eab308" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#${gradId})" />
        <path d="${linePath}" fill="none" stroke="#eab308" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
        ${dots}
        <text x="${padLeft}" y="${height - 2}" fill="rgba(255,255,255,0.4)" font-size="9" font-family="inherit">${firstLabel}</text>
        <text x="${lastLabelX}" y="${height - 2}" fill="rgba(255,255,255,0.6)" font-size="9" font-family="inherit" font-weight="600" text-anchor="end">${lastLabel}</text>
      </svg>
    `;
  }

  parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];

    const parseLine = (line) => {
      const result = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
          if (c === '"' && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (c === '"') {
            inQuotes = false;
          } else {
            cur += c;
          }
        } else if (c === '"') {
          inQuotes = true;
        } else if (c === ",") {
          result.push(cur);
          cur = "";
        } else {
          cur += c;
        }
      }
      result.push(cur);
      return result;
    };

    const header = parseLine(lines[0]);
    return lines.slice(1).filter(Boolean).map((line) => {
      const values = parseLine(line);
      const row = {};
      header.forEach((h, i) => (row[h] = values[i] ?? ""));
      return row;
    });
  }

  detectImportFormat(headers) {
    if (headers.includes("Letterboxd URI")) return "letterboxd";
    if (headers.includes("Const") && headers.includes("Title") && headers.includes("URL")) return "imdb";
    return "native";
  }

  imdbRowMatchesKind(row, kind) {
    const type = (row["Title Type"] || "").trim();
    if (!type) return true;
    const movieTypes = ["movie", "tvMovie", "video", "short"];
    const tvTypes = ["tvSeries", "tvMiniSeries", "tvSpecial"];
    return kind === "tv" ? tvTypes.includes(type) : movieTypes.includes(type);
  }

  buildBareMovie(title, year, overlay = {}) {
    return {
      id: "custom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: title || "",
      year: year || "",
      poster_path: "",
      custom_poster_url: "",
      rating: "",
      myRating: overlay.myRating || "",
      watched: !!overlay.watched,
      release_date: overlay.release_date || "",
      runtime: overlay.runtime || null,
      original_language: "",
      budget: 0,
      genres: overlay.genres || "",
      director: overlay.director || "",
      cast: "",
      overview: "",
      notes: "",
      trailer_key: "",
    };
  }

  async resolveViaSearch(title, year, overlay = {}) {
    try {
      const url =
        "https://api.themoviedb.org/3/search/movie?" +
        new URLSearchParams({ api_key: this.settings.tmdbApiKey, query: title, year: year || "", include_adult: "false" }).toString();
      const res = await requestUrl({ url });
      const results = res.json.results || [];
      if (!results.length) return this.buildBareMovie(title, year, overlay);
      const details = await this.fetchMovieDetails(results[0].id, {
        title, year, poster_path: results[0].poster_path, rating: (results[0].vote_average || 0).toFixed(1),
      });
      return Object.assign(details, { myRating: overlay.myRating || "", watched: !!overlay.watched });
    } catch (e) {
      console.error("Movie Gallery: import search failed for", title, e);
      return this.buildBareMovie(title, year, overlay);
    }
  }

  async resolveViaImdbId(imdbId, title, year, overlay = {}) {
    try {
      if (imdbId) {
        const url =
          `https://api.themoviedb.org/3/find/${imdbId}?` +
          new URLSearchParams({ api_key: this.settings.tmdbApiKey, external_source: "imdb_id" }).toString();
        const res = await requestUrl({ url });
        const match = (res.json.movie_results || [])[0];
        if (match) {
          const details = await this.fetchMovieDetails(match.id, {
            title, year, poster_path: match.poster_path, rating: (match.vote_average || 0).toFixed(1),
          });
          return Object.assign(details, { myRating: overlay.myRating || "", watched: !!overlay.watched });
        }
      }
    } catch (e) {
      console.error("Movie Gallery: IMDb id lookup failed for", title, e);
    }
    return this.resolveViaSearch(title, year, overlay);
  }

  async importMovies(csvText, filename, onProgress) {
    const rows = this.parseCsv(csvText);
    if (!rows.length) return { imported: 0, skipped: 0, failed: 0, format: "empty" };

    const headers = Object.keys(rows[0]);
    const format = this.detectImportFormat(headers);

    if (format !== "native" && !this.settings.tmdbApiKey) {
      return { imported: 0, skipped: 0, failed: 0, format, error: "no_api_key" };
    }

    const existing = await this.readMovies();
    const existingIds = new Set(existing.map((m) => String(m.id)));
    const existingTitles = new Set(existing.map((m) => `${m.title}|${m.year}`.toLowerCase()));
    const isWatchlistFile = /watchlist/i.test(filename || "");

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let movie = null;

      if (format === "native") {
        const rowId = row.id && row.id.trim() ? row.id.trim() : `custom-${Date.now()}-${i}`;
        const key = `${row.title}|${row.year}`.toLowerCase();
        if (existingIds.has(String(rowId)) || existingTitles.has(key)) {
          skipped++;
          if (onProgress) onProgress(i + 1, rows.length);
          continue;
        }
        movie = {
          id: isNaN(Number(rowId)) ? rowId : Number(rowId),
          title: row.title || "",
          year: row.year || "",
          poster_path: row.poster_path || "",
          custom_poster_url: row.custom_poster_url || "",
          rating: row.rating || "",
          myRating: row.myRating || "",
          watched: row.watched === "true",
          release_date: row.release_date || "",
          runtime: row.runtime ? parseInt(row.runtime, 10) : null,
          original_language: row.original_language || "",
          budget: row.budget ? parseInt(row.budget, 10) : 0,
          genres: row.genres || "",
          director: row.director || "",
          cast: row.cast || "",
          overview: row.overview || "",
          notes: row.notes || "",
          trailer_key: row.trailer_key || "",
        };
      } else if (format === "letterboxd") {
        const title = row["Name"];
        const year = row["Year"];
        const key = `${title}|${year}`.toLowerCase();
        if (!title || existingTitles.has(key)) {
          if (title) skipped++;
          else failed++;
          if (onProgress) onProgress(i + 1, rows.length);
          continue;
        }
        const stars = parseFloat(row["Rating"]);
        const myRating = !isNaN(stars) ? String(Math.round(stars * 2)) : "";
        movie = await this.resolveViaSearch(title, year, { myRating, watched: !isWatchlistFile });
      } else if (format === "imdb") {
        const title = row["Title"];
        const year = row["Year"];
        const imdbId = row["Const"];
        const key = `${title}|${year}`.toLowerCase();
        if (!title || !this.imdbRowMatchesKind(row, "movie") || existingTitles.has(key)) {
          if (title) skipped++;
          else failed++;
          if (onProgress) onProgress(i + 1, rows.length);
          continue;
        }
        const yourRating = (row["Your Rating"] || "").trim();
        movie = await this.resolveViaImdbId(imdbId, title, year, {
          myRating: yourRating,
          watched: !!yourRating,
          genres: row["Genres"] || "",
          director: row["Directors"] || "",
          release_date: row["Release Date"] || "",
          runtime: row["Runtime (mins)"] ? parseInt(row["Runtime (mins)"], 10) : null,
        });
      }

      if (movie) {
        existing.push(movie);
        existingTitles.add(`${movie.title}|${movie.year}`.toLowerCase());
        existingIds.add(String(movie.id));
        imported++;
      } else {
        failed++;
      }

      if (onProgress) onProgress(i + 1, rows.length);
      if (format !== "native") await new Promise((resolve) => setTimeout(resolve, 300));
    }

    await this.writeMovies(existing);
    this.refreshGalleries();
    return { imported, skipped, failed, format };
  }

  refreshGalleries() {
    for (const el of this.galleryEls) {
      if (document.body.contains(el)) {
        this.renderGallery(el);
      } else {
        this.galleryEls.delete(el);
        this.galleryStates.delete(el);
        this.tvGalleryStates.delete(el);
      }
    }
  }

  filterAndSort(movies, state) {
    const q = state.search.trim().toLowerCase();

    let result = movies.filter((m) => {
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        (m.director || "").toLowerCase().includes(q) ||
        (m.cast || "").toLowerCase().includes(q);
      const matchesFilter =
        state.filter === "all" ||
        (state.filter === "watched" && m.watched) ||
        (state.filter === "unwatched" && !m.watched);
      const matchesGenre =
        state.genre === "all" ||
        (m.genres || "").split(",").map((g) => g.trim()).includes(state.genre);
      const matchesLanguage = state.language === "all" || m.original_language === state.language;
      const matchesYear = state.year === "all" || m.year === state.year;
      const matchesRating = !state.minRating || parseFloat(m.rating || 0) >= parseFloat(state.minRating);
      const matchesMyRating =
        !state.minMyRating || parseFloat(m.myRating || 0) >= parseFloat(state.minMyRating);
      const matchesRuntime = !state.runtime || String(m.runtime) === state.runtime;

      return (
        matchesSearch &&
        matchesFilter &&
        matchesGenre &&
        matchesLanguage &&
        matchesYear &&
        matchesRating &&
        matchesMyRating &&
        matchesRuntime
      );
    });

    switch (state.sort) {
      case "title-asc":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "year-desc":
        result.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
        break;
      case "year-asc":
        result.sort((a, b) => (a.year || "").localeCompare(b.year || ""));
        break;
      case "rating-desc":
        result.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
        break;
      case "budget-desc":
        result.sort((a, b) => (b.budget || 0) - (a.budget || 0));
        break;
      case "budget-asc":
        result.sort((a, b) => (a.budget || 0) - (b.budget || 0));
        break;
      case "added-desc":
      default:
        result = result.slice().reverse();
        break;
    }

    if (q) {
      result = result
        .map((m, i) => ({ m, i, titleMatch: m.title.toLowerCase().includes(q) }))
        .sort((a, b) => (a.titleMatch === b.titleMatch ? a.i - b.i : a.titleMatch ? -1 : 1))
        .map((x) => x.m);
    }

    return result;
  }

  async renderGallery(el) {
    if (!this.activeTabByEl) this.activeTabByEl = new Map();
    const activeTab = this.activeTabByEl.get(el) || "movies";

    el.empty();
    el.addClass("movie-gallery-block");

    const tabBar = el.createDiv({ cls: "movie-gallery-tabs" });
    const movieTabBtn = tabBar.createEl("button", { cls: "movie-gallery-tab", text: "🎬 Movies" });
    const tvTabBtn = tabBar.createEl("button", { cls: "movie-gallery-tab", text: "📺 TV Shows" });
    movieTabBtn.toggleClass("active", activeTab === "movies");
    tvTabBtn.toggleClass("active", activeTab === "tv");
    movieTabBtn.addEventListener("click", () => {
      this.activeTabByEl.set(el, "movies");
      this.renderGallery(el);
    });
    tvTabBtn.addEventListener("click", () => {
      this.activeTabByEl.set(el, "tv");
      this.renderGallery(el);
    });

    const sectionEl = el.createDiv();

    if (activeTab === "tv") {
      await this.renderTvSection(sectionEl, el);
    } else {
      await this.renderMovieSection(sectionEl, el);
    }
  }

  async renderMovieSection(el, stateKey) {
    let state = this.galleryStates.get(stateKey);
    if (!state) {
      state = {
        search: "",
        filter: "all",
        genre: "all",
        language: "all",
        year: "all",
        sort: "added-desc",
        minRating: "",
        minMyRating: "",
        runtime: "",
        moreOpen: false,
      };
      this.galleryStates.set(stateKey, state);
    }

    el.empty();
    el.addClass("movie-gallery-block");

    const allMovies = await this.readMovies();

    const genreOptions = Array.from(
      new Set(
        allMovies.flatMap((m) => (m.genres || "").split(",").map((g) => g.trim()).filter(Boolean))
      )
    ).sort();

    const languageOptions = Array.from(
      new Set(allMovies.map((m) => m.original_language).filter(Boolean))
    ).sort();

    const yearOptions = Array.from(new Set(allMovies.map((m) => m.year).filter(Boolean))).sort(
      (a, b) => b.localeCompare(a)
    );

    const runtimeOptions = Array.from(
      new Set(allMovies.map((m) => m.runtime).filter((r) => r != null))
    ).sort((a, b) => a - b);

    const header = el.createDiv({ cls: "movie-gallery-header" });
    header.createDiv({ cls: "movie-gallery-heading", text: "🎬 Movie Library" });
    const headerActions = header.createDiv({ cls: "movie-gallery-header-actions" });

    const addBtn = headerActions.createEl("button", { text: "+ Add Movie", cls: "movie-gallery-add-btn" });
    addBtn.addEventListener("click", () => new AddMovieModal(this.app, this).open());

    const statsBtn = headerActions.createEl("button", {
      cls: "movie-gallery-settings-btn",
      text: "📊",
      attr: { "aria-label": "Library stats" },
    });
    statsBtn.addEventListener("click", () => new StatsModal(this.app, this, stateKey).open());

    const settingsBtn = headerActions.createEl("button", {
      cls: "movie-gallery-settings-btn",
      text: "⚙",
      attr: { "aria-label": "Gallery settings" },
    });
    settingsBtn.addEventListener("click", () => new GallerySettingsModal(this.app, this).open());

    const toolbar = el.createDiv({ cls: "movie-gallery-toolbar" });

    const searchInput = toolbar.createEl("input", {
      type: "text",
      cls: "movie-gallery-search",
      attr: { placeholder: "Search title, director, or cast..." },
    });
    searchInput.value = state.search;
    this.attachSearchClear(searchInput);

    let movieSearchDebounce = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(movieSearchDebounce);
      movieSearchDebounce = setTimeout(() => {
        state.search = searchInput.value;
        renderGrid();
      }, 200);
    });

    const toolbarRight = toolbar.createDiv({ cls: "movie-gallery-toolbar-right" });

    const filterSelect = toolbarRight.createEl("select", { cls: "movie-gallery-filter" });
    [
      ["all", "All Status"],
      ["watched", "Watched"],
      ["unwatched", "Unwatched"],
    ].forEach(([value, label]) => {
      const opt = filterSelect.createEl("option", { text: label, attr: { value } });
      if (state.filter === value) opt.selected = true;
    });
    filterSelect.addEventListener("change", () => {
      state.filter = filterSelect.value;
      renderGrid();
    });

    const genreSelect = toolbarRight.createEl("select", { cls: "movie-gallery-filter" });
    genreSelect.createEl("option", { text: "All Genres", attr: { value: "all" } });
    genreOptions.forEach((g) => {
      const opt = genreSelect.createEl("option", { text: g, attr: { value: g } });
      if (state.genre === g) opt.selected = true;
    });
    genreSelect.value = state.genre;
    genreSelect.addEventListener("change", () => {
      state.genre = genreSelect.value;
      renderGrid();
    });

    const sortSelect = toolbarRight.createEl("select", { cls: "movie-gallery-sort" });
    [
      ["added-desc", "Recently added"],
      ["title-asc", "Title (A-Z)"],
      ["year-desc", "Year (newest)"],
      ["year-asc", "Year (oldest)"],
      ["rating-desc", "Rating (highest)"],
      ["budget-desc", "Budget (highest)"],
      ["budget-asc", "Budget (lowest)"],
    ].forEach(([value, label]) => {
      const opt = sortSelect.createEl("option", { text: label, attr: { value } });
      if (state.sort === value) opt.selected = true;
    });
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      renderGrid();
    });

    const moreBtn = toolbarRight.createEl("button", {
      cls: "movie-gallery-more-btn",
      attr: { "aria-label": "Filters" },
    });
    moreBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="4,4 20,4 14,12 14,19 10,21 10,12"/></svg>';
    moreBtn.toggleClass("active", state.moreOpen);

    const morePanel = el.createDiv({ cls: "movie-gallery-more-panel" });
    morePanel.toggleClass("open", state.moreOpen);

    const yearSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    yearSelect.createEl("option", { text: "All Years", attr: { value: "all" } });
    yearOptions.forEach((y) => {
      const opt = yearSelect.createEl("option", { text: y, attr: { value: y } });
      if (state.year === y) opt.selected = true;
    });
    yearSelect.value = state.year;
    yearSelect.addEventListener("change", () => {
      state.year = yearSelect.value;
      renderGrid();
    });

    const langSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    langSelect.createEl("option", { text: "All Languages", attr: { value: "all" } });
    languageOptions.forEach((code) => {
      const opt = langSelect.createEl("option", { text: this.languageName(code), attr: { value: code } });
      if (state.language === code) opt.selected = true;
    });
    langSelect.value = state.language;
    langSelect.addEventListener("change", () => {
      state.language = langSelect.value;
      renderGrid();
    });

    const ratingSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    ratingSelect.createEl("option", { text: "All Ratings", attr: { value: "" } });
    for (let v = 9; v >= 1; v--) {
      const opt = ratingSelect.createEl("option", { text: `${v}+`, attr: { value: String(v) } });
      if (state.minRating === String(v)) opt.selected = true;
    }
    ratingSelect.addEventListener("change", () => {
      state.minRating = ratingSelect.value;
      renderGrid();
    });

    const myRatingSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    myRatingSelect.createEl("option", { text: "My Rating", attr: { value: "" } });
    for (let v = 10; v >= 1; v--) {
      const opt = myRatingSelect.createEl("option", { text: `${v}+`, attr: { value: String(v) } });
      if (state.minMyRating === String(v)) opt.selected = true;
    }
    myRatingSelect.addEventListener("change", () => {
      state.minMyRating = myRatingSelect.value;
      renderGrid();
    });

    const runtimeSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    runtimeSelect.createEl("option", { text: "All Runtime", attr: { value: "" } });
    runtimeOptions.forEach((r) => {
      const opt = runtimeSelect.createEl("option", { text: `${r} min`, attr: { value: String(r) } });
      if (state.runtime === String(r)) opt.selected = true;
    });
    runtimeSelect.addEventListener("change", () => {
      state.runtime = runtimeSelect.value;
      renderGrid();
    });

    const clearBtn = morePanel.createEl("button", { cls: "movie-gallery-clear-btn", text: "Clear" });
    clearBtn.addEventListener("click", () => {
      Object.assign(state, {
        genre: "all",
        language: "all",
        year: "all",
        minRating: "",
        minMyRating: "",
        runtime: "",
      });
      this.renderMovieSection(el, stateKey);
    });

    moreBtn.addEventListener("click", () => {
      state.moreOpen = !state.moreOpen;
      this.renderMovieSection(el, stateKey);
    });

    const countEl = el.createDiv({ cls: "movie-gallery-count" });
    const grid = el.createDiv({ cls: "movie-gallery-grid" });

    const CARD_SIZE_PX = { small: 110, medium: 140, large: 180 };
    if (this.settings.cardsPerRow && this.settings.cardsPerRow !== "auto") {
      grid.style.gridTemplateColumns = `repeat(${this.settings.cardsPerRow}, 1fr)`;
    } else {
      const px = CARD_SIZE_PX[this.settings.cardSize] || 140;
      grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${px}px, 1fr))`;
    }

    let movieVisibleCount = 60;
    const renderGrid = (preserveCount) => {
      if (!preserveCount) movieVisibleCount = 60;
      grid.empty();
      const movies = this.filterAndSort(allMovies, state);
      countEl.setText(`${movies.length} of ${allMovies.length} movie${allMovies.length === 1 ? "" : "s"}`);

      if (!allMovies.length) {
        grid.createDiv({ cls: "movie-gallery-empty", text: "No movies yet. Click \"+ Add movie\" to search TMDB." });
        return;
      }
      if (!movies.length) {
        grid.createDiv({ cls: "movie-gallery-empty", text: "No movies match your search/filter." });
        return;
      }

      const f = this.settings.cardFields;
      const visibleMovies = movies.slice(0, movieVisibleCount);

      for (const m of visibleMovies) {
        const card = grid.createDiv({ cls: "movie-gallery-card" + (m.watched ? " watched" : "") });
        const posterUrl = getPosterUrl(m);
        const posterImg = card.createEl("img", { attr: { src: posterUrl, alt: m.title, loading: "lazy" } });
        const openModal = () => new MovieDetailModal(this.app, this, m).open();
        posterImg.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openModal();
        });

        if (f.title || f.year) {
          let titleText = f.title ? m.title : "";
          if (f.year) titleText += f.title ? ` (${m.year})` : m.year;
          card.createDiv({ cls: "movie-gallery-title", text: titleText });
        }

        const metaLine = (text) => {
          if (text) card.createDiv({ cls: "movie-gallery-meta", text });
        };

        if (f.rating || f.myRating) {
          let ratingText = f.rating ? `⭐ ${m.rating}` : "";
          if (f.myRating && m.myRating) ratingText += ratingText ? ` · Me: ${m.myRating}` : `Me: ${m.myRating}`;
          metaLine(ratingText);
        }
        if (f.status) metaLine(m.watched ? "Watched" : "To Watch");
        if (f.genres) metaLine(m.genres);
        if (f.director) metaLine(m.director);
        if (f.cast) metaLine(m.cast);
        if (f.release_date) metaLine(this.formatDate(m.release_date));
        if (f.runtime) metaLine(this.formatRuntime(m.runtime));
        if (f.language) metaLine(this.languageName(m.original_language));
        if (f.budget) metaLine(this.formatBudget(m.budget));
        if (f.overview && m.overview) card.createDiv({ cls: "movie-gallery-meta movie-gallery-overview-snippet", text: m.overview });
        if (f.notes && m.notes) card.createDiv({ cls: "movie-gallery-meta movie-gallery-notes-snippet", text: m.notes });

        card.addEventListener("click", openModal);
      }

      if (movies.length > movieVisibleCount) {
        const remaining = movies.length - movieVisibleCount;
        const moreWrap = grid.createDiv({ cls: "movie-gallery-show-more-wrap" });
        const moreBtn = moreWrap.createEl("button", {
          cls: "movie-gallery-show-more-btn",
          text: `Show more (${remaining} remaining)`,
        });
        moreBtn.addEventListener("click", () => {
          movieVisibleCount += 60;
          renderGrid(true);
        });
      }
    };

    renderGrid();
  }

  async renderTvSection(el, stateKey) {
    if (!this.tvGalleryStates) this.tvGalleryStates = new Map();
    let state = this.tvGalleryStates.get(stateKey);
    if (!state) {
      state = {
        search: "",
        filter: "all",
        genre: "all",
        language: "all",
        year: "all",
        sort: "added-desc",
        minRating: "",
        minMyRating: "",
        moreOpen: false,
      };
      this.tvGalleryStates.set(stateKey, state);
    }

    el.empty();
    el.addClass("movie-gallery-block");

    const allShows = await this.readShows();
    const genreOptions = Array.from(
      new Set(allShows.flatMap((s) => (s.genres || "").split(",").map((g) => g.trim()).filter(Boolean)))
    ).sort();
    const languageOptions = Array.from(
      new Set(allShows.map((s) => s.original_language).filter(Boolean))
    ).sort();
    const yearOptions = Array.from(new Set(allShows.map((s) => s.year).filter(Boolean))).sort((a, b) =>
      b.localeCompare(a)
    );

    const header = el.createDiv({ cls: "movie-gallery-header" });
    header.createDiv({ cls: "movie-gallery-heading", text: "📺 TV Library" });
    const headerActions = header.createDiv({ cls: "movie-gallery-header-actions" });
    const addBtn = headerActions.createEl("button", { text: "+ Add Show", cls: "movie-gallery-add-btn" });
    addBtn.addEventListener("click", () => new AddShowModal(this.app, this).open());

    const statsBtn = headerActions.createEl("button", {
      cls: "movie-gallery-settings-btn",
      text: "📊",
      attr: { "aria-label": "TV stats" },
    });
    statsBtn.addEventListener("click", () => new TvStatsModal(this.app, this, stateKey).open());

    const settingsBtn = headerActions.createEl("button", {
      cls: "movie-gallery-settings-btn",
      text: "⚙",
      attr: { "aria-label": "TV gallery settings" },
    });
    settingsBtn.addEventListener("click", () => new TvGallerySettingsModal(this.app, this).open());

    const toolbar = el.createDiv({ cls: "movie-gallery-toolbar" });
    const searchInput = toolbar.createEl("input", {
      type: "text",
      cls: "movie-gallery-search",
      attr: { placeholder: "Search title, creator, or cast..." },
    });
    searchInput.value = state.search;
    this.attachSearchClear(searchInput);

    let tvSearchDebounce = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(tvSearchDebounce);
      tvSearchDebounce = setTimeout(() => {
        state.search = searchInput.value;
        renderGrid();
      }, 200);
    });

    const toolbarRight = toolbar.createDiv({ cls: "movie-gallery-toolbar-right" });

    const filterSelect = toolbarRight.createEl("select", { cls: "movie-gallery-filter" });
    [
      ["all", "All Status"],
      ["watched", "Watched"],
      ["unwatched", "To Watch"],
    ].forEach(([value, label]) => {
      const opt = filterSelect.createEl("option", { text: label, attr: { value } });
      if (state.filter === value) opt.selected = true;
    });
    filterSelect.addEventListener("change", () => {
      state.filter = filterSelect.value;
      renderGrid();
    });

    const genreSelect = toolbarRight.createEl("select", { cls: "movie-gallery-filter" });
    genreSelect.createEl("option", { text: "All Genres", attr: { value: "all" } });
    genreOptions.forEach((g) => {
      const opt = genreSelect.createEl("option", { text: g, attr: { value: g } });
      if (state.genre === g) opt.selected = true;
    });
    genreSelect.addEventListener("change", () => {
      state.genre = genreSelect.value;
      renderGrid();
    });

    const sortSelect = toolbarRight.createEl("select", { cls: "movie-gallery-sort" });
    [
      ["added-desc", "Recently added"],
      ["title-asc", "Title (A-Z)"],
      ["year-desc", "Year (newest)"],
      ["year-asc", "Year (oldest)"],
      ["rating-desc", "Rating (highest)"],
    ].forEach(([value, label]) => {
      const opt = sortSelect.createEl("option", { text: label, attr: { value } });
      if (state.sort === value) opt.selected = true;
    });
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      renderGrid();
    });

    const moreBtn = toolbarRight.createEl("button", {
      cls: "movie-gallery-more-btn",
      attr: { "aria-label": "Filters" },
    });
    moreBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="4,4 20,4 14,12 14,19 10,21 10,12"/></svg>';
    moreBtn.toggleClass("active", state.moreOpen);

    const morePanel = el.createDiv({ cls: "movie-gallery-more-panel" });
    morePanel.toggleClass("open", state.moreOpen);

    const yearSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    yearSelect.createEl("option", { text: "All Years", attr: { value: "all" } });
    yearOptions.forEach((y) => {
      const opt = yearSelect.createEl("option", { text: y, attr: { value: y } });
      if (state.year === y) opt.selected = true;
    });
    yearSelect.addEventListener("change", () => {
      state.year = yearSelect.value;
      renderGrid();
    });

    const langSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    langSelect.createEl("option", { text: "All Languages", attr: { value: "all" } });
    languageOptions.forEach((code) => {
      const opt = langSelect.createEl("option", { text: this.languageName(code), attr: { value: code } });
      if (state.language === code) opt.selected = true;
    });
    langSelect.addEventListener("change", () => {
      state.language = langSelect.value;
      renderGrid();
    });

    const ratingSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    ratingSelect.createEl("option", { text: "All Ratings", attr: { value: "" } });
    for (let v = 9; v >= 1; v--) {
      const opt = ratingSelect.createEl("option", { text: `${v}+`, attr: { value: String(v) } });
      if (state.minRating === String(v)) opt.selected = true;
    }
    ratingSelect.addEventListener("change", () => {
      state.minRating = ratingSelect.value;
      renderGrid();
    });

    const myRatingSelect = morePanel.createEl("select", { cls: "movie-gallery-filter" });
    myRatingSelect.createEl("option", { text: "My Rating", attr: { value: "" } });
    for (let v = 10; v >= 1; v--) {
      const opt = myRatingSelect.createEl("option", { text: `${v}+`, attr: { value: String(v) } });
      if (state.minMyRating === String(v)) opt.selected = true;
    }
    myRatingSelect.addEventListener("change", () => {
      state.minMyRating = myRatingSelect.value;
      renderGrid();
    });

    const clearBtn = morePanel.createEl("button", { cls: "movie-gallery-clear-btn", text: "Clear" });
    clearBtn.addEventListener("click", () => {
      Object.assign(state, { genre: "all", language: "all", year: "all", minRating: "", minMyRating: "" });
      this.renderTvSection(el, stateKey);
    });

    moreBtn.addEventListener("click", () => {
      state.moreOpen = !state.moreOpen;
      this.renderTvSection(el, stateKey);
    });

    const countEl = el.createDiv({ cls: "movie-gallery-count" });
    const grid = el.createDiv({ cls: "movie-gallery-grid" });

    const CARD_SIZE_PX = { small: 110, medium: 140, large: 180 };
    if (this.settings.tvCardsPerRow && this.settings.tvCardsPerRow !== "auto") {
      grid.style.gridTemplateColumns = `repeat(${this.settings.tvCardsPerRow}, 1fr)`;
    } else {
      const px = CARD_SIZE_PX[this.settings.tvCardSize] || 140;
      grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${px}px, 1fr))`;
    }

    let tvVisibleCount = 60;
    const renderGrid = (preserveCount) => {
      if (!preserveCount) tvVisibleCount = 60;
      grid.empty();
      const q = state.search.trim().toLowerCase();
      let shows = allShows.filter((s) => {
        const matchesSearch =
          !q ||
          (s.name || "").toLowerCase().includes(q) ||
          (s.creators || "").toLowerCase().includes(q) ||
          (s.cast || "").toLowerCase().includes(q);
        const matchesFilter =
          state.filter === "all" ||
          (state.filter === "watched" && s.watched) ||
          (state.filter === "unwatched" && !s.watched);
        const matchesGenre =
          state.genre === "all" || (s.genres || "").split(",").map((g) => g.trim()).includes(state.genre);
        const matchesLanguage = state.language === "all" || s.original_language === state.language;
        const matchesYear = state.year === "all" || s.year === state.year;
        const matchesRating = !state.minRating || parseFloat(s.rating || 0) >= parseFloat(state.minRating);
        const matchesMyRating =
          !state.minMyRating || parseFloat(s.myRating || 0) >= parseFloat(state.minMyRating);
        return (
          matchesSearch && matchesFilter && matchesGenre && matchesLanguage && matchesYear && matchesRating && matchesMyRating
        );
      });

      switch (state.sort) {
        case "title-asc":
          shows.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "year-desc":
          shows.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
          break;
        case "year-asc":
          shows.sort((a, b) => (a.year || "").localeCompare(b.year || ""));
          break;
        case "rating-desc":
          shows.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
          break;
        default:
          shows = shows.slice().reverse();
      }

      if (q) {
        shows = shows
          .map((s, i) => ({ s, i, titleMatch: (s.name || "").toLowerCase().includes(q) }))
          .sort((a, b) => (a.titleMatch === b.titleMatch ? a.i - b.i : a.titleMatch ? -1 : 1))
          .map((x) => x.s);
      }

      countEl.setText(`${shows.length} of ${allShows.length} show${allShows.length === 1 ? "" : "s"}`);

      if (!allShows.length) {
        grid.createDiv({ cls: "movie-gallery-empty", text: 'No shows yet. Click "+ Add Show" to search TMDB.' });
        return;
      }
      if (!shows.length) {
        grid.createDiv({ cls: "movie-gallery-empty", text: "No shows match your search/filter." });
        return;
      }

      const f = this.settings.tvCardFields;
      const visibleShows = shows.slice(0, tvVisibleCount);

      for (const s of visibleShows) {
        const card = grid.createDiv({ cls: "movie-gallery-card" + (s.watched ? " watched" : "") });
        const posterUrl = getPosterUrl(s);
        const posterImg = card.createEl("img", { attr: { src: posterUrl, alt: s.name, loading: "lazy" } });
        const openModal = () => new TvDetailModal(this.app, this, s).open();
        posterImg.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openModal();
        });

        if (f.title || f.year) {
          let titleText = f.title ? s.name : "";
          if (f.year) titleText += f.title ? ` (${s.year})` : s.year;
          card.createDiv({ cls: "movie-gallery-title", text: titleText });
        }

        const metaLine = (text) => {
          if (text) card.createDiv({ cls: "movie-gallery-meta", text });
        };

        if (f.rating || f.myRating) {
          let ratingText = f.rating ? `⭐ ${s.rating}` : "";
          if (f.myRating && s.myRating) ratingText += ratingText ? ` · Me: ${s.myRating}` : `Me: ${s.myRating}`;
          metaLine(ratingText);
        }
        if (f.status) metaLine(s.watched ? "Watched" : "To Watch");
        if (f.genres) metaLine(s.genres);
        if (f.director) metaLine(s.creators);
        if (f.cast) metaLine(s.cast);
        if (f.release_date) metaLine(this.formatDate(s.first_air_date));
        if (f.runtime) metaLine(this.formatRuntime(s.episode_runtime));
        if (f.language) metaLine(this.languageName(s.original_language));
        if (f.seasons && s.number_of_seasons) metaLine(`${s.number_of_seasons} season${s.number_of_seasons === 1 ? "" : "s"}`);
        if (f.episodes && s.number_of_episodes) {
          const watchedEp = s.episodesWatched || 0;
          metaLine(watchedEp > 0 ? `${watchedEp} / ${s.number_of_episodes} episodes` : `${s.number_of_episodes} episodes`);
        }
        if (f.network && s.network) metaLine(s.network);
        if (f.overview && s.overview) card.createDiv({ cls: "movie-gallery-meta movie-gallery-overview-snippet", text: s.overview });
        if (f.notes && s.notes) card.createDiv({ cls: "movie-gallery-meta movie-gallery-notes-snippet", text: s.notes });

        card.addEventListener("click", openModal);
      }

      if (shows.length > tvVisibleCount) {
        const remaining = shows.length - tvVisibleCount;
        const moreWrap = grid.createDiv({ cls: "movie-gallery-show-more-wrap" });
        const moreBtn = moreWrap.createEl("button", {
          cls: "movie-gallery-show-more-btn",
          text: `Show more (${remaining} remaining)`,
        });
        moreBtn.addEventListener("click", () => {
          tvVisibleCount += 60;
          renderGrid(true);
        });
      }
    };

    renderGrid();
  }
}

class AddMovieModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this._searchTimer = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("movie-add-modal");
    contentEl.createEl("h2", { text: "Add Movie" });

    if (this.plugin.settings.tmdbApiKey) {
      contentEl.createEl("div", { cls: "movie-add-label", text: "Search Movie Database" });
      const input = contentEl.createEl("input", {
        type: "text",
        cls: "movie-add-search-input",
        attr: { placeholder: "Search TMDB..." },
      });
      const resultsEl = contentEl.createDiv({ cls: "movie-search-results" });
      const statusEl = contentEl.createDiv({ cls: "movie-search-status" });

      const doSearch = async () => {
        const query = input.value.trim();
        resultsEl.empty();
        if (!query) {
          statusEl.setText("");
          return;
        }
        statusEl.setText("Searching...");
        try {
          const results = await this.searchTmdb(query);
          statusEl.setText(results.length ? `${results.length} result(s)` : "No results.");
          for (const movie of results) this.renderResult(resultsEl, movie);
        } catch (err) {
          statusEl.setText("Error: " + err.message);
        }
      };

      input.addEventListener("input", () => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(doSearch, 400);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          clearTimeout(this._searchTimer);
          doSearch();
        }
      });
      input.focus();
    } else {
      contentEl.createEl("p", {
        text: "Set your TMDB API key in Settings → Movie Gallery to search TMDB, or fill in the form below manually.",
        cls: "movie-gallery-warning",
      });
    }

    const divider = contentEl.createDiv({ cls: "movie-add-divider" });
    divider.createSpan({ text: "OR ENTER MANUALLY" });

    const form = contentEl.createDiv({ cls: "movie-add-form" });
    const draft = {
      title: "",
      year: "",
      rating: "",
      myRating: "",
      release_date: "",
      runtime: null,
      original_language: "",
      budget: 0,
      genres: "",
      director: "",
      cast: "",
      watched: false,
      custom_poster_url: "",
      trailer_key: "",
      overview: "",
      notes: "",
    };

    const makeRow = (full) => makeFormRow(form, full);
    const addField = (parent, label, key, opts = {}) =>
      addFormField(parent, label, { ...opts, onChange: (v) => (draft[key] = v) });

    const r1 = makeRow();
    addField(r1, "Title", "title");
    addField(r1, "Year", "year", { placeholder: "e.g. 2026" });

    const r2 = makeRow();
    addField(r2, "TMDB / IMDb Rating", "rating", { placeholder: "e.g. 8.5" });
    addField(r2, "My Rating", "myRating", {
      type: "select",
      options: [["", "Not Rated"], ...Array.from({ length: 11 }, (_, i) => [String(i), String(i)])],
    });

    const r3 = makeRow();
    addField(r3, "Release Date", "release_date", { type: "date" });
    addField(r3, "Runtime", "runtime", { placeholder: "Minutes", hint: "Example: 169 minutes → 2h 49m" });

    const r4 = makeRow();
    addField(r4, "Language", "original_language", { placeholder: "e.g. en" });
    addField(r4, "Budget", "budget", { placeholder: "USD", hint: "Example: 185000000" });

    const r5 = makeRow();
    addField(r5, "Genres", "genres", { placeholder: "Action, Drama" });
    addField(r5, "Director", "director");

    const r6 = makeRow();
    addField(r6, "Cast", "cast");
    addField(r6, "Status", "status", {
      type: "select",
      options: [
        ["to_watch", "To Watch"],
        ["watched", "Watched"],
      ],
    });

    addField(makeRow(true), "Poster URL", "custom_poster_url", { placeholder: "Poster URL" });
    addField(makeRow(true), "Trailer URL", "trailer_key", { placeholder: "https://www.youtube.com/watch?v=..." });
    addField(makeRow(true), "Overview", "overview", { type: "textarea", placeholder: "Short overview..." });
    addField(makeRow(true), "Notes", "notes", { type: "textarea", placeholder: "Personal notes..." });

    const actions = contentEl.createDiv({ cls: "movie-add-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "movie-add-cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = actions.createEl("button", { text: "Save Movie", cls: "movie-add-save" });
    saveBtn.addEventListener("click", async () => {
      if (!draft.title.trim()) {
        new Notice("Title is required.");
        return;
      }
      const trailerMatch = (draft.trailer_key || "").match(/(?:v=|youtu\.be\/)([\w-]{6,})/);

      const movie = {
        id: "custom-" + Date.now(),
        title: draft.title.trim(),
        year: draft.year.trim(),
        poster_path: "",
        custom_poster_url: draft.custom_poster_url.trim(),
        rating: draft.rating.trim(),
        myRating: draft.myRating,
        watched: draft.status === "watched",
        release_date: draft.release_date,
        runtime: draft.runtime ? parseInt(draft.runtime, 10) : null,
        original_language: draft.original_language.trim(),
        budget: draft.budget ? parseInt(draft.budget, 10) : 0,
        genres: draft.genres.trim(),
        director: draft.director.trim(),
        cast: draft.cast.trim(),
        overview: draft.overview.trim(),
        notes: draft.notes.trim(),
        trailer_key: trailerMatch ? trailerMatch[1] : "",
      };

      await this.plugin.addMovie(movie);
      this.close();
    });
  }

  async searchTmdb(query) {
    const url =
      "https://api.themoviedb.org/3/search/movie?" +
      new URLSearchParams({
        api_key: this.plugin.settings.tmdbApiKey,
        query,
        include_adult: "false",
      }).toString();

    const res = await requestUrl({ url });
    const data = res.json;
    return (data.results || []).slice(0, 10);
  }

  renderResult(container, movie) {
    const item = container.createDiv({ cls: "movie-search-result" });
    const posterUrl = movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : "";
    item.createEl("img", { attr: { src: posterUrl, alt: movie.title } });
    const info = item.createDiv({ cls: "movie-search-result-info" });
    const year = (movie.release_date || "????").slice(0, 4);
    info.createDiv({ text: `${movie.title} (${year})`, cls: "movie-search-result-title" });
    info.createDiv({ text: `⭐ ${(movie.vote_average || 0).toFixed(1)}`, cls: "movie-search-result-rating" });

    item.addEventListener("click", async () => {
      item.addClass("loading");
      try {
        const details = await this.plugin.fetchMovieDetails(movie.id, {
          title: movie.title,
          year,
          poster_path: movie.poster_path,
          rating: (movie.vote_average || 0).toFixed(1),
        });
        await this.plugin.addMovie(details);
      } finally {
        this.close();
      }
    });
  }

  onClose() {
    clearTimeout(this._searchTimer);
    this.contentEl.empty();
  }
}

class AddShowModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this._searchTimer = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("movie-add-modal");
    contentEl.createEl("h2", { text: "Add TV Show" });

    if (this.plugin.settings.tmdbApiKey) {
      contentEl.createEl("div", { cls: "movie-add-label", text: "Search TV Database" });
      const input = contentEl.createEl("input", {
        type: "text",
        cls: "movie-add-search-input",
        attr: { placeholder: "Search TMDB..." },
      });
      const resultsEl = contentEl.createDiv({ cls: "movie-search-results" });
      const statusEl = contentEl.createDiv({ cls: "movie-search-status" });

      const doSearch = async () => {
        const query = input.value.trim();
        resultsEl.empty();
        if (!query) {
          statusEl.setText("");
          return;
        }
        statusEl.setText("Searching...");
        try {
          const results = await this.searchTmdb(query);
          statusEl.setText(results.length ? `${results.length} result(s)` : "No results.");
          for (const show of results) this.renderResult(resultsEl, show);
        } catch (err) {
          statusEl.setText("Error: " + err.message);
        }
      };

      input.addEventListener("input", () => {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(doSearch, 400);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          clearTimeout(this._searchTimer);
          doSearch();
        }
      });
      input.focus();
    } else {
      contentEl.createEl("p", {
        text: "Set your TMDB API key in Settings → Movie Gallery to search TMDB, or fill in the form below manually.",
        cls: "movie-gallery-warning",
      });
    }

    const divider = contentEl.createDiv({ cls: "movie-add-divider" });
    divider.createSpan({ text: "OR ENTER MANUALLY" });

    const form = contentEl.createDiv({ cls: "movie-add-form" });
    const draft = {
      name: "",
      year: "",
      rating: "",
      myRating: "",
      first_air_date: "",
      episode_runtime: null,
      original_language: "",
      genres: "",
      creators: "",
      cast: "",
      watched: false,
      custom_poster_url: "",
      trailer_key: "",
      overview: "",
      notes: "",
      number_of_seasons: null,
      number_of_episodes: null,
      episodesWatched: 0,
    };

    const makeRow = (full) => makeFormRow(form, full);
    const addField = (parent, label, key, opts = {}) =>
      addFormField(parent, label, { ...opts, onChange: (v) => (draft[key] = v) });

    const r1 = makeRow();
    addField(r1, "Name", "name");
    addField(r1, "Year", "year", { placeholder: "e.g. 2026" });

    const r2 = makeRow();
    addField(r2, "TMDB / IMDb Rating", "rating", { placeholder: "e.g. 8.5" });
    addField(r2, "My Rating", "myRating", {
      type: "select",
      options: [["", "Not Rated"], ...Array.from({ length: 11 }, (_, i) => [String(i), String(i)])],
    });

    const r3 = makeRow();
    addField(r3, "First Air Date", "first_air_date", { type: "date" });
    addField(r3, "Episode Runtime", "episode_runtime", { placeholder: "Minutes", hint: "Per-episode runtime" });

    const r4 = makeRow();
    addField(r4, "Seasons", "number_of_seasons", { placeholder: "e.g. 5" });
    addField(r4, "Episodes", "number_of_episodes", { placeholder: "e.g. 62" });

    const r4b = makeRow();
    addField(r4b, "Episodes Watched", "episodesWatched", { placeholder: "e.g. 12" });
    addField(r4b, "Language", "original_language", { placeholder: "e.g. en" });

    const r5 = makeRow();
    addField(r5, "Genres", "genres", { placeholder: "Drama, Comedy" });
    addField(r5, "Creator", "creators");

    const r6 = makeRow();
    addField(r6, "Status", "status", {
      type: "select",
      options: [
        ["to_watch", "To Watch"],
        ["watched", "Watched"],
      ],
    });
    addField(r6, "Cast", "cast");

    addField(makeRow(true), "Poster URL", "custom_poster_url", { placeholder: "Poster URL" });
    addField(makeRow(true), "Trailer URL", "trailer_key", { placeholder: "https://www.youtube.com/watch?v=..." });
    addField(makeRow(true), "Overview", "overview", { type: "textarea", placeholder: "Short overview..." });
    addField(makeRow(true), "Notes", "notes", { type: "textarea", placeholder: "Personal notes..." });

    const actions = contentEl.createDiv({ cls: "movie-add-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "movie-add-cancel" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = actions.createEl("button", { text: "Save Show", cls: "movie-add-save" });
    saveBtn.addEventListener("click", async () => {
      if (!draft.name.trim()) {
        new Notice("Name is required.");
        return;
      }
      const trailerMatch = (draft.trailer_key || "").match(/(?:v=|youtu\.be\/)([\w-]{6,})/);

      const show = {
        id: "custom-" + Date.now(),
        name: draft.name.trim(),
        year: draft.year.trim(),
        poster_path: "",
        custom_poster_url: draft.custom_poster_url.trim(),
        rating: draft.rating.trim(),
        myRating: draft.myRating,
        watched: draft.status === "watched",
        episodesWatched: draft.episodesWatched ? parseInt(draft.episodesWatched, 10) : 0,
        first_air_date: draft.first_air_date,
        last_air_date: "",
        show_status: "",
        episode_runtime: draft.episode_runtime ? parseInt(draft.episode_runtime, 10) : null,
        original_language: draft.original_language.trim(),
        genres: draft.genres.trim(),
        creators: draft.creators.trim(),
        cast: draft.cast.trim(),
        overview: draft.overview.trim(),
        notes: draft.notes.trim(),
        trailer_key: trailerMatch ? trailerMatch[1] : "",
        number_of_seasons: draft.number_of_seasons ? parseInt(draft.number_of_seasons, 10) : null,
        number_of_episodes: draft.number_of_episodes ? parseInt(draft.number_of_episodes, 10) : null,
      };

      await this.plugin.addShow(show);
      this.close();
    });
  }

  async searchTmdb(query) {
    const url =
      "https://api.themoviedb.org/3/search/tv?" +
      new URLSearchParams({ api_key: this.plugin.settings.tmdbApiKey, query }).toString();

    const res = await requestUrl({ url });
    const data = res.json;
    return (data.results || []).slice(0, 10);
  }

  renderResult(container, show) {
    const item = container.createDiv({ cls: "movie-search-result" });
    const posterUrl = show.poster_path ? `${POSTER_BASE}${show.poster_path}` : "";
    item.createEl("img", { attr: { src: posterUrl, alt: show.name } });
    const info = item.createDiv({ cls: "movie-search-result-info" });
    const year = (show.first_air_date || "????").slice(0, 4);
    info.createDiv({ text: `${show.name} (${year})`, cls: "movie-search-result-title" });
    info.createDiv({ text: `⭐ ${(show.vote_average || 0).toFixed(1)}`, cls: "movie-search-result-rating" });

    item.addEventListener("click", async () => {
      item.addClass("loading");
      try {
        const details = await this.plugin.fetchShowDetails(show.id, {
          name: show.name,
          year,
          poster_path: show.poster_path,
          rating: (show.vote_average || 0).toFixed(1),
        });
        await this.plugin.addShow(details);
      } finally {
        this.close();
      }
    });
  }

  onClose() {
    clearTimeout(this._searchTimer);
    this.contentEl.empty();
  }
}

class MovieDetailModal extends Modal {
  constructor(app, plugin, movie) {
    super(app);
    this.plugin = plugin;
    this.movie = movie;
  }

  onOpen() {
    this.renderView();
    this.contentEl.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => this.contentEl.focus({ preventScroll: true }));
  }

  renderView() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("movie-detail-modal");
    const m = this.movie;

    const layout = contentEl.createDiv({ cls: "movie-detail-layout" });
    const posterUrl = getPosterUrl(m);
    layout.createEl("img", { cls: "movie-detail-poster", attr: { src: posterUrl, alt: m.title } });

    const info = layout.createDiv({ cls: "movie-detail-info" });

    info.createEl("h2", { text: m.title, cls: "movie-detail-title" });

    const subtitleRow = info.createDiv({ cls: "movie-detail-subtitle" });
    if (m.year) subtitleRow.createSpan({ cls: "movie-detail-subtitle-year", text: m.year });
    if (m.year) subtitleRow.createSpan({ cls: "movie-detail-subtitle-dot", text: "·" });
    subtitleRow.createSpan({ cls: "movie-detail-rating-pill", text: `★ ${m.rating}` });

    if (m.overview) {
      info.createEl("p", { text: m.overview, cls: "movie-detail-overview-lead" });
    }

    if (m.genres) {
      const genreRow = info.createDiv({ cls: "movie-detail-chip-row" });
      m.genres.split(",").map((g) => g.trim()).filter(Boolean)
        .forEach((g) => genreRow.createSpan({ cls: "movie-detail-genre-pill", text: g }));
    }

    const facts = contentEl.createDiv({ cls: "movie-detail-facts" });

    const addFact = (label, value) => {
      if (!value) return;
      const f = facts.createDiv({ cls: "movie-detail-fact" });
      f.createDiv({ cls: "movie-detail-fact-label", text: label });
      f.createDiv({ cls: "movie-detail-fact-value", text: value });
    };

    addFact("Director", m.director);
    addFact("Release Date", this.plugin.formatDate(m.release_date));
    addFact("Runtime", this.plugin.formatRuntime(m.runtime));
    addFact("Language", this.plugin.languageName(m.original_language));
    addFact("Budget", this.plugin.formatBudget(m.budget));

    const statusFact = facts.createDiv({ cls: "movie-detail-fact" });
    statusFact.createDiv({ cls: "movie-detail-fact-label", text: "Status" });
    const statusPill = statusFact.createDiv({
      cls: "movie-detail-status-pill" + (m.watched ? " is-watched" : ""),
      text: m.watched ? "Watched" : "To Watch",
    });
    statusPill.addEventListener("click", async () => {
      m.watched = !m.watched;
      await this.plugin.updateMovie(m);
      this.renderView();
    });

    const ratingFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
    ratingFact.createDiv({ cls: "movie-detail-fact-label", text: "My Rating" });
    const ratingWrap = ratingFact.createDiv({ cls: "movie-rating-picker" });

    const currentVal = m.myRating !== "" && m.myRating != null ? String(m.myRating) : "";

    ratingWrap.createDiv({
      cls: "movie-rating-current" + (currentVal === "" ? " is-empty" : ""),
      text: currentVal === "" ? "—" : currentVal,
    });

    const optionsRow = ratingWrap.createDiv({ cls: "movie-rating-options" });
    for (let i = 0; i <= 10; i++) {
      const box = optionsRow.createDiv({ cls: "movie-rating-option", text: String(i) });
      box.dataset.value = String(i);
      if (String(i) === currentVal) box.addClass("is-selected");
      box.addEventListener("click", async () => {
        const clicked = String(i);
        const newVal = clicked === currentVal ? "" : clicked;
        m.myRating = newVal;
        await this.plugin.updateMovie(m);
        this.renderView();
      });
    }

    if (m.cast) {
      const castFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full movie-detail-fact-trailing" });
      castFact.createDiv({ cls: "movie-detail-fact-label", text: "Cast" });
      castFact.createDiv({ cls: "movie-detail-fact-value", text: m.cast });
    }

    if (m.notes) {
      const notesFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full movie-detail-fact-notes" });
      notesFact.createDiv({ cls: "movie-detail-fact-label", text: "Notes" });
      notesFact.createDiv({ cls: "movie-detail-fact-value", text: m.notes });
    }

    const actions = contentEl.createDiv({ cls: "movie-detail-actions" });
    if (m.trailer_key) {
      const trailerBtn = actions.createEl("button", { text: "▶ Watch Trailer", cls: "movie-detail-trailer-btn" });
      trailerBtn.addEventListener("click", () => {
        window.open(`https://www.youtube.com/watch?v=${m.trailer_key}`, "_blank");
      });
    }
    const editBtn = actions.createEl("button", { text: "✎ Edit", cls: "movie-detail-edit-btn" });
    editBtn.addEventListener("click", () => this.renderEdit());

    const deleteBtn = actions.createEl("button", { text: "🗑 Delete", cls: "movie-detail-delete" });
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`Delete "${m.title}" from your library?`)) {
        await this.plugin.removeMovie(m.id);
        this.close();
      }
    });

    const similarSection = contentEl.createDiv({ cls: "movie-detail-similar-section" });
    similarSection.createEl("h3", { text: "Similar Movies", cls: "movie-detail-section-title" });
    const similarList = similarSection.createDiv({ cls: "movie-detail-similar-list" });

    if (this._similarResults) {
      this.populateSimilar(similarList, this._similarResults);
    } else {
      similarList.createDiv({ cls: "movie-detail-similar-loading", text: "Loading similar movies..." });
      this.plugin.fetchSimilarMovies(m.id).then((results) => {
        this._similarResults = results;
        if (document.body.contains(similarList)) {
          this.populateSimilar(similarList, results);
        }
      });
    }
  }

  async populateSimilar(container, results) {
    container.empty();
    if (!results.length) {
      container.createDiv({ cls: "movie-detail-similar-empty", text: "No similar movies found." });
      return;
    }

    const libraryMovies = await this.plugin.readMovies();
    const libraryIds = new Set(libraryMovies.map((mv) => mv.id));

    for (const sm of results) {
      const card = container.createDiv({ cls: "movie-detail-similar-card" });
      const posterWrap = card.createDiv({ cls: "movie-detail-similar-poster-wrap" });
      const posterUrl = sm.poster_path ? `${POSTER_BASE}${sm.poster_path}` : "";
      posterWrap.createEl("img", { attr: { src: posterUrl, alt: sm.title, loading: "lazy" } });
      const year = (sm.release_date || "????").slice(0, 4);

      if (libraryIds.has(sm.id)) {
        posterWrap.createDiv({ cls: "movie-detail-similar-badge is-added", text: "✓" });
      } else {
        const addBadge = posterWrap.createDiv({ cls: "movie-detail-similar-badge", text: "+" });
        addBadge.setAttribute("aria-label", "Add to library");
        addBadge.addEventListener("click", async (e) => {
          e.stopPropagation();
          addBadge.setText("…");
          const details = await this.plugin.fetchMovieDetails(sm.id, {
            title: sm.title,
            year,
            poster_path: sm.poster_path,
            rating: (sm.vote_average || 0).toFixed(1),
          });
          await this.plugin.addMovie(details);
          addBadge.setText("✓");
          addBadge.addClass("is-added");
        });
      }

      card.createDiv({ cls: "movie-detail-similar-title", text: `${sm.title} (${year})` });
    }
  }

  renderEdit() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("movie-detail-modal");
    contentEl.addClass("movie-add-modal");
    const m = this.movie;

    contentEl.createEl("h2", { text: `Edit ${m.title}` });

    const form = contentEl.createDiv({ cls: "movie-add-form" });
    const makeRow = (full) => makeFormRow(form, full);

    const addField = (parent, label, key, opts = {}) => {
      const value = opts.getValue ? opts.getValue() : m[key] ?? "";
      return addFormField(parent, label, {
        ...opts,
        value,
        onChange: (v) => {
          if (opts.onInput) opts.onInput(v);
          else m[key] = v;
        },
      });
    };

    const r1 = makeRow();
    addField(r1, "Title", "title");
    addField(r1, "Year", "year");

    const r2 = makeRow();
    addField(r2, "TMDB / IMDb Rating", "rating");
    addField(r2, "Poster URL", "custom_poster_url", { placeholder: "Poster URL" });

    const r3 = makeRow();
    addField(r3, "Release Date", "release_date", { type: "date" });
    addField(r3, "Runtime (minutes)", "runtime", {
      getValue: () => (m.runtime ? String(m.runtime) : ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        m.runtime = isNaN(n) ? null : n;
      },
    });

    const r3b = makeRow();
    addField(r3b, "Language code", "original_language", { placeholder: "e.g. en" });
    addField(r3b, "Budget", "budget", {
      placeholder: "USD",
      getValue: () => (m.budget ? String(m.budget) : ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        m.budget = isNaN(n) ? 0 : n;
      },
    });

    const r4 = makeRow();
    addField(r4, "Director", "director");
    addField(r4, "Genres", "genres", { placeholder: "Comma-separated" });

    const r5 = makeRow();
    addField(r5, "Cast", "cast", { placeholder: "Comma-separated" });
    addField(r5, "Trailer URL", "trailer_key", {
      placeholder: "https://www.youtube.com/watch?v=...",
      getValue: () => (m.trailer_key ? `https://www.youtube.com/watch?v=${m.trailer_key}` : ""),
      onInput: (v) => {
        const match = v.match(/(?:v=|youtu\.be\/)([\w-]{6,})/);
        m.trailer_key = match ? match[1] : v.trim();
      },
    });

    addField(makeRow(true), "Overview", "overview", { type: "textarea" });
    addField(makeRow(true), "Notes", "notes", { type: "textarea", placeholder: "Personal notes..." });

    const actions = contentEl.createDiv({ cls: "movie-add-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "movie-add-cancel" });
    cancelBtn.addEventListener("click", () => this.renderView());

    const saveBtn = actions.createEl("button", { text: "Save Changes", cls: "movie-add-save" });
    saveBtn.addEventListener("click", async () => {
      await this.plugin.updateMovie(m);
      this.renderView();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class TvDetailModal extends Modal {
  constructor(app, plugin, show) {
    super(app);
    this.plugin = plugin;
    this.show = show;
  }

  onOpen() {
    this.renderView();
    this.contentEl.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => this.contentEl.focus({ preventScroll: true }));
  }

  renderView() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("movie-detail-modal");
    const s = this.show;

    const layout = contentEl.createDiv({ cls: "movie-detail-layout" });
    const posterUrl = getPosterUrl(s);
    layout.createEl("img", { cls: "movie-detail-poster", attr: { src: posterUrl, alt: s.name } });

    const info = layout.createDiv({ cls: "movie-detail-info" });

    info.createEl("h2", { text: s.name, cls: "movie-detail-title" });

    const subtitleRow = info.createDiv({ cls: "movie-detail-subtitle" });
    if (s.year) subtitleRow.createSpan({ cls: "movie-detail-subtitle-year", text: s.year });
    if (s.year) subtitleRow.createSpan({ cls: "movie-detail-subtitle-dot", text: "·" });
    subtitleRow.createSpan({ cls: "movie-detail-rating-pill", text: `★ ${s.rating}` });

    if (s.overview) {
      info.createEl("p", { text: s.overview, cls: "movie-detail-overview-lead" });
    }

    if (s.genres) {
      const genreRow = info.createDiv({ cls: "movie-detail-chip-row" });
      s.genres.split(",").map((g) => g.trim()).filter(Boolean)
        .forEach((g) => genreRow.createSpan({ cls: "movie-detail-genre-pill", text: g }));
    }

    const facts = contentEl.createDiv({ cls: "movie-detail-facts" });

    const addFact = (label, value) => {
      if (!value) return;
      const f = facts.createDiv({ cls: "movie-detail-fact" });
      f.createDiv({ cls: "movie-detail-fact-label", text: label });
      f.createDiv({ cls: "movie-detail-fact-value", text: value });
    };

    addFact("Creator", s.creators);
    addFact("First Air Date", this.plugin.formatDate(s.first_air_date));
    addFact("Episode Runtime", this.plugin.formatRuntime(s.episode_runtime));
    addFact("Language", this.plugin.languageName(s.original_language));
    addFact("Seasons", s.number_of_seasons ? String(s.number_of_seasons) : "");
    addFact("Series Status", s.show_status);

    const statusFact = facts.createDiv({ cls: "movie-detail-fact" });
    statusFact.createDiv({ cls: "movie-detail-fact-label", text: "Status" });
    const statusPill = statusFact.createDiv({
      cls: "movie-detail-status-pill" + (s.watched ? " is-watched" : ""),
      text: s.watched ? "Watched" : "To Watch",
    });
    statusPill.addEventListener("click", async () => {
      s.watched = !s.watched;
      await this.plugin.updateShow(s);
      this.renderView();
    });

    const ratingFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
    ratingFact.createDiv({ cls: "movie-detail-fact-label", text: "My Rating" });
    const ratingWrap = ratingFact.createDiv({ cls: "movie-rating-picker" });

    const currentVal = s.myRating !== "" && s.myRating != null ? String(s.myRating) : "";

    ratingWrap.createDiv({
      cls: "movie-rating-current" + (currentVal === "" ? " is-empty" : ""),
      text: currentVal === "" ? "—" : currentVal,
    });

    const optionsRow = ratingWrap.createDiv({ cls: "movie-rating-options" });
    for (let i = 0; i <= 10; i++) {
      const box = optionsRow.createDiv({ cls: "movie-rating-option", text: String(i) });
      box.dataset.value = String(i);
      if (String(i) === currentVal) box.addClass("is-selected");
      box.addEventListener("click", async () => {
        const clicked = String(i);
        const newVal = clicked === currentVal ? "" : clicked;
        s.myRating = newVal;
        await this.plugin.updateShow(s);
        this.renderView();
      });
    }

    const total = s.number_of_episodes || 0;
    const epFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full movie-detail-fact-trailing" });
    epFact.createDiv({ cls: "movie-detail-fact-label", text: "Episodes Watched" });
    const epRow = epFact.createDiv({ cls: "movie-detail-progress-row" });
    const epInput = epRow.createEl("input", {
      type: "number",
      cls: "movie-detail-inline-select movie-detail-episode-input",
      attr: { min: "0", ...(total ? { max: String(total) } : {}) },
    });
    epInput.value = String(s.episodesWatched || 0);
    if (total) epRow.createSpan({ cls: "movie-detail-progress-total", text: `/ ${total} episodes` });

    const progressTrack = epFact.createDiv({ cls: "movie-detail-progress-track" });
    const progressFill = progressTrack.createDiv({ cls: "movie-detail-progress-fill" });
    const pct = total ? Math.min(100, ((s.episodesWatched || 0) / total) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    if (!total) progressTrack.style.display = "none";

    const commitEpisodes = async () => {
      let val = parseInt(epInput.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (total && val > total) val = total;
      epInput.value = String(val);
      s.episodesWatched = val;
      if (total && val >= total) s.watched = true;
      await this.plugin.updateShow(s);
      this.renderView();
    };
    epInput.addEventListener("change", commitEpisodes);

    if (s.cast) {
      const castFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
      castFact.createDiv({ cls: "movie-detail-fact-label", text: "Cast" });
      castFact.createDiv({ cls: "movie-detail-fact-value", text: s.cast });
    }

    if (s.notes) {
      const notesFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full movie-detail-fact-notes" });
      notesFact.createDiv({ cls: "movie-detail-fact-label", text: "Notes" });
      notesFact.createDiv({ cls: "movie-detail-fact-value", text: s.notes });
    }

    const actions = contentEl.createDiv({ cls: "movie-detail-actions" });
    if (s.trailer_key) {
      const trailerBtn = actions.createEl("button", { text: "▶ Watch Trailer", cls: "movie-detail-trailer-btn" });
      trailerBtn.addEventListener("click", () => {
        window.open(`https://www.youtube.com/watch?v=${s.trailer_key}`, "_blank");
      });
    }
    const editBtn = actions.createEl("button", { text: "✎ Edit", cls: "movie-detail-edit-btn" });
    editBtn.addEventListener("click", () => this.renderEdit());

    const deleteBtn = actions.createEl("button", { text: "🗑 Delete", cls: "movie-detail-delete" });
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`Delete "${s.name}" from your TV library?`)) {
        await this.plugin.removeShow(s.id);
        this.close();
      }
    });

    const similarSection = contentEl.createDiv({ cls: "movie-detail-similar-section" });
    similarSection.createEl("h3", { text: "Similar Shows", cls: "movie-detail-section-title" });
    const similarList = similarSection.createDiv({ cls: "movie-detail-similar-list" });

    if (this._similarResults) {
      this.populateSimilar(similarList, this._similarResults);
    } else {
      similarList.createDiv({ cls: "movie-detail-similar-loading", text: "Loading similar shows..." });
      this.plugin.fetchSimilarShows(s.id).then((results) => {
        this._similarResults = results;
        if (document.body.contains(similarList)) {
          this.populateSimilar(similarList, results);
        }
      });
    }
  }

  async populateSimilar(container, results) {
    container.empty();
    if (!results.length) {
      container.createDiv({ cls: "movie-detail-similar-empty", text: "No similar shows found." });
      return;
    }

    const libraryShows = await this.plugin.readShows();
    const libraryIds = new Set(libraryShows.map((sv) => sv.id));

    for (const sm of results) {
      const card = container.createDiv({ cls: "movie-detail-similar-card" });
      const posterWrap = card.createDiv({ cls: "movie-detail-similar-poster-wrap" });
      const posterUrl = sm.poster_path ? `${POSTER_BASE}${sm.poster_path}` : "";
      posterWrap.createEl("img", { attr: { src: posterUrl, alt: sm.name, loading: "lazy" } });
      const year = (sm.first_air_date || "????").slice(0, 4);

      if (libraryIds.has(sm.id)) {
        posterWrap.createDiv({ cls: "movie-detail-similar-badge is-added", text: "✓" });
      } else {
        const addBadge = posterWrap.createDiv({ cls: "movie-detail-similar-badge", text: "+" });
        addBadge.setAttribute("aria-label", "Add to library");
        addBadge.addEventListener("click", async (e) => {
          e.stopPropagation();
          addBadge.setText("…");
          const details = await this.plugin.fetchShowDetails(sm.id, {
            name: sm.name,
            year,
            poster_path: sm.poster_path,
            rating: (sm.vote_average || 0).toFixed(1),
          });
          await this.plugin.addShow(details);
          addBadge.setText("✓");
          addBadge.addClass("is-added");
        });
      }

      card.createDiv({ cls: "movie-detail-similar-title", text: `${sm.name} (${year})` });
    }
  }

  renderEdit() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("movie-detail-modal");
    contentEl.addClass("movie-add-modal");
    const s = this.show;

    contentEl.createEl("h2", { text: `Edit ${s.name}` });

    const form = contentEl.createDiv({ cls: "movie-add-form" });
    const makeRow = (full) => makeFormRow(form, full);

    const addField = (parent, label, key, opts = {}) => {
      const value = opts.getValue ? opts.getValue() : s[key] ?? "";
      return addFormField(parent, label, {
        ...opts,
        value,
        onChange: (v) => {
          if (opts.onInput) opts.onInput(v);
          else s[key] = v;
        },
      });
    };

    const r1 = makeRow();
    addField(r1, "Name", "name");
    addField(r1, "Year", "year");

    const r2 = makeRow();
    addField(r2, "TMDB / IMDb Rating", "rating");
    addField(r2, "Poster URL", "custom_poster_url", { placeholder: "Poster URL" });

    const r3 = makeRow();
    addField(r3, "First Air Date", "first_air_date", { type: "date" });
    addField(r3, "Episode Runtime (min)", "episode_runtime", {
      getValue: () => (s.episode_runtime ? String(s.episode_runtime) : ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        s.episode_runtime = isNaN(n) ? null : n;
      },
    });

    const r3b = makeRow();
    addField(r3b, "Seasons", "number_of_seasons", {
      getValue: () => (s.number_of_seasons ? String(s.number_of_seasons) : ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        s.number_of_seasons = isNaN(n) ? null : n;
      },
    });
    addField(r3b, "Episodes", "number_of_episodes", {
      getValue: () => (s.number_of_episodes ? String(s.number_of_episodes) : ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        s.number_of_episodes = isNaN(n) ? null : n;
      },
    });

    const r3c = makeRow();
    addField(r3c, "Episodes Watched", "episodesWatched", {
      getValue: () => (s.episodesWatched ? String(s.episodesWatched) : ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        s.episodesWatched = isNaN(n) ? 0 : n;
      },
    });
    addField(r3c, "Language code", "original_language", { placeholder: "e.g. en" });

    const r4 = makeRow();
    addField(r4, "Series Status", "show_status", { placeholder: "e.g. Ended, Returning Series" });
    addField(r4, "Creator", "creators");

    const r5 = makeRow();
    addField(r5, "Genres", "genres", { placeholder: "Comma-separated" });
    addField(r5, "Cast", "cast", { placeholder: "Comma-separated" });

    addField(makeRow(true), "Trailer URL", "trailer_key", {
      placeholder: "https://www.youtube.com/watch?v=...",
      getValue: () => (s.trailer_key ? `https://www.youtube.com/watch?v=${s.trailer_key}` : ""),
      onInput: (v) => {
        const match = v.match(/(?:v=|youtu\.be\/)([\w-]{6,})/);
        s.trailer_key = match ? match[1] : v.trim();
      },
    });

    addField(makeRow(true), "Overview", "overview", { type: "textarea" });
    addField(makeRow(true), "Notes", "notes", { type: "textarea", placeholder: "Personal notes..." });

    const actions = contentEl.createDiv({ cls: "movie-add-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "movie-add-cancel" });
    cancelBtn.addEventListener("click", () => this.renderView());

    const saveBtn = actions.createEl("button", { text: "Save Changes", cls: "movie-add-save" });
    saveBtn.addEventListener("click", async () => {
      await this.plugin.updateShow(s);
      this.renderView();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class GallerySettingsModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("movie-gallery-settings-modal");
    contentEl.createEl("h2", { text: "Gallery Settings" });

    contentEl.createEl("h3", { text: "Show on Cards", cls: "movie-gallery-settings-section-title" });
    const fieldsWrap = contentEl.createDiv({ cls: "movie-gallery-settings-toggles" });

    const fieldLabels = [
      ["title", "Title"],
      ["year", "Year"],
      ["rating", "Rating"],
      ["genres", "Genres"],
      ["director", "Director"],
      ["cast", "Cast"],
      ["status", "Status"],
      ["release_date", "Release Date"],
      ["runtime", "Runtime"],
      ["language", "Language"],
      ["budget", "Budget"],
      ["myRating", "My Rating"],
      ["overview", "Overview"],
      ["notes", "Notes"],
    ];

    fieldLabels.forEach(([key, label]) => {
      const item = fieldsWrap.createEl("label", { cls: "movie-gallery-checkbox-item" });
      item.createSpan({ cls: "movie-gallery-checkbox-label", text: label });
      const checkbox = item.createEl("input", { type: "checkbox" });
      checkbox.checked = !!this.plugin.settings.cardFields[key];
      checkbox.addEventListener("change", async () => {
        this.plugin.settings.cardFields[key] = checkbox.checked;
        await this.plugin.saveSettings();
        this.plugin.refreshGalleries();
      });
    });

    contentEl.createDiv({ cls: "movie-gallery-settings-divider" });
    contentEl.createEl("h3", { text: "Gallery Layout", cls: "movie-gallery-settings-section-title" });
    const layoutWrap = contentEl.createDiv({ cls: "movie-gallery-settings-rows" });

    const layoutRow = (labelText, createControl) => {
      const row = layoutWrap.createDiv({ cls: "movie-gallery-settings-row" });
      row.createDiv({ cls: "movie-gallery-settings-row-label", text: labelText });
      const controlWrap = row.createDiv({ cls: "movie-gallery-settings-row-control" });
      createControl(controlWrap);
    };

    layoutRow("Movies per row", (wrap) => {
      const drop = wrap.createEl("select", { cls: "movie-gallery-settings-select" });
      ["auto", "2", "3", "4", "5", "6", "7", "8"].forEach((v) => {
        const opt = drop.createEl("option", { text: v === "auto" ? "Auto" : v, attr: { value: v } });
        if (String(this.plugin.settings.cardsPerRow) === v) opt.selected = true;
      });
      drop.addEventListener("change", async () => {
        this.plugin.settings.cardsPerRow = drop.value;
        await this.plugin.saveSettings();
        this.plugin.refreshGalleries();
      });
    });

    layoutRow("Card size", (wrap) => {
      const drop = wrap.createEl("select", { cls: "movie-gallery-settings-select" });
      [
        ["small", "Small"],
        ["medium", "Medium"],
        ["large", "Large"],
      ].forEach(([value, text]) => {
        const opt = drop.createEl("option", { text, attr: { value } });
        if (this.plugin.settings.cardSize === value) opt.selected = true;
      });
      drop.addEventListener("change", async () => {
        this.plugin.settings.cardSize = drop.value;
        await this.plugin.saveSettings();
        this.plugin.refreshGalleries();
      });
    });

    contentEl.createDiv({ cls: "movie-gallery-settings-divider" });
    contentEl.createEl("h3", { text: "Database", cls: "movie-gallery-settings-section-title" });
    contentEl.createEl("p", {
      cls: "movie-gallery-settings-desc",
      text: "Refresh information for movies linked to a movie API. Your status, notes and personal ratings will be preserved.",
    });

    const updateBtn = contentEl.createEl("button", { text: "Update Database", cls: "movie-gallery-update-btn" });
    const progressEl = contentEl.createDiv({ cls: "movie-gallery-settings-progress" });

    updateBtn.addEventListener("click", async () => {
      if (!this.plugin.settings.tmdbApiKey) {
        progressEl.setText("Set your TMDB API key first.");
        return;
      }
      updateBtn.disabled = true;
      updateBtn.setText("Updating...");
      const updated = await this.plugin.refreshAllMovies((done, total) => {
        progressEl.setText(`Updating ${done} / ${total}...`);
      });
      updateBtn.setText("Update Database");
      updateBtn.disabled = false;
      progressEl.setText(`Done — updated ${updated} movie${updated === 1 ? "" : "s"}.`);
    });

    const backupRow = contentEl.createDiv({ cls: "movie-gallery-backup-row" });
    const backupBtn = backupRow.createEl("button", { text: "Backup Movie List", cls: "movie-gallery-update-btn" });
    const backupFormat = backupRow.createEl("select", { cls: "movie-gallery-backup-format" });
    backupFormat.createEl("option", { text: ".txt", attr: { value: "txt" } });
    backupFormat.createEl("option", { text: ".csv", attr: { value: "csv" } });

    backupBtn.addEventListener("click", async () => {
      backupBtn.disabled = true;
      backupBtn.setText("Backing up...");
      const path = await this.plugin.backupMovies(backupFormat.value);
      backupBtn.disabled = false;
      backupBtn.setText("Backup Movie List");
      progressEl.setText(path ? `Backup saved to ${path}` : "Backup cancelled.");
    });

    const importRow = contentEl.createDiv({ cls: "movie-gallery-backup-row" });
    const importBtn = importRow.createEl("button", { text: "Import (.csv)", cls: "movie-gallery-update-btn" });
    const importInput = importRow.createEl("input", {
      type: "file",
      attr: { accept: ".csv", style: "display:none" },
    });
    contentEl.createEl("p", {
      cls: "movie-gallery-settings-desc",
      text: "Supports this plugin's own backup, plus Letterboxd and IMDb exports (TV entries in an IMDb file are skipped automatically).",
    });

    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      const file = importInput.files[0];
      if (!file) return;
      importBtn.disabled = true;
      importBtn.setText("Importing...");
      const text = await file.text();
      const { imported, skipped, failed, format, error } = await this.plugin.importMovies(
        text,
        file.name,
        (done, total) => progressEl.setText(`Importing... ${done} / ${total}`)
      );
      importBtn.disabled = false;
      importBtn.setText("Import (.csv)");
      importInput.value = "";

      if (error === "no_api_key") {
        progressEl.setText("Set your TMDB API key first — needed to match Letterboxd/IMDb entries.");
        return;
      }
      const formatLabel = { letterboxd: "Letterboxd", imdb: "IMDb", native: "backup" }[format] || format;
      const parts = [`Imported ${imported} (${formatLabel} format)`];
      if (skipped) parts.push(`${skipped} already in library or not a movie title`);
      if (failed) parts.push(`${failed} couldn't be matched`);
      progressEl.setText(parts.join(", ") + ".");
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class TvGallerySettingsModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("movie-gallery-settings-modal");
    contentEl.createEl("h2", { text: "TV Gallery Settings" });

    contentEl.createEl("h3", { text: "Show on Cards", cls: "movie-gallery-settings-section-title" });
    const fieldsWrap = contentEl.createDiv({ cls: "movie-gallery-settings-toggles" });

    const fieldLabels = [
      ["title", "Title"],
      ["year", "Year"],
      ["rating", "Rating"],
      ["genres", "Genres"],
      ["director", "Creator"],
      ["cast", "Cast"],
      ["status", "Status"],
      ["release_date", "First Air Date"],
      ["runtime", "Episode Runtime"],
      ["language", "Language"],
      ["seasons", "Seasons"],
      ["episodes", "Episodes"],
      ["myRating", "My Rating"],
      ["overview", "Overview"],
      ["notes", "Notes"],
    ];

    fieldLabels.forEach(([key, label]) => {
      const item = fieldsWrap.createEl("label", { cls: "movie-gallery-checkbox-item" });
      item.createSpan({ cls: "movie-gallery-checkbox-label", text: label });
      const checkbox = item.createEl("input", { type: "checkbox" });
      checkbox.checked = !!this.plugin.settings.tvCardFields[key];
      checkbox.addEventListener("change", async () => {
        this.plugin.settings.tvCardFields[key] = checkbox.checked;
        await this.plugin.saveSettings();
        this.plugin.refreshGalleries();
      });
    });

    contentEl.createDiv({ cls: "movie-gallery-settings-divider" });
    contentEl.createEl("h3", { text: "Gallery Layout", cls: "movie-gallery-settings-section-title" });
    const layoutWrap = contentEl.createDiv({ cls: "movie-gallery-settings-rows" });

    const layoutRow = (labelText, createControl) => {
      const row = layoutWrap.createDiv({ cls: "movie-gallery-settings-row" });
      row.createDiv({ cls: "movie-gallery-settings-row-label", text: labelText });
      const controlWrap = row.createDiv({ cls: "movie-gallery-settings-row-control" });
      createControl(controlWrap);
    };

    layoutRow("Shows per row", (wrap) => {
      const drop = wrap.createEl("select", { cls: "movie-gallery-settings-select" });
      ["auto", "2", "3", "4", "5", "6", "7", "8"].forEach((v) => {
        const opt = drop.createEl("option", { text: v === "auto" ? "Auto" : v, attr: { value: v } });
        if (String(this.plugin.settings.tvCardsPerRow) === v) opt.selected = true;
      });
      drop.addEventListener("change", async () => {
        this.plugin.settings.tvCardsPerRow = drop.value;
        await this.plugin.saveSettings();
        this.plugin.refreshGalleries();
      });
    });

    layoutRow("Card size", (wrap) => {
      const drop = wrap.createEl("select", { cls: "movie-gallery-settings-select" });
      [
        ["small", "Small"],
        ["medium", "Medium"],
        ["large", "Large"],
      ].forEach(([value, text]) => {
        const opt = drop.createEl("option", { text, attr: { value } });
        if (this.plugin.settings.tvCardSize === value) opt.selected = true;
      });
      drop.addEventListener("change", async () => {
        this.plugin.settings.tvCardSize = drop.value;
        await this.plugin.saveSettings();
        this.plugin.refreshGalleries();
      });
    });

    contentEl.createDiv({ cls: "movie-gallery-settings-divider" });
    contentEl.createEl("h3", { text: "Database", cls: "movie-gallery-settings-section-title" });
    contentEl.createEl("p", {
      cls: "movie-gallery-settings-desc",
      text: "Refresh information for shows linked to a TV API. Your status, notes and personal ratings will be preserved.",
    });

    const updateBtn = contentEl.createEl("button", { text: "Update Database", cls: "movie-gallery-update-btn" });
    const progressEl = contentEl.createDiv({ cls: "movie-gallery-settings-progress" });

    updateBtn.addEventListener("click", async () => {
      if (!this.plugin.settings.tmdbApiKey) {
        progressEl.setText("Set your TMDB API key first.");
        return;
      }
      updateBtn.disabled = true;
      updateBtn.setText("Updating...");
      const updated = await this.plugin.refreshAllShows((done, total) => {
        progressEl.setText(`Updating ${done} / ${total}...`);
      });
      updateBtn.setText("Update Database");
      updateBtn.disabled = false;
      progressEl.setText(`Done — updated ${updated} show${updated === 1 ? "" : "s"}.`);
    });

    const backupRow = contentEl.createDiv({ cls: "movie-gallery-backup-row" });
    const backupBtn = backupRow.createEl("button", { text: "Backup Show List", cls: "movie-gallery-update-btn" });
    const backupFormat = backupRow.createEl("select", { cls: "movie-gallery-backup-format" });
    backupFormat.createEl("option", { text: ".txt", attr: { value: "txt" } });
    backupFormat.createEl("option", { text: ".csv", attr: { value: "csv" } });

    backupBtn.addEventListener("click", async () => {
      backupBtn.disabled = true;
      backupBtn.setText("Backing up...");
      const path = await this.plugin.backupShows(backupFormat.value);
      backupBtn.disabled = false;
      backupBtn.setText("Backup Show List");
      progressEl.setText(path ? `Backup saved to ${path}` : "Backup cancelled.");
    });

    const importRow = contentEl.createDiv({ cls: "movie-gallery-backup-row" });
    const importBtn = importRow.createEl("button", { text: "Import (.csv)", cls: "movie-gallery-update-btn" });
    const importInput = importRow.createEl("input", {
      type: "file",
      attr: { accept: ".csv", style: "display:none" },
    });
    contentEl.createEl("p", {
      cls: "movie-gallery-settings-desc",
      text: "Supports this plugin's own backup, plus TV entries from an IMDb export (movies in the same file are skipped automatically).",
    });

    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async () => {
      const file = importInput.files[0];
      if (!file) return;
      importBtn.disabled = true;
      importBtn.setText("Importing...");
      const text = await file.text();
      const { imported, skipped, failed, format, error } = await this.plugin.importShows(
        text,
        file.name,
        (done, total) => progressEl.setText(`Importing... ${done} / ${total}`)
      );
      importBtn.disabled = false;
      importBtn.setText("Import (.csv)");
      importInput.value = "";

      if (error === "no_api_key") {
        progressEl.setText("Set your TMDB API key first — needed to match IMDb entries.");
        return;
      }
      if (error === "unsupported") {
        progressEl.setText("Letterboxd doesn't track TV shows, so that export can't be used here.");
        return;
      }
      const formatLabel = { imdb: "IMDb", native: "backup" }[format] || format;
      const parts = [`Imported ${imported} (${formatLabel} format)`];
      if (skipped) parts.push(`${skipped} already in library or not a TV title`);
      if (failed) parts.push(`${failed} couldn't be matched`);
      progressEl.setText(parts.join(", ") + ".");
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class StatsModal extends Modal {
  constructor(app, plugin, galleryEl) {
    super(app);
    this.plugin = plugin;
    this.galleryEl = galleryEl;
  }

  jumpToSearch(query) {
    const state = this.plugin.galleryStates.get(this.galleryEl);
    if (state) {
      state.search = query;
      this.plugin.renderGallery(this.galleryEl);
    }
    this.close();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass("movie-gallery-stats-modal");
    contentEl.createEl("h2", { text: "Library Stats" });

    const stats = await this.plugin.computeStats();

    if (!stats.total) {
      contentEl.createEl("p", {
        cls: "movie-gallery-settings-desc",
        text: "Add some movies and your stats will show up here.",
      });
      return;
    }

    const banner = contentEl.createDiv({ cls: "movie-stats-banner movie-stats-banner-hero" });
    banner.createDiv({ cls: "movie-stats-banner-emoji", text: stats.badge.emoji });
    banner.createDiv({ cls: "movie-stats-banner-value", text: this.plugin.formatWatchTime(stats.totalMinutes) });
    banner.createDiv({ cls: "movie-stats-banner-label", text: "Total Watch Time" });
    banner.createDiv({ cls: "movie-stats-banner-badge", text: stats.badge.title });
    banner.createDiv({ cls: "movie-stats-banner-quip", text: stats.badge.quip });

    const cardsCol = contentEl.createDiv({ cls: "movie-stats-cards" });
    const statCard = (value, label) => {
      const card = cardsCol.createDiv({ cls: "movie-stats-card" });
      card.createDiv({ cls: "movie-stats-value", text: String(value) });
      card.createDiv({ cls: "movie-stats-label", text: label });
    };
    statCard(stats.total, "Total Movies");
    statCard(stats.watchedCount, "Watched");
    statCard(stats.toWatchCount, "To Watch");

    if (stats.avgMyRating) {
      const ratingCard = contentEl.createDiv({ cls: "movie-stats-rating-card" });
      const ratingTop = ratingCard.createDiv({ cls: "movie-stats-rating-card-top" });
      ratingTop.createDiv({ cls: "movie-stats-rating-card-star", text: "★" });

      const ratingText = ratingTop.createDiv({ cls: "movie-stats-rating-card-text" });
      ratingText.createDiv({ cls: "movie-stats-rating-card-value", text: `${stats.avgMyRating} / 10` });
      ratingText.createDiv({ cls: "movie-stats-rating-card-label", text: "Average of Your Ratings" });

      const ratedMovies = (await this.plugin.readMovies())
        .filter((m) => m.myRating !== "" && m.myRating != null)
        .map((m) => parseFloat(m.myRating));
      const trendSvg = this.plugin.buildRatingTrendSvg(ratedMovies);
      if (trendSvg) {
        const trendWrap = ratingCard.createDiv({ cls: "movie-stats-rating-trend" });
        trendWrap.innerHTML = trendSvg;
      }
    }

    const breakdownRow = contentEl.createDiv({ cls: "movie-stats-breakdown-row" });

    const makeDonutCol = (title, centerText, centerLabel, conicStops, legendItems) => {
      const col = breakdownRow.createDiv({ cls: "movie-stats-breakdown-col" });
      col.createDiv({ cls: "movie-stats-breakdown-title", text: title });
      const donut = col.createDiv({ cls: "movie-stats-donut movie-stats-donut-sm" });
      donut.style.background = `conic-gradient(${conicStops})`;
      const hole = donut.createDiv({ cls: "movie-stats-donut-hole movie-stats-donut-hole-sm" });
      hole.createDiv({ cls: "movie-stats-donut-total", text: centerText });
      hole.createDiv({ cls: "movie-stats-donut-total-label", text: centerLabel });
      const legend = col.createDiv({ cls: "movie-stats-mini-legend" });
      legendItems.forEach(([color, label]) => {
        const chip = legend.createDiv({ cls: "movie-stats-mini-legend-item" });
        const dot = chip.createDiv({ cls: "movie-stats-mini-legend-dot" });
        dot.style.background = color;
        chip.createSpan({ text: label });
      });
      return col;
    };

    if (stats.total > 0) {
      const watchedPct = Math.round((stats.watchedCount / stats.total) * 100);
      makeDonutCol(
        "Watched",
        `${watchedPct}%`,
        "watched",
        `var(--mg-success) 0% ${watchedPct}%, rgba(255,255,255,0.1) ${watchedPct}% 100%`,
        [
          ["var(--mg-success)", `Watched (${stats.watchedCount})`],
          ["rgba(255,255,255,0.25)", `To Watch (${stats.toWatchCount})`],
        ]
      );
    }

    if (stats.topGenres.length) {
      const genreCol = breakdownRow.createDiv({ cls: "movie-stats-breakdown-col movie-stats-genre-col" });
      genreCol.createDiv({ cls: "movie-stats-breakdown-title", text: "Genre Breakdown" });
      this.renderGenrePie(genreCol, stats.topGenres);
    }

    if (stats.topYear || stats.topDirector || stats.topCast) {
      contentEl.createEl("h3", { text: "Viewing Habits", cls: "movie-gallery-settings-section-title" });
      contentEl.createEl("p", {
        cls: "movie-gallery-settings-desc",
        text: "Tap a tile to see those movies in your library.",
      });
      const habitsGrid = contentEl.createDiv({ cls: "movie-stats-habits-grid" });

      const habitTile = (emoji, label, value, count, query) => {
        if (!value) return;
        const tile = habitsGrid.createDiv({ cls: "movie-stats-habit-tile" });
        tile.createDiv({ cls: "movie-stats-habit-emoji", text: emoji });
        tile.createDiv({ cls: "movie-stats-habit-value", text: value });
        tile.createDiv({ cls: "movie-stats-habit-label", text: `${label} · ${count}x` });
        if (this.galleryEl && query) {
          tile.addClass("is-clickable");
          tile.addEventListener("click", () => this.jumpToSearch(query));
        }
      };

      habitTile("📅", "Favorite Year", stats.topYear?.[0], stats.topYear?.[1], null);
      habitTile("🎥", "Top Director", stats.topDirector?.[0], stats.topDirector?.[1], stats.topDirector?.[0]);
      habitTile("⭐", "Most-Seen Actor", stats.topCast?.[0], stats.topCast?.[1], stats.topCast?.[0]);
    }
  }

  renderGenrePie(container, topGenres) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svgEl = (tag, attrs = {}) => {
      const el = document.createElementNS(svgNS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };

    const colors = ["#3b82f6", "#8b5cf6", "#eab308", "#4caf50", "#e0555f", "#f97316"];
    const total = topGenres.reduce((sum, [, count]) => sum + count, 0);
    const cx = 120;
    const cy = 90;
    const outerR = 40;
    const ringR = 33;
    const ringWidth = 13;
    const circumference = 2 * Math.PI * ringR;

    const wrap = container.createDiv({ cls: "movie-stats-pie-wrap" });
    const svg = svgEl("svg", { viewBox: "0 0 240 180", width: "100%", height: "170" });

    let offset = 0;
    topGenres.forEach(([, count], i) => {
      const pct = count / total;
      const dash = pct * circumference;
      const circle = svgEl("circle", {
        cx, cy, r: ringR,
        fill: "none",
        stroke: colors[i % colors.length],
        "stroke-width": ringWidth,
        "stroke-dasharray": `${dash} ${circumference - dash}`,
        "stroke-dashoffset": String(-offset),
        transform: `rotate(-90 ${cx} ${cy})`,
      });
      svg.appendChild(circle);
      offset += dash;
    });

    let acc = 0;
    topGenres.forEach(([genre, count], i) => {
      const midPct = (acc + count / 2) / total;
      acc += count;
      const angle = -90 + midPct * 360;
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const x1 = cx + outerR * cos;
      const y1 = cy + outerR * sin;
      const x2 = cx + (outerR + 14) * cos;
      const y2 = cy + (outerR + 14) * sin;
      const labelX = cx + (outerR + 18) * cos;
      const labelY = cy + (outerR + 18) * sin;
      const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";

      svg.appendChild(
        svgEl("line", { x1, y1, x2, y2, stroke: colors[i % colors.length], "stroke-width": "1.5" })
      );
      const text = svgEl("text", {
        x: labelX,
        y: labelY,
        fill: "#ccc",
        "font-size": "8.5",
        "text-anchor": anchor,
        "dominant-baseline": "middle",
      });
      text.textContent = `${genre} (${count})`;
      svg.appendChild(text);
    });

    const centerText = svgEl("text", {
      x: cx, y: cy - 4, fill: "#fff", "font-size": "15", "font-weight": "700", "text-anchor": "middle",
    });
    centerText.textContent = String(total);
    svg.appendChild(centerText);

    const centerLabel = svgEl("text", {
      x: cx, y: cy + 11, fill: "rgba(255,255,255,0.55)", "font-size": "8", "text-anchor": "middle",
    });
    centerLabel.textContent = "tagged";
    svg.appendChild(centerLabel);

    wrap.appendChild(svg);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class TvStatsModal extends Modal {
  constructor(app, plugin, galleryEl) {
    super(app);
    this.plugin = plugin;
    this.galleryEl = galleryEl;
  }

  jumpToSearch(query) {
    const state = this.plugin.tvGalleryStates.get(this.galleryEl);
    if (state) {
      state.search = query;
      this.plugin.renderGallery(this.galleryEl);
    }
    this.close();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass("movie-gallery-stats-modal");
    contentEl.createEl("h2", { text: "TV Stats" });

    const stats = await this.plugin.computeShowStats();

    if (!stats.total) {
      contentEl.createEl("p", {
        cls: "movie-gallery-settings-desc",
        text: "Add some TV shows and your stats will show up here.",
      });
      return;
    }

    const banner = contentEl.createDiv({ cls: "movie-stats-banner movie-stats-banner-hero" });
    banner.createDiv({ cls: "movie-stats-banner-emoji", text: stats.badge.emoji });
    banner.createDiv({ cls: "movie-stats-banner-value", text: this.plugin.formatWatchTime(stats.totalMinutes) });
    banner.createDiv({ cls: "movie-stats-banner-label", text: "Total Watch Time" });
    banner.createDiv({ cls: "movie-stats-banner-badge", text: stats.badge.title });
    banner.createDiv({ cls: "movie-stats-banner-quip", text: stats.badge.quip });

    const cardsCol = contentEl.createDiv({ cls: "movie-stats-cards" });
    const statCard = (value, label) => {
      const card = cardsCol.createDiv({ cls: "movie-stats-card" });
      card.createDiv({ cls: "movie-stats-value", text: String(value) });
      card.createDiv({ cls: "movie-stats-label", text: label });
    };
    statCard(stats.total, "Total Shows");
    statCard(stats.watchedCount, "Watched");
    statCard(stats.toWatchCount, "To Watch");

    if (stats.avgMyRating) {
      const ratingCard = contentEl.createDiv({ cls: "movie-stats-rating-card" });
      const ratingTop = ratingCard.createDiv({ cls: "movie-stats-rating-card-top" });
      ratingTop.createDiv({ cls: "movie-stats-rating-card-star", text: "★" });

      const ratingText = ratingTop.createDiv({ cls: "movie-stats-rating-card-text" });
      ratingText.createDiv({ cls: "movie-stats-rating-card-value", text: `${stats.avgMyRating} / 10` });
      ratingText.createDiv({ cls: "movie-stats-rating-card-label", text: "Average of Your Ratings" });

      const ratedShows = (await this.plugin.readShows())
        .filter((s) => s.myRating !== "" && s.myRating != null)
        .map((s) => parseFloat(s.myRating));
      const trendSvg = this.plugin.buildRatingTrendSvg(ratedShows);
      if (trendSvg) {
        const trendWrap = ratingCard.createDiv({ cls: "movie-stats-rating-trend" });
        trendWrap.innerHTML = trendSvg;
      }
    }

    const breakdownRow = contentEl.createDiv({ cls: "movie-stats-breakdown-row" });

    const makeDonutCol = (title, centerText, centerLabel, conicStops, legendItems) => {
      const col = breakdownRow.createDiv({ cls: "movie-stats-breakdown-col" });
      col.createDiv({ cls: "movie-stats-breakdown-title", text: title });
      const donut = col.createDiv({ cls: "movie-stats-donut movie-stats-donut-sm" });
      donut.style.background = `conic-gradient(${conicStops})`;
      const hole = donut.createDiv({ cls: "movie-stats-donut-hole movie-stats-donut-hole-sm" });
      hole.createDiv({ cls: "movie-stats-donut-total", text: centerText });
      hole.createDiv({ cls: "movie-stats-donut-total-label", text: centerLabel });
      const legend = col.createDiv({ cls: "movie-stats-mini-legend" });
      legendItems.forEach(([color, label]) => {
        const chip = legend.createDiv({ cls: "movie-stats-mini-legend-item" });
        const dot = chip.createDiv({ cls: "movie-stats-mini-legend-dot" });
        dot.style.background = color;
        chip.createSpan({ text: label });
      });
      return col;
    };

    if (stats.total > 0) {
      const watchedPct = Math.round((stats.watchedCount / stats.total) * 100);
      makeDonutCol(
        "Watched",
        `${watchedPct}%`,
        "watched",
        `var(--mg-success) 0% ${watchedPct}%, rgba(255,255,255,0.1) ${watchedPct}% 100%`,
        [
          ["var(--mg-success)", `Watched (${stats.watchedCount})`],
          ["rgba(255,255,255,0.25)", `To Watch (${stats.toWatchCount})`],
        ]
      );
    }

    if (stats.topGenres.length) {
      const genreCol = breakdownRow.createDiv({ cls: "movie-stats-breakdown-col movie-stats-genre-col" });
      genreCol.createDiv({ cls: "movie-stats-breakdown-title", text: "Genre Breakdown" });
      this.renderGenrePie(genreCol, stats.topGenres);
    }

    if (stats.topYear || stats.topDirector || stats.topCast) {
      contentEl.createEl("h3", { text: "Viewing Habits", cls: "movie-gallery-settings-section-title" });
      contentEl.createEl("p", {
        cls: "movie-gallery-settings-desc",
        text: "Tap a tile to see those shows in your library.",
      });
      const habitsGrid = contentEl.createDiv({ cls: "movie-stats-habits-grid" });

      const habitTile = (emoji, label, value, count, query) => {
        if (!value) return;
        const tile = habitsGrid.createDiv({ cls: "movie-stats-habit-tile" });
        tile.createDiv({ cls: "movie-stats-habit-emoji", text: emoji });
        tile.createDiv({ cls: "movie-stats-habit-value", text: value });
        tile.createDiv({ cls: "movie-stats-habit-label", text: `${label} · ${count}x` });
        if (this.galleryEl && query) {
          tile.addClass("is-clickable");
          tile.addEventListener("click", () => this.jumpToSearch(query));
        }
      };

      habitTile("📅", "Favorite Year", stats.topYear?.[0], stats.topYear?.[1], null);
      habitTile("🎥", "Top Creator", stats.topDirector?.[0], stats.topDirector?.[1], stats.topDirector?.[0]);
      habitTile("⭐", "Most-Seen Actor", stats.topCast?.[0], stats.topCast?.[1], stats.topCast?.[0]);
    }
  }

  renderGenrePie(container, topGenres) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svgEl = (tag, attrs = {}) => {
      const el = document.createElementNS(svgNS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      return el;
    };

    const colors = ["#3b82f6", "#8b5cf6", "#eab308", "#4caf50", "#e0555f", "#f97316"];
    const total = topGenres.reduce((sum, [, count]) => sum + count, 0);
    const cx = 120;
    const cy = 90;
    const outerR = 40;
    const ringR = 33;
    const ringWidth = 13;
    const circumference = 2 * Math.PI * ringR;

    const wrap = container.createDiv({ cls: "movie-stats-pie-wrap" });
    const svg = svgEl("svg", { viewBox: "0 0 240 180", width: "100%", height: "170" });

    let offset = 0;
    topGenres.forEach(([, count], i) => {
      const pct = count / total;
      const dash = pct * circumference;
      const circle = svgEl("circle", {
        cx, cy, r: ringR,
        fill: "none",
        stroke: colors[i % colors.length],
        "stroke-width": ringWidth,
        "stroke-dasharray": `${dash} ${circumference - dash}`,
        "stroke-dashoffset": String(-offset),
        transform: `rotate(-90 ${cx} ${cy})`,
      });
      svg.appendChild(circle);
      offset += dash;
    });

    let acc = 0;
    topGenres.forEach(([genre, count], i) => {
      const midPct = (acc + count / 2) / total;
      acc += count;
      const angle = -90 + midPct * 360;
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const x1 = cx + outerR * cos;
      const y1 = cy + outerR * sin;
      const x2 = cx + (outerR + 14) * cos;
      const y2 = cy + (outerR + 14) * sin;
      const labelX = cx + (outerR + 18) * cos;
      const labelY = cy + (outerR + 18) * sin;
      const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";

      svg.appendChild(
        svgEl("line", { x1, y1, x2, y2, stroke: colors[i % colors.length], "stroke-width": "1.5" })
      );
      const text = svgEl("text", {
        x: labelX,
        y: labelY,
        fill: "#ccc",
        "font-size": "8.5",
        "text-anchor": anchor,
        "dominant-baseline": "middle",
      });
      text.textContent = `${genre} (${count})`;
      svg.appendChild(text);
    });

    const centerText = svgEl("text", {
      x: cx, y: cy - 4, fill: "#fff", "font-size": "15", "font-weight": "700", "text-anchor": "middle",
    });
    centerText.textContent = String(total);
    svg.appendChild(centerText);

    const centerLabel = svgEl("text", {
      x: cx, y: cy + 11, fill: "rgba(255,255,255,0.55)", "font-size": "8", "text-anchor": "middle",
    });
    centerLabel.textContent = "tagged";
    svg.appendChild(centerLabel);

    wrap.appendChild(svg);
  }

  onClose() {
    this.contentEl.empty();
  }
}

class MovieGallerySettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Movie Gallery Settings" });

    new Setting(containerEl)
      .setName("TMDB API key")
      .setDesc("Your API key from themoviedb.org")
      .addText((text) =>
        text
          .setPlaceholder("Paste your key")
          .setValue(this.plugin.settings.tmdbApiKey)
          .onChange(async (value) => {
            this.plugin.settings.tmdbApiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Data file")
      .setDesc("Single file (relative to vault root) where all movie data is stored, e.g. movies.json")
      .addText((text) =>
        text
          .setPlaceholder("movies.json")
          .setValue(this.plugin.settings.dataFile)
          .onChange(async (value) => {
            this.plugin.settings.dataFile = value.trim() || "movies.json";
            await this.plugin.saveSettings();
            this.plugin.refreshGalleries();
          })
      );
  }
}

module.exports = MovieGalleryPlugin;