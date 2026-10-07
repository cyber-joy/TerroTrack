const { Plugin, Modal, Setting, PluginSettingTab, requestUrl, Notice, Platform, Scope } = require("obsidian");

const DEFAULT_SETTINGS = {
  searchDirector: true,
  searchCast: true,
  tmdbApiKey: "",
  dataFile: "movies.json",
  tvDataFile: "tvshows.json",
  activityFile: "activity.json",
  cardFields: {
    favorite: true,
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
    favorite: true,
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

const STAR_POINTS =
  "12,2 14.59,8.36 21.51,9.27 16.45,14.14 17.77,20.9 12,17.6 6.23,20.9 7.55,14.14 2.49,9.27 9.41,8.36";

function buildStarRating(container, opts) {
  const currentVal = opts.value !== "" && opts.value != null ? parseInt(opts.value, 10) : 0;

  const wrap = container.createDiv({ cls: "movie-star-rating" });
  const row = wrap.createDiv({ cls: "movie-star-row" });

  const paintStars = (val) => {
    row.querySelectorAll(".movie-star-fill-clip").forEach((clip, idx) => {
      const i = idx + 1;
      let pct = 0;
      if (val >= i * 2) pct = 100;
      else if (val === i * 2 - 1) pct = 50;
      clip.style.width = pct + "%";
    });
  };

  for (let i = 1; i <= 5; i++) {
    const starEl = row.createDiv({ cls: "movie-star" });
    starEl.innerHTML =
      `<svg class="movie-star-bg-svg" viewBox="0 0 24 24"><polygon points="${STAR_POINTS}"/></svg>` +
      `<div class="movie-star-fill-clip"><svg class="movie-star-fg-svg" viewBox="0 0 24 24"><polygon points="${STAR_POINTS}"/></svg></div>`;

    const valueFromEvent = (evt) => {
      const rect = starEl.getBoundingClientRect();
      const isLeftHalf = evt.clientX - rect.left < rect.width / 2;
      return isLeftHalf ? i * 2 - 1 : i * 2;
    };

    starEl.addEventListener("mousemove", (evt) => {
      const v = valueFromEvent(evt);
      paintStars(v);
      showValue(v);
    });
    starEl.addEventListener("mouseleave", () => {
      paintStars(currentVal);
      showValue(null);
    });
    starEl.addEventListener("click", (evt) => {
      const clicked = valueFromEvent(evt);
      const newVal = clicked === currentVal ? "" : String(clicked);
      opts.onChange(newVal);
    });
  }

  paintStars(currentVal);

  // The number beside the stars follows the pointer, so you can read the rating before clicking.
  const valueEl = wrap.createSpan({
    cls: "movie-star-value",
    text: currentVal ? `${currentVal}/10` : "Not rated",
  });
  function showValue(v) {
    if (v === null) {
      valueEl.setText(currentVal ? `${currentVal}/10` : "Not rated");
      valueEl.removeClass("is-preview");
      return;
    }
    valueEl.setText(v === currentVal ? `${v}/10 · click to clear` : `${v}/10`);
    valueEl.addClass("is-preview");
  }

  return wrap;
}

function sortDirIcon(sortDir) {
  // Bars + arrow: ascending = short-to-long bars with an up arrow, descending = the reverse.
  const head = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  if (sortDir === "asc") {
    return head + '<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/></svg>';
  }
  return head + '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/></svg>';
}

const SETTINGS_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

const FILTER_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="4,4 20,4 14,12 14,19 10,21 10,12"/></svg>';

const STATS_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';

const SORT_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M6 12h12M10 18h4"/></svg>';

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

// ---------- Custom dropdown lists ----------
// Replaces the browser's native <select> popup (desktop only) with a styled list.
// The <select> itself stays in place, so values, styling and "change" handlers
// all keep working; only the popup is swapped.
const DD_CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function installCustomDropdowns(plugin) {
  if (Platform.isMobile) return; // phones keep their native pickers
  let cur = null;

  const inScope = (el) =>
    el instanceof HTMLSelectElement && !el.multiple && !el.disabled && !!el.closest('[class*="movie-"]');

  const close = () => {
    if (!cur) return;
    const { select, list, scope } = cur;
    cur = null;
    select.removeClass("mg-dd-open");
    list.remove();
    plugin.app.keymap.popScope(scope);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", close);
  };

  const onScroll = (e) => {
    if (cur && !cur.list.contains(e.target)) close();
  };

  const setActive = (i, scroll = true) => {
    if (!cur || !cur.items.length) return;
    const n = cur.items.length;
    cur.active = ((i % n) + n) % n;
    cur.items.forEach((it, idx) => it.el.toggleClass("is-active", idx === cur.active));
    if (scroll) cur.items[cur.active].el.scrollIntoView({ block: "nearest" });
  };

  const choose = (idx) => {
    if (!cur) return;
    const { select, items } = cur;
    const item = items[idx];
    if (!item || item.disabled) return;
    const changed = select.value !== item.value;
    select.value = item.value;
    close();
    select.focus();
    if (changed) {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  const open = (select) => {
    close();
    const list = document.body.createDiv({ cls: "mg-dd-list", attr: { role: "listbox" } });
    const items = [];
    const addOption = (opt, host) => {
      const el = host.createDiv({
        cls: "mg-dd-item" + (opt.selected ? " is-selected" : "") + (opt.disabled ? " is-disabled" : ""),
        attr: { role: "option", "aria-selected": String(!!opt.selected) },
      });
      el.createSpan({ cls: "mg-dd-label", text: opt.text });
      if (opt.selected) el.createSpan({ cls: "mg-dd-check" }).innerHTML = DD_CHECK_SVG;
      const idx = items.length;
      items.push({ el, value: opt.value, disabled: opt.disabled, text: opt.text });
      el.addEventListener("mousedown", (e) => e.preventDefault());
      el.addEventListener("mousemove", () => cur && cur.active !== idx && setActive(idx, false));
      el.addEventListener("click", () => choose(idx));
    };
    for (const child of Array.from(select.children)) {
      if (child.tagName === "OPTGROUP") {
        list.createDiv({ cls: "mg-dd-group", text: child.label });
        Array.from(child.children).forEach((o) => addOption(o, list));
      } else if (child.tagName === "OPTION") {
        addOption(child, list);
      }
    }

    // Position: below the field, flipping upward when there isn't room.
    const r = select.getBoundingClientRect();
    list.style.minWidth = `${Math.max(r.width, 140)}px`;
    list.style.visibility = "hidden";
    const spaceBelow = window.innerHeight - r.bottom - 10;
    const spaceAbove = r.top - 10;
    const natural = Math.min(list.scrollHeight, 320);
    const up = spaceBelow < natural && spaceAbove > spaceBelow;
    list.style.maxHeight = `${Math.max(120, Math.min(320, up ? spaceAbove : spaceBelow))}px`;
    const h = list.offsetHeight;
    const w = list.offsetWidth;
    list.style.top = `${up ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
    list.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
    list.addClass(up ? "is-up" : "is-down");
    list.style.visibility = "";

    const scope = new Scope();
    const act = (fn) => (e) => {
      fn();
      e.preventDefault();
      return false;
    };
    scope.register([], "Escape", act(close));
    scope.register([], "ArrowDown", act(() => setActive(cur.active + 1)));
    scope.register([], "ArrowUp", act(() => setActive(cur.active - 1)));
    scope.register([], "Home", act(() => setActive(0)));
    scope.register([], "End", act(() => setActive(cur.items.length - 1)));
    scope.register([], "Enter", act(() => choose(cur.active)));
    plugin.app.keymap.pushScope(scope);

    cur = { select, list, items, scope, active: 0, typed: "", typedAt: 0 };
    select.addClass("mg-dd-open");
    const sel = items.findIndex((it) => it.value === select.value);
    setActive(sel >= 0 ? sel : 0);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
  };

  plugin.registerDomEvent(
    document,
    "mousedown",
    (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (cur && t && cur.list.contains(t)) return;
      const sel = t ? t.closest("select") : null;
      if (cur) {
        const same = sel && sel === cur.select;
        close();
        if (same) {
          e.preventDefault();
          return;
        }
      }
      if (sel && e.button === 0 && inScope(sel)) {
        e.preventDefault(); // stop the native popup
        sel.focus();
        open(sel);
      }
    },
    true
  );

  plugin.registerDomEvent(
    document,
    "keydown",
    (e) => {
      if (cur) {
        if (e.key === "Tab") {
          close();
          return;
        }
        // Type-ahead: jump to the first entry starting with what was typed.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
          const now = Date.now();
          cur.typed = now - cur.typedAt > 700 ? e.key.toLowerCase() : cur.typed + e.key.toLowerCase();
          cur.typedAt = now;
          const start = cur.typed.length === 1 ? cur.active + 1 : cur.active;
          const n = cur.items.length;
          for (let k = 0; k < n; k++) {
            const i = (start + k) % n;
            if (cur.items[i].text.toLowerCase().startsWith(cur.typed)) {
              setActive(i);
              break;
            }
          }
          e.preventDefault();
          e.stopPropagation();
        } else if (e.key === " ") {
          choose(cur.active);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      const t = e.target;
      if (inScope(t) && (e.key === "Enter" || e.key === " " || (e.altKey && e.key === "ArrowDown"))) {
        e.preventDefault();
        e.stopPropagation();
        open(t);
      }
    },
    true
  );

  plugin.register(close);
}

// ---------- Discover (TMDB) ----------
const TMDB_GENRES = {
  movie: { Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80, Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, History: 36, Horror: 27, Music: 10402, Mystery: 9648, Romance: 10749, "Science Fiction": 878, "TV Movie": 10770, Thriller: 53, War: 10752, Western: 37 },
  tv: { "Action & Adventure": 10759, Animation: 16, Comedy: 35, Crime: 80, Documentary: 99, Drama: 18, Family: 10751, Kids: 10762, Mystery: 9648, News: 10763, Reality: 10764, "Sci-Fi & Fantasy": 10765, Soap: 10766, Talk: 10767, "War & Politics": 10768, Western: 37 },
};
const TMDB_GENRE_NAMES = {
  movie: Object.fromEntries(Object.entries(TMDB_GENRES.movie).map(([n, id]) => [id, n])),
  tv: Object.fromEntries(Object.entries(TMDB_GENRES.tv).map(([n, id]) => [id, n])),
};
const DISCOVER_TTL = 30 * 60 * 1000;

function discoverTitle(item, media) {
  return media === "movie" ? item.title : item.name;
}
function discoverDate(item, media) {
  return (media === "movie" ? item.release_date : item.first_air_date) || "";
}

// ---------- Activity heatmap (GitHub-style) ----------
const HM_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HM_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const HM_MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseDateKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function buildActivityHeatmap(container, plugin) {
  const real = plugin.activity || (plugin.activity = {});
  const view = { filter: "all", range: "year", offset: 0 };

  const root = container.createDiv({ cls: "movie-heatmap" });
  const draw = () => {
    root.empty();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const data = real;
    const valueOf = (key) => {
      const v = data[key];
      if (!v) return 0;
      return view.filter === "movie" ? v.m || 0 : view.filter === "tv" ? v.t || 0 : (v.m || 0) + (v.t || 0);
    };
    const keys = Object.keys(data).filter((k) => valueOf(k) > 0).sort();
    const earliest = keys.length ? parseDateKey(keys[0]) : today;

    // One colour scale for every view, so shades mean the same thing everywhere.
    // The top 5% are capped so a single marathon day doesn't wash everything out.
    const vals = keys.map(valueOf).sort((a, b) => a - b);
    const cap = vals.length ? Math.max(1, vals[Math.min(vals.length - 1, Math.floor(0.95 * vals.length))]) : 1;
    const level = (n) => (n <= 0 ? 0 : Math.min(4, Math.ceil((4 * n) / cap)));
    const fmtShort = (d) => `${HM_MONTHS[d.getMonth()]} ${d.getDate()}`;
    const fmtFull = (d) => `${HM_DAYS[d.getDay()]}, ${HM_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    // ---- the period being shown ----
    let start, end, navLabel, phrase;
    if (view.range === "week") {
      start = addDays(today, -today.getDay() - 7 * view.offset);
      end = addDays(start, 6);
      navLabel = `${fmtShort(start)} – ${fmtShort(end)}`;
      phrase = view.offset === 0 ? "this week" : view.offset === 1 ? "last week" : `the week of ${fmtShort(start)}`;
    } else if (view.range === "month") {
      start = new Date(today.getFullYear(), today.getMonth() - view.offset, 1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      navLabel = `${HM_MONTHS_FULL[start.getMonth()]} ${start.getFullYear()}`;
      phrase = view.offset === 0 ? "this month" : `in ${navLabel}`;
    } else if (view.range === "year") {
      if (view.offset === 0) {
        end = today;
        start = addDays(today, -364);
        navLabel = "Last 12 months";
        phrase = "in the last 12 months";
      } else {
        const yr = today.getFullYear() - view.offset;
        start = new Date(yr, 0, 1);
        end = new Date(yr, 11, 31);
        navLabel = String(yr);
        phrase = `in ${yr}`;
      }
    } else {
      start = new Date(earliest.getFullYear(), 0, 1);
      end = today;
      navLabel = "All time";
      phrase = "all time";
    }
    const effEnd = end > today ? today : end;

    // ---- numbers for the period ----
    let total = 0, active = 0, longest = 0, run = 0, busiest = null, span = 0;
    for (let d = start; d <= effEnd; d = addDays(d, 1)) {
      const n = valueOf(localDateKey(d));
      span++;
      total += n;
      if (n > 0) active++;
      run = n > 0 ? run + 1 : 0;
      longest = Math.max(longest, run);
      if (n > 0 && (!busiest || n > busiest.n)) busiest = { n, date: d };
    }
    let current = 0;
    let cd = new Date(today);
    if (valueOf(localDateKey(cd)) === 0) cd = addDays(cd, -1); // today may simply not be logged yet
    while (valueOf(localDateKey(cd)) > 0 && current < 5000) {
      current++;
      cd = addDays(cd, -1);
    }

    // ---- header: title + media filter ----
    const head = root.createDiv({ cls: "movie-heatmap-head" });
    const titles = head.createDiv({ cls: "movie-heatmap-titles" });
    titles.createDiv({ cls: "movie-heatmap-title", text: "Activity" });
    titles.createDiv({ cls: "movie-heatmap-sub", text: `${total} ${total === 1 ? "activity" : "activities"} ${phrase}` });
    const seg = head.createDiv({ cls: "movie-heatmap-seg", attr: { role: "radiogroup" } });
    [["all", "All"], ["movie", "Movies"], ["tv", "TV"]].forEach(([value, label]) => {
      const b = seg.createEl("button", { text: label, cls: "movie-heatmap-seg-btn" + (view.filter === value ? " selected" : ""), attr: { role: "radio" } });
      b.addEventListener("click", () => {
        view.filter = value;
        draw();
      });
    });

    // ---- period switch + navigation ----
    const bar = root.createDiv({ cls: "movie-heatmap-bar" });
    const ranges = bar.createDiv({ cls: "movie-heatmap-seg", attr: { role: "tablist" } });
    [["week", "Week"], ["month", "Month"], ["year", "Year"], ["all", "All time"]].forEach(([value, label]) => {
      const b = ranges.createEl("button", { text: label, cls: "movie-heatmap-seg-btn" + (view.range === value ? " selected" : ""), attr: { role: "tab" } });
      b.addEventListener("click", () => {
        view.range = value;
        view.offset = 0;
        draw();
      });
    });
    if (view.range !== "all") {
      const nav = bar.createDiv({ cls: "movie-heatmap-nav" });
      const prev = nav.createEl("button", { cls: "movie-heatmap-nav-btn", attr: { "aria-label": "Previous period" } });
      prev.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>';
      nav.createDiv({ cls: "movie-heatmap-nav-label", text: navLabel });
      const next = nav.createEl("button", { cls: "movie-heatmap-nav-btn", attr: { "aria-label": "Next period" } });
      next.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
      prev.disabled = !(start > earliest);
      next.disabled = view.offset === 0;
      prev.addEventListener("click", () => {
        view.offset++;
        draw();
      });
      next.addEventListener("click", () => {
        view.offset--;
        draw();
      });
    }

    // ---- shared tooltip ----
    const body = root.createDiv({ cls: "movie-heatmap-body" });
    const tip = root.createDiv({ cls: "movie-heatmap-tip" });
    const attachTip = (el, date, n) => {
      el.addEventListener("mouseenter", () => {
        tip.empty();
        tip.createEl("strong", { text: n ? `${n} ${n === 1 ? "activity" : "activities"}` : "No activity" });
        tip.createSpan({ text: ` · ${fmtFull(date)}` });
        const cr = el.getBoundingClientRect();
        const rr = root.getBoundingClientRect();
        tip.addClass("is-on");
        const tw = tip.offsetWidth;
        tip.style.left = `${Math.max(0, Math.min(cr.left - rr.left + cr.width / 2 - tw / 2, rr.width - tw))}px`;
        tip.style.top = `${cr.top - rr.top - tip.offsetHeight - 8}px`;
      });
      el.addEventListener("mouseleave", () => tip.removeClass("is-on"));
    };
    const isToday = (d) => localDateKey(d) === localDateKey(today);

    // GitHub-style weeks × days grid for [gStart, gEnd]
    const yearGrid = (host, gStart, gEnd) => {
      const first = addDays(gStart, -gStart.getDay());
      const last = gEnd > today ? today : gEnd;
      const weeks = Math.ceil(((last - first) / 86400000 + 1) / 7);
      const scroll = host.createDiv({ cls: "movie-heatmap-scroll" });
      const grid = scroll.createDiv({ cls: "movie-heatmap-grid" });
      // if the grid is wider than the card (small windows), start at the newest weeks
      requestAnimationFrame(() => {
        scroll.scrollLeft = scroll.scrollWidth;
      });
      grid.style.gridTemplateColumns = `auto repeat(${weeks}, minmax(0, 1fr))`;

      let lastMonth = -1;
      const labels = [];
      for (let w = 0; w < weeks; w++) {
        const mo = addDays(first, w * 7).getMonth();
        if (mo !== lastMonth) {
          labels.push({ w, mo });
          lastMonth = mo;
        }
      }
      labels.forEach((ml, idx) => {
        const nxt = labels[idx + 1];
        if (nxt && nxt.w - ml.w < 3) return;
        if (!nxt && weeks - ml.w < 2) return;
        const el = grid.createDiv({ cls: "movie-heatmap-month", text: HM_MONTHS[ml.mo] });
        el.style.gridRow = "1";
        el.style.gridColumn = `${ml.w + 2} / span 3`;
      });
      [1, 3, 5].forEach((d) => {
        const el = grid.createDiv({ cls: "movie-heatmap-dow", text: HM_DAYS[d] });
        el.style.gridRow = String(d + 2);
        el.style.gridColumn = "1";
      });
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const date = addDays(first, w * 7 + d);
          const inRange = date >= gStart && date <= last;
          const n = inRange ? valueOf(localDateKey(date)) : 0;
          const cell = grid.createDiv({ cls: "movie-heatmap-cell" + (inRange ? ` lv${level(n)}` : " is-blank") });
          cell.style.gridRow = String(d + 2);
          cell.style.gridColumn = String(w + 2);
          if (!inRange) continue;
          if (isToday(date)) cell.addClass("is-today");
          attachTip(cell, date, n);
        }
      }
    };

    if (view.range === "week") {
      const row = body.createDiv({ cls: "movie-heatmap-week" });
      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        const future = date > today;
        const n = future ? 0 : valueOf(localDateKey(date));
        const tile = row.createDiv({ cls: "movie-heatmap-daytile " + (future ? "is-future" : `lv${level(n)}`) + (isToday(date) ? " is-today" : "") });
        tile.createDiv({ cls: "movie-heatmap-daytile-dow", text: HM_DAYS[date.getDay()] });
        tile.createDiv({ cls: "movie-heatmap-daytile-n", text: future ? "–" : String(n) });
        tile.createDiv({ cls: "movie-heatmap-daytile-date", text: fmtShort(date) });
        if (!future) attachTip(tile, date, n);
      }
    } else if (view.range === "month") {
      const names = body.createDiv({ cls: "movie-heatmap-weekdays" });
      HM_DAYS.forEach((d) => names.createDiv({ text: d }));
      const grid = body.createDiv({ cls: "movie-heatmap-monthgrid" });
      for (let i = 0; i < start.getDay(); i++) grid.createDiv({ cls: "movie-heatmap-daytile is-month is-blank" });
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const future = d > today;
        const n = future ? 0 : valueOf(localDateKey(d));
        const tile = grid.createDiv({ cls: "movie-heatmap-daytile is-month " + (future ? "is-future" : `lv${level(n)}`) + (isToday(d) ? " is-today" : "") });
        tile.createDiv({ cls: "movie-heatmap-daytile-date", text: String(d.getDate()) });
        tile.createDiv({ cls: "movie-heatmap-daytile-n", text: !future && n ? String(n) : "" });
        if (!future) attachTip(tile, new Date(d), n);
      }
    } else if (view.range === "year") {
      yearGrid(body, start, effEnd);
    } else {
      for (let yr = today.getFullYear(); yr >= earliest.getFullYear(); yr--) {
        const ys = new Date(yr, 0, 1);
        const ye = yr === today.getFullYear() ? today : new Date(yr, 11, 31);
        let yt = 0;
        for (let d = ys; d <= ye; d = addDays(d, 1)) yt += valueOf(localDateKey(d));
        const yh = body.createDiv({ cls: "movie-heatmap-yearhead" });
        yh.createSpan({ cls: "movie-heatmap-yearhead-year", text: String(yr) });
        yh.createSpan({ cls: "movie-heatmap-yearhead-total", text: `${yt} ${yt === 1 ? "activity" : "activities"}` });
        yearGrid(body, ys, ye);
      }
    }

    // ---- footer: legend ----
    const foot = root.createDiv({ cls: "movie-heatmap-foot" });
    const legend = foot.createDiv({ cls: "movie-heatmap-legend" });
    legend.createSpan({ text: "Less" });
    for (let l = 0; l <= 4; l++) legend.createDiv({ cls: `movie-heatmap-cell lv${l} is-legend` });
    legend.createSpan({ text: "More" });

    // ---- stat tiles ----
    const tiles = root.createDiv({ cls: "movie-heatmap-tiles" });
    const tile = (value, label) => {
      const t = tiles.createDiv({ cls: "movie-heatmap-tile" });
      t.createDiv({ cls: "movie-heatmap-tile-value", text: value });
      t.createDiv({ cls: "movie-heatmap-tile-label", text: label });
    };
    tile(view.range === "week" || view.range === "month" ? `${active} / ${span}` : String(active), "Active days");
    tile(`${current} day${current === 1 ? "" : "s"}`, "Current streak");
    tile(`${longest} day${longest === 1 ? "" : "s"}`, "Longest streak");
    tile(busiest ? fmtShort(busiest.date) : "—", busiest ? `Busiest day · ${busiest.n}` : "Busiest day");

    root.createDiv({
      cls: "movie-heatmap-note",
      text: "Logged when you mark a movie Watched or step TV episodes, on the date you pick (today by default). Set a movie's watched date from its details.",
    });
  };
  draw();
  return root;
}

// ---------- Detail modal: tabs, notes pane, action buttons ----------
const ACTION_ICONS = {
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  refresh: '<svg class="movie-detail-btn-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
  download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>',
  upload: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
};

function makeActionBtn(parent, cls, iconKey, label) {
  const btn = parent.createEl("button", { cls });
  btn.innerHTML = ACTION_ICONS[iconKey];
  btn.createSpan({ cls: "movie-detail-btn-label", text: label });
  return btn;
}

const HEART_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

function makeAddButton(parent, label) {
  const btn = parent.createEl("button", { cls: "movie-gallery-add-btn" });
  btn.createSpan({ cls: "mg-add-badge" }).innerHTML = ACTION_ICONS.plus;
  btn.createSpan({ cls: "movie-detail-btn-label", text: label });
  return btn;
}

function setActionBtnLabel(btn, label, busy) {
  const span = btn.querySelector(".movie-detail-btn-label");
  if (span) span.setText(label);
  btn.toggleClass("is-busy", !!busy);
}

// [2021, 2020, 2019, 2024] -> "2019–2021 and 2024"
function describeYears(years) {
  const ys = [...new Set(years.map(Number))].filter((n) => !isNaN(n)).sort((a, b) => a - b);
  if (!ys.length) return "";
  const runs = [];
  let start = ys[0], prev = ys[0];
  for (const y of ys.slice(1)) {
    if (y === prev + 1) {
      prev = y;
      continue;
    }
    runs.push([start, prev]);
    start = prev = y;
  }
  runs.push([start, prev]);
  const parts = runs.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`));
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// Search helpers. A title matches if it contains the text, or if it does once
// punctuation is ignored ("spider man" finds "Spider-Man").
const normSearch = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function titleMatches(title, q) {
  const t = String(title || "").toLowerCase();
  if (t.includes(q)) return true;
  const nq = normSearch(q);
  return !!nq && normSearch(t).includes(nq);
}

// 0 starts with it · 1 a word starts with it · 2 contains it · 3 only people matched
function searchRank(title, q) {
  const t = String(title || "").toLowerCase();
  const nt = normSearch(t);
  const nq = normSearch(q);
  if (t.startsWith(q) || (nq && nt.startsWith(nq))) return 0;
  if (nq && (" " + nt).includes(" " + nq)) return 1;
  if (titleMatches(t, q)) return 2;
  return 3;
}

// With the default "Recently added" order, the best match comes first. With any
// other sort the order you chose is kept, apart from people-only matches going last.
function rankSearchResults(items, q, titleOf, byRelevance) {
  return items
    .map((x, i) => ({ x, i, r: searchRank(titleOf(x), q) }))
    .sort((a, b) => {
      const ra = byRelevance ? a.r : a.r === 3 ? 1 : 0;
      const rb = byRelevance ? b.r : b.r === 3 ? 1 : 0;
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map((o) => o.x);
}

// ---------- Status: To Watch · Watching · Watched · Trashed ----------
// `watched` stays the source of truth for "finished"; `status` only carries the
// two extra states, so existing libraries and backups keep working untouched.
const STATUS_OPTIONS = [
  ["unwatched", "To Watch"],
  ["watching", "Watching"],
  ["watched", "Watched"],
  ["dropped", "Trashed"],
];
const STATUS_BADGE = { watched: "✓", watching: "▶", dropped: "✕" };

function statusOf(e) {
  if (e.watched) return "watched";
  if (e.status === "watching" || e.status === "dropped") return e.status;
  return "unwatched";
}

function setStatus(e, s) {
  e.watched = s === "watched";
  if (s === "watching" || s === "dropped") e.status = s;
  else delete e.status;
}

function statusFields(v) {
  return { watched: v === "watched", ...(v === "watching" || v === "dropped" ? { status: v } : {}) };
}

// How many separate year filters are active: a range counts once.
function countYearRuns(years) {
  const ys = [...new Set((years || []).map(Number))].filter((n) => !isNaN(n)).sort((a, b) => a - b);
  let runs = 0;
  ys.forEach((y, i) => {
    if (i === 0 || y !== ys[i - 1] + 1) runs++;
  });
  return runs;
}

function localDateKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- TV progress: seasons and episodes stay linked ----------
// TMDB: "Returning Series", "Ended", "Canceled" (also "In Production", "Planned", "Pilot").
function normalizeSeriesStatus(raw) {
  const t = String(raw || "").toLowerCase();
  if (/cancel/.test(t)) return "cancelled";
  if (/ended/.test(t)) return "ended";
  if (/returning/.test(t)) return "returning";
  return "";
}

function extractSeasonEpisodes(data) {
  return (data.seasons || [])
    .filter((x) => x && x.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((x) => x.episode_count || 0);
}

// Cumulative episode counts at the end of each season, e.g. [10, 20, 28].
// Uses real per-season counts when known, otherwise an even split.
function showSeasonBounds(s) {
  if (Array.isArray(s.season_episodes) && s.season_episodes.length) {
    let acc = 0;
    return s.season_episodes.map((c) => (acc += c || 0));
  }
  const n = s.number_of_seasons || 0;
  const total = s.number_of_episodes || 0;
  if (n && total) return Array.from({ length: n }, (_, i) => Math.round(((i + 1) * total) / n));
  return null;
}

function seasonsFromEpisodes(s, eps) {
  const b = showSeasonBounds(s);
  if (!b) return null;
  const total = s.number_of_episodes || 0;
  if (total && eps >= total) return s.number_of_seasons || b.length;
  let n = 0;
  for (const x of b) {
    if (x > 0 && eps >= x) n++;
    else break;
  }
  return n;
}

function episodesFromSeasons(s, n) {
  const b = showSeasonBounds(s);
  if (!b) return null;
  if (n <= 0) return 0;
  if (s.number_of_seasons && n >= s.number_of_seasons && s.number_of_episodes) return s.number_of_episodes;
  return b[Math.min(n, b.length) - 1];
}

// `changed` is the counter the user touched; the other one follows.
function syncShowProgress(s, changed) {
  if (changed === "episodes") {
    const n = seasonsFromEpisodes(s, s.episodesWatched || 0);
    if (n !== null) s.seasonsWatched = n;
  } else if (changed === "seasons") {
    const e = episodesFromSeasons(s, s.seasonsWatched || 0);
    if (e !== null) s.episodesWatched = e;
  }
}

// What the UI should display (seasons are derived from episodes when possible).
function getShowProgress(s) {
  const eps = s.episodesWatched || 0;
  const derived = seasonsFromEpisodes(s, eps);
  return { episodes: eps, seasons: derived !== null ? derived : s.seasonsWatched || 0 };
}

const CAL_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

// A date chip: shows the date, opens the native date picker on click.
function buildDateChip(parent, { value, label, empty, onPick, cls }) {
  const today = localDateKey(new Date());
  const wrap = parent.createDiv({ cls: "mg-date-chip" + (cls ? ` ${cls}` : "") + (value ? "" : " is-unset") });
  const btn = wrap.createEl("button", { cls: "mg-date-btn", attr: { type: "button", "aria-label": label } });
  btn.innerHTML = CAL_SVG;
  btn.createSpan({ text: value ? label : empty });
  const input = wrap.createEl("input", { type: "date", cls: "mg-date-input", attr: { max: today, tabindex: "-1" } });
  input.value = value || today;
  btn.addEventListener("click", () => {
    try {
      input.showPicker();
    } catch (e) {
      input.focus();
      input.click();
    }
  });
  input.addEventListener("change", () => {
    if (input.value && input.value <= today) onPick(input.value);
  });
  return wrap;
}

// Four-way status switch. Heatmap rule: a "watched" activity exists exactly while a
// watched date is stored, so changing status keeps the log in step.
function buildStatusControl(modal, parent, entry, kind) {
  const plugin = modal.plugin;
  const save = (e) => (kind === "movie" ? plugin.updateMovie(e) : plugin.updateShow(e));
  const current = statusOf(entry);
  const seg = parent.createDiv({ cls: "mg-status-seg", attr: { role: "radiogroup", "aria-label": "Status" } });
  STATUS_OPTIONS.forEach(([value, label]) => {
    const b = seg.createEl("button", {
      cls: "mg-status-opt" + (value === current ? " is-active" : ""),
      attr: { "data-status": value, role: "radio", "aria-checked": String(value === current) },
    });
    b.createSpan({ cls: "mg-status-dot" });
    b.createSpan({ text: label });
    b.addEventListener("click", async () => {
      if (value === current) return;
      if (current === "watched" && entry.watchedDate) {
        plugin.logActivity(kind, -1, entry.watchedDate);
        delete entry.watchedDate;
      }
      setStatus(entry, value);
      if (value === "watched") {
        entry.watchedDate = (kind === "tv" && modal._logDate) || localDateKey(new Date());
        plugin.logActivity(kind, 1, entry.watchedDate);
      }
      await save(entry);
      modal.renderView();
    });
  });

  // when did you watch it? (movies always; shows only when this control logged it)
  if (statusOf(entry) === "watched" && (kind === "movie" || entry.watchedDate)) {
    buildDateChip(parent, {
      value: entry.watchedDate,
      label: entry.watchedDate ? `Watched ${formatShortDate(entry.watchedDate)}` : "",
      empty: "Set watched date",
      onPick: async (v) => {
        if (entry.watchedDate) plugin.logActivity(kind, -1, entry.watchedDate);
        entry.watchedDate = v;
        plugin.logActivity(kind, 1, v);
        await save(entry);
        modal.renderView();
      },
    });
  }
}

// One card for TV progress: seasons + episodes side by side, a single bar underneath.
function buildProgressFact(modal, facts, s) {
  const totalSeasons = s.number_of_seasons || 0;
  const totalEps = s.number_of_episodes || 0;
  const prog = getShowProgress(s);
  const ratio = totalEps ? prog.episodes / totalEps : totalSeasons ? prog.seasons / totalSeasons : null;

  const card = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full movie-progress-card" });
  const head = card.createDiv({ cls: "movie-progress-head" });
  head.createDiv({ cls: "movie-detail-fact-label", text: "Progress" });
  if (ratio !== null) head.createDiv({ cls: "movie-progress-pct", text: `${Math.round(Math.min(1, ratio) * 100)}%` });

  const grid = card.createDiv({ cls: "movie-progress-counters" });
  const makeCounter = (label, unit, field, total, current) => {
    const plural = `${unit}s`;
    const cell = grid.createDiv({ cls: "movie-counter" });
    const meta = cell.createDiv({ cls: "movie-counter-meta" });
    meta.createDiv({ cls: "movie-counter-label", text: label });
    meta.createDiv({ cls: "movie-counter-of", text: total ? `of ${total}` : "total unknown" });

    const stepper = cell.createDiv({ cls: "movie-counter-stepper" });
    const minusBtn = stepper.createEl("button", {
      cls: "movie-counter-step",
      text: "−",
      attr: { "aria-label": `Decrease ${plural} watched` },
    });
    const input = stepper.createEl("input", {
      type: "number",
      cls: "movie-counter-input",
      attr: { min: "0", ...(total ? { max: String(total) } : {}), "aria-label": `${label} watched` },
    });
    input.value = String(current);
    const plusBtn = stepper.createEl("button", {
      cls: "movie-counter-step",
      text: "+",
      attr: { "aria-label": `Increase ${plural} watched` },
    });

    const commit = async (raw) => {
      let val = parseInt(raw, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (total && val > total) val = total;
      input.value = String(val);
      const epsBefore = s.episodesWatched || 0;
      s[field] = val;
      syncShowProgress(s, field === "seasonsWatched" ? "seasons" : "episodes");
      modal.plugin.logActivity("tv", (s.episodesWatched || 0) - epsBefore, modal._logDate || localDateKey(new Date()));
      const doneEps = s.number_of_episodes && (s.episodesWatched || 0) >= s.number_of_episodes;
      const doneSeasons = s.number_of_seasons && (s.seasonsWatched || 0) >= s.number_of_seasons;
      if (doneEps || doneSeasons) setStatus(s, "watched");
      else if ((s.episodesWatched || 0) > 0 && statusOf(s) === "unwatched") setStatus(s, "watching");
      await modal.plugin.updateShow(s);
      modal.renderView();
    };
    input.addEventListener("change", () => commit(input.value));
    minusBtn.disabled = current <= 0;
    minusBtn.addEventListener("click", () => commit(current - 1));
    plusBtn.disabled = total > 0 && current >= total;
    plusBtn.addEventListener("click", () => commit(current + 1));
  };
  makeCounter("Seasons", "season", "seasonsWatched", totalSeasons, prog.seasons);
  makeCounter("Episodes", "episode", "episodesWatched", totalEps, prog.episodes);

  if (ratio !== null) {
    const track = card.createDiv({ cls: "movie-progress-track" });
    track.createDiv({ cls: "movie-progress-fill" }).style.width = `${Math.min(100, ratio * 100)}%`;
  }

  // Which day the + / − steps are logged to on the heatmap (today unless you pick another).
  const today = localDateKey(new Date());
  const logKey = modal._logDate || today;
  const custom = logKey !== today;
  const foot = card.createDiv({ cls: "movie-progress-foot" });
  foot.createSpan({ cls: "movie-progress-foot-text", text: "Episodes you add are logged on" });
  buildDateChip(foot, {
    value: logKey,
    label: custom ? formatShortDate(logKey) : "Today",
    empty: "",
    cls: "is-log" + (custom ? " is-custom" : ""),
    onPick: (v) => {
      modal._logDate = v === today ? undefined : v;
      modal.renderView();
    },
  });
  if (custom) {
    const reset = foot.createEl("button", { cls: "mg-date-reset", text: "Back to today", attr: { type: "button" } });
    reset.addEventListener("click", () => {
      modal._logDate = undefined;
      modal.renderView();
    });
  }
}

// ---------- Notes: compact preview in the details, full note on demand ----------
// The details keep their natural height: only a two-line reminder is shown.
// Clicking reveals the whole note as an overlay sheet, a popover, or in place
// (Gallery Settings → "Open notes as").
function buildNoteReader(host, opts) {
  const { title, onSave, onClose, startEditing } = opts;
  let notes = opts.notes || "";
  const render = (editing) => {
    host.empty();
    const head = host.createDiv({ cls: "mg-note-head" });
    const heads = head.createDiv({ cls: "mg-note-heads" });
    heads.createDiv({ cls: "mg-note-kicker", text: "My Notes" });
    if (title) heads.createDiv({ cls: "mg-note-title", text: title });
    const x = head.createEl("button", { cls: "mg-note-x", attr: { "aria-label": "Close" } });
    x.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    x.addEventListener("click", onClose);

    if (editing) {
      const area = host.createEl("textarea", { cls: "mg-note-textarea", attr: { placeholder: "Write your thoughts…", rows: "6" } });
      area.value = notes;
      const fit = () => {
        area.style.height = "auto";
        area.style.height = Math.min(area.scrollHeight + 2, Math.round(window.innerHeight * 0.6)) + "px";
      };
      area.addEventListener("input", fit);
      requestAnimationFrame(() => {
        fit();
        area.focus();
        area.setSelectionRange(area.value.length, area.value.length);
      });
      const row = host.createDiv({ cls: "mg-note-actions" });
      row.createEl("button", { text: "Cancel", cls: "mg-note-btn" }).addEventListener("click", () => (notes ? render(false) : onClose()));
      const save = row.createEl("button", { text: "Save", cls: "mg-note-btn is-primary" });
      save.addEventListener("click", async () => {
        save.disabled = true;
        const next = area.value.trim();
        await onSave(next);
        notes = next;
        if (next) render(false);
        else onClose();
      });
      return;
    }
    host.createDiv({ cls: "mg-note-text", text: notes });
    const row = host.createDiv({ cls: "mg-note-actions" });
    const edit = makeActionBtn(row, "mg-note-btn", "edit", "Edit note");
    edit.addEventListener("click", () => render(true));
    row.createEl("button", { text: "Close", cls: "mg-note-btn is-primary" }).addEventListener("click", onClose);
  };
  render(!!startEditing || !notes);
}

// Overlay sheet over the details modal. Esc closes only the sheet, not the modal.
function openNoteLayer(app, opts) {
  const scope = new Scope();
  const scrim = document.body.createDiv({ cls: "mg-note-scrim" });
  const layer = scrim.createDiv({ cls: "mg-note-layer is-overlay", attr: { role: "dialog", "aria-label": "Note" } });
  let open = true;

  const close = () => {
    if (!open) return;
    open = false;
    app.keymap.popScope(scope);
    scrim.remove();
    if (opts.onClosed) opts.onClosed();
  };

  scrim.addEventListener("mousedown", (e) => {
    if (e.target === scrim) close();
  });
  scope.register([], "Escape", () => {
    close();
    return false;
  });
  app.keymap.pushScope(scope);

  buildNoteReader(layer, { ...opts, onClose: close });
  return { close };
}

// Compact reminder card: two lines of the note; click opens the full note.
function buildNotesCard(modal, container, opts) {
  const { title, notes, onSave } = opts;
  const card = container.createDiv({ cls: "movie-note-card" });

  const openLayer = (startEditing) => {
    if (modal._noteLayer) modal._noteLayer.close();
    card.addClass("is-open");
    modal._noteLayer = openNoteLayer(modal.app, {
      title,
      notes,
      startEditing,
      onSave,
      onClosed: () => {
        card.removeClass("is-open");
        modal._noteLayer = null;
      },
    });
  };

  if (!notes) {
    const add = card.createEl("button", { cls: "movie-note-add" });
    add.createSpan({ cls: "movie-note-add-plus", text: "+" });
    add.createSpan({ text: "Add a note" });
    add.addEventListener("click", () => openLayer(true));
    return card;
  }

  const head = card.createDiv({ cls: "movie-note-head" });
  head.createDiv({ cls: "movie-note-kicker", text: "My Notes" });
  const chip = head.createDiv({ cls: "movie-note-chip" });
  const setChip = (label) => {
    chip.empty();
    chip.createSpan({ text: label });
    chip.createSpan({ cls: "movie-note-chevron" }).innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  };
  setChip("Read");

  const body = card.createDiv({ cls: "movie-note-body" });
  body.setText(notes.replace(/\s+/g, " ").trim());
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");

  // Fade the bottom of the preview when the note runs past two lines.
  // (Length is a fallback so the fade never depends on layout timing.)
  card.toggleClass("is-clipped", notes.length > 110);
  requestAnimationFrame(() => {
    const clipped = body.scrollHeight > body.clientHeight + 1 || notes.length > 110;
    card.toggleClass("is-clipped", clipped);
    if (!clipped) setChip("Open");
  });

  card.addEventListener("click", () => openLayer(false));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openLayer(false);
    }
  });
  return card;
}

function addSearchSettings(contentEl, plugin, peopleLabel) {
  contentEl.createDiv({ cls: "movie-gallery-settings-divider" });
  contentEl.createEl("h3", { text: "Search", cls: "movie-gallery-settings-section-title" });
  const wrap = contentEl.createDiv({ cls: "movie-gallery-settings-toggles" });
  [
    ["searchDirector", `Search by ${peopleLabel}`],
    ["searchCast", "Search by cast"],
  ].forEach(([key, label]) => {
    const item = wrap.createEl("label", { cls: "movie-gallery-checkbox-item" });
    item.createSpan({ cls: "movie-gallery-checkbox-label", text: label });
    const checkbox = item.createEl("input", { type: "checkbox" });
    checkbox.checked = plugin.settings[key] !== false;
    item.toggleClass("is-checked", checkbox.checked);
    checkbox.addEventListener("change", async () => {
      item.toggleClass("is-checked", checkbox.checked);
      plugin.settings[key] = checkbox.checked;
      await plugin.saveSettings();
      plugin.refreshGalleries();
    });
  });
  contentEl.createDiv({
    cls: "movie-gallery-settings-hint",
    text: "Titles are always searched. Results that start with what you type come first, then titles with a word starting with it, then other title matches, then people.",
  });
}

// ---------- Gallery settings: shared Update / Backup / Import block ----------
function buildDataTools(contentEl, cfg) {
  const list = contentEl.createDiv({ cls: "movie-data-list" });
  const progressEl = contentEl.createDiv({ cls: "movie-gallery-settings-progress" });

  const makeRow = (title, sub) => {
    const row = list.createDiv({ cls: "movie-data-row" });
    const text = row.createDiv({ cls: "movie-data-text" });
    text.createDiv({ cls: "movie-data-title", text: title });
    if (sub) text.createDiv({ cls: "movie-data-sub", text: sub });
    return row.createDiv({ cls: "movie-data-controls" });
  };

  // -- Update --
  const updateCtl = makeRow("Update database", cfg.updateDesc);
  const updateBtn = makeActionBtn(updateCtl, "movie-data-btn is-primary", "refresh", "Update now");
  updateBtn.addEventListener("click", async () => {
    if (!cfg.plugin.settings.tmdbApiKey) {
      progressEl.setText("Set your TMDB API key first.");
      return;
    }
    updateBtn.disabled = true;
    setActionBtnLabel(updateBtn, "Updating…", true);
    const updated = await cfg.refreshAll((done, total) => {
      progressEl.setText(`Updating ${done} / ${total}...`);
    });
    setActionBtnLabel(updateBtn, "Update now", false);
    updateBtn.disabled = false;
    progressEl.setText(`Done — updated ${updated} ${cfg.noun}${updated === 1 ? "" : "s"}.`);
  });

  // -- Backup --
  const backupCtl = makeRow("Backup", `Save your ${cfg.noun} list to a file`);
  let backupFmt = "txt";
  const fmtGroup = backupCtl.createDiv({ cls: "movie-data-segmented", attr: { role: "radiogroup" } });
  const fmtBtns = [];
  const paintFmt = () =>
    fmtBtns.forEach(([v, el]) => {
      el.toggleClass("selected", v === backupFmt);
      el.setAttribute("aria-checked", String(v === backupFmt));
    });
  [["txt", ".txt"], ["csv", ".csv"]].forEach(([value, label]) => {
    const b = fmtGroup.createEl("button", { text: label, cls: "movie-data-segment", attr: { role: "radio" } });
    fmtBtns.push([value, b]);
    b.addEventListener("click", () => {
      backupFmt = value;
      paintFmt();
    });
  });
  paintFmt();
  const backupBtn = makeActionBtn(backupCtl, "movie-data-btn", "download", "Export");
  backupBtn.addEventListener("click", async () => {
    backupBtn.disabled = true;
    setActionBtnLabel(backupBtn, "Exporting…", false);
    const path = await cfg.backup(backupFmt);
    backupBtn.disabled = false;
    setActionBtnLabel(backupBtn, "Export", false);
    progressEl.setText(path ? `Backup saved to ${path}` : "Backup cancelled.");
  });

  // -- Import --
  const importCtl = makeRow("Import", cfg.importDesc);
  const importBtn = makeActionBtn(importCtl, "movie-data-btn", "upload", "Choose file");
  const importInput = importCtl.createEl("input", {
    type: "file",
    attr: { accept: ".csv", style: "display:none" },
  });
  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    if (!file) return;
    importBtn.disabled = true;
    setActionBtnLabel(importBtn, "Importing…", false);
    const text = await file.text();
    const res = await cfg.importFile(text, file.name, (done, total) =>
      progressEl.setText(`Importing... ${done} / ${total}`)
    );
    importBtn.disabled = false;
    setActionBtnLabel(importBtn, "Choose file", false);
    importInput.value = "";

    const { imported, skipped, failed, format, error } = res;
    if (error === "no_api_key") {
      progressEl.setText(cfg.noKeyMsg);
      return;
    }
    if (error === "unsupported" && cfg.unsupportedMsg) {
      progressEl.setText(cfg.unsupportedMsg);
      return;
    }
    const formatLabel = cfg.formatLabels[format] || format;
    const parts = [`Imported ${imported} (${formatLabel} format)`];
    if (skipped) parts.push(`${skipped} already in library or not a ${cfg.skipNoun} title`);
    if (failed) parts.push(`${failed} couldn't be matched`);
    progressEl.setText(parts.join(", ") + ".");
  });
}

class MovieGalleryPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    await this.loadActivity();
    this.galleryEls = new Set();
    this.galleryStates = new Map();
    this.activeTabByEl = new Map();
    this.tvGalleryStates = new Map();

    this.addSettingTab(new MovieGallerySettingTab(this.app, this));
    installCustomDropdowns(this);

    this.registerMarkdownCodeBlockProcessor("terro-movie", (source, el) => {
      this.galleryEls.add(el);
      this.renderGallery(el);
    });

    this.registerMarkdownCodeBlockProcessor("terro-tv", (source, el) => {
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
  }

  onunload() {
    this.galleryEls?.clear();
    this.galleryStates?.clear();
    this.tvGalleryStates?.clear();
    this.activeTabByEl?.clear();
    if (this._activitySaveTimer) {
      clearTimeout(this._activitySaveTimer);
      this._activitySaveTimer = null;
      this.writeActivity();
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.settings.cardFields = Object.assign({}, DEFAULT_SETTINGS.cardFields, data.cardFields || {});
    this.settings.tvCardFields = Object.assign({}, DEFAULT_SETTINGS.tvCardFields, data.tvCardFields || {});
    // Older versions kept the heatmap log inside data.json; it now has its own file.
    this._legacyActivity = data.activity && typeof data.activity === "object" ? data.activity : null;
    delete this.settings.activity;
  }

  // ---- activity.json: { "YYYY-MM-DD": { m: movies, t: tv } } ----
  async loadActivity() {
    const path = this.settings.activityFile || "activity.json";
    this.activity = {};
    try {
      if (await this.app.vault.adapter.exists(path)) {
        const raw = await this.app.vault.adapter.read(path);
        let parsed = null;
        try {
          parsed = raw.trim() ? JSON.parse(raw) : {};
        } catch (parseErr) {
          // never overwrite something we couldn't read: keep a copy first
          await this.app.vault.adapter.write(path + ".bak", raw);
          new Notice(`TerroTrack: ${path} was unreadable. A copy was kept as ${path}.bak and a fresh log was started.`);
        }
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) this.activity = parsed;
      } else {
        // first run with the new file: bring over anything stored in data.json
        this.activity = this._legacyActivity || {};
        await this.writeActivity();
      }
      if (this._legacyActivity !== null) {
        this._legacyActivity = null;
        await this.saveSettings(); // data.json no longer carries the log
      }
    } catch (e) {
      console.error("TerroTrack: could not read activity file", e);
      new Notice("TerroTrack: could not read " + path);
    }
  }

  async writeActivity() {
    const path = this.settings.activityFile || "activity.json";
    const ordered = {};
    Object.keys(this.activity || {})
      .sort()
      .forEach((k) => (ordered[k] = this.activity[k]));
    await this.app.vault.adapter.write(path, JSON.stringify(ordered, null, 2));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Activity log for the heatmap: { "YYYY-MM-DD": { m: movies, t: tv } }.
  // Counts movies marked watched and TV episodes watched, per local day.
  logActivity(kind, n = 1, dateKey) {
    if (!n) return;
    const key = dateKey || localDateKey(new Date());
    this.activity = this.activity || {};
    const day = (this.activity[key] = this.activity[key] || { m: 0, t: 0 });
    const field = kind === "movie" ? "m" : "t";
    day[field] = Math.max(0, (day[field] || 0) + n); // negative n undoes a same-day mistake
    if (!day.m && !day.t) delete this.activity[key];
    clearTimeout(this._activitySaveTimer);
    this._activitySaveTimer = setTimeout(() => {
      this._activitySaveTimer = null;
      this.writeActivity();
    }, 600);
  }

  async readMovies() {
    const path = this.settings.dataFile;
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return [];
    try {
      const content = await this.app.vault.adapter.read(path);
      return content.trim() ? JSON.parse(content) : [];
    } catch (e) {
      console.error("TerroTrack: failed to read data file", e);
      new Notice("TerroTrack: could not read " + path);
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
      console.error("TerroTrack: failed to fetch details", e);
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
      console.error("TerroTrack: failed to fetch similar movies", e);
      return [];
    }
  }

  async readShows() {
    const path = this.settings.tvDataFile;
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return [];
    try {
      const content = await this.app.vault.adapter.read(path);
      return content.trim() ? JSON.parse(content) : [];
    } catch (e) {
      console.error("TerroTrack: failed to read TV data file", e);
      new Notice("TerroTrack: could not read " + path);
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

  // Older entries lack per-season episode counts; fetch them once so seasons and
  // episodes can stay in sync. Returns true when the entry was filled in.
  async backfillSeasonEpisodes(s) {
    if (!this.settings.tmdbApiKey || !s.id || String(s.id).startsWith("custom-")) return false;
    try {
      const url =
        `https://api.themoviedb.org/3/tv/${s.id}?` +
        new URLSearchParams({ api_key: this.settings.tmdbApiKey }).toString();
      const res = await requestUrl({ url });
      const arr = extractSeasonEpisodes(res.json);
      if (!arr.length) return false;
      s.season_episodes = arr;
      return true;
    } catch (e) {
      return false;
    }
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
        seasonsWatched: 0,
        first_air_date: data.first_air_date || "",
        last_air_date: data.last_air_date || "",
        show_status: data.status || "",
        number_of_seasons: data.number_of_seasons || null,
        number_of_episodes: data.number_of_episodes || null,
        season_episodes: extractSeasonEpisodes(data),
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
      console.error("TerroTrack: failed to fetch TV show details", e);
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
        seasonsWatched: 0,
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
      console.error("TerroTrack: failed to fetch similar shows", e);
      return [];
    }
  }

  async refreshShowEntry(id) {
    const shows = await this.readShows();
    const idx = shows.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const s = shows[idx];

    try {
      const fresh = await this.fetchShowDetails(s.id, s);
      fresh.watched = s.watched;
      fresh.favorite = !!s.favorite;
      if (s.status) fresh.status = s.status;
      if (s.watchedDate) fresh.watchedDate = s.watchedDate;
      fresh.myRating = s.myRating || "";
      fresh.notes = s.notes || "";
      fresh.episodesWatched = s.episodesWatched || 0;
      fresh.seasonsWatched = s.seasonsWatched || 0;
      shows[idx] = fresh;
      await this.writeShows(shows);
      this.refreshGalleries();
      return fresh;
    } catch (e) {
      console.error("TerroTrack: failed to refresh", s.name, e);
      new Notice(`Couldn't refresh "${s.name}".`);
      return null;
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
        fresh.favorite = !!s.favorite;
        if (s.status) fresh.status = s.status;
        if (s.watchedDate) fresh.watchedDate = s.watchedDate;
        fresh.myRating = s.myRating || "";
        fresh.notes = s.notes || "";
        fresh.episodesWatched = s.episodesWatched || 0;
        fresh.seasonsWatched = s.seasonsWatched || 0;
        shows[i] = fresh;
        updated++;
      } catch (e) {
        console.error("TerroTrack: failed to refresh", s.name, e);
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
      "id", "name", "year", "poster_path", "custom_poster_url", "rating", "myRating", "watched", "favorite", "status", "watchedDate",
      "episodesWatched", "seasonsWatched", "first_air_date", "last_air_date", "show_status", "number_of_seasons",
      "number_of_episodes", "season_episodes", "episode_runtime", "original_language", "genres", "creators", "cast",
      "overview", "notes", "trailer_key",
    ];
    const esc = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "\t" + s;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [fields.join(",")];
    for (const s of shows) lines.push(fields.map((f) => esc(Array.isArray(s[f]) ? s[f].join("|") : s[f])).join(","));
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
        console.error("TerroTrack: native save dialog failed, saving to vault root instead", e);
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
      seasonsWatched: 0,
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
      console.error("TerroTrack: TV import search failed for", name, e);
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
      console.error("TerroTrack: IMDb id lookup failed for", name, e);
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
          favorite: row.favorite === "true",
          status: row.status === "watching" || row.status === "dropped" ? row.status : undefined,
          watchedDate: row.watchedDate || undefined,
          episodesWatched: row.episodesWatched ? parseInt(row.episodesWatched, 10) : 0,
          seasonsWatched: row.seasonsWatched ? parseInt(row.seasonsWatched, 10) : 0,
          first_air_date: row.first_air_date || "",
          last_air_date: row.last_air_date || "",
          show_status: row.show_status || "",
          number_of_seasons: row.number_of_seasons ? parseInt(row.number_of_seasons, 10) : null,
          number_of_episodes: row.number_of_episodes ? parseInt(row.number_of_episodes, 10) : null,
          season_episodes: row.season_episodes
            ? row.season_episodes.split("|").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n))
            : undefined,
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

  normalizeLanguageCode(code) {
    if (!code) return code;
    const aliases = {
      cn: "zh", "zh-cn": "zh", "zh-tw": "zh", "zh-hans": "zh", "zh-hant": "zh",
      cmn: "zh", chi: "zh", zho: "zh", uk: "uk", jp: "ja", gr: "el",
    };
    const lower = String(code).trim().toLowerCase();
    return aliases[lower] || lower;
  }

  languageName(code) {
    const normalized = this.normalizeLanguageCode(code);
    if (!normalized) return "";
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(normalized);
    } catch {
      return normalized;
    }
  }

  async refreshMovieEntry(id) {
    const movies = await this.readMovies();
    const idx = movies.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const m = movies[idx];

    try {
      const fresh = await this.fetchMovieDetails(m.id, m);
      fresh.watched = m.watched;
      fresh.favorite = !!m.favorite;
      if (m.status) fresh.status = m.status;
      if (m.watchedDate) fresh.watchedDate = m.watchedDate;
      fresh.myRating = m.myRating || "";
      fresh.notes = m.notes || "";
      movies[idx] = fresh;
      await this.writeMovies(movies);
      this.refreshGalleries();
      return fresh;
    } catch (e) {
      console.error("TerroTrack: failed to refresh", m.title, e);
      new Notice(`Couldn't refresh "${m.title}".`);
      return null;
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
        fresh.favorite = !!m.favorite;
        if (m.status) fresh.status = m.status;
        if (m.watchedDate) fresh.watchedDate = m.watchedDate;
        fresh.myRating = m.myRating || "";
        fresh.notes = m.notes || "";
        movies[i] = fresh;
        updated++;
      } catch (e) {
        console.error("TerroTrack: failed to refresh", m.title, e);
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
      "id", "title", "year", "poster_path", "custom_poster_url", "rating", "myRating", "watched", "favorite", "status", "watchedDate",
      "release_date", "runtime", "original_language", "budget", "genres", "director",
      "cast", "overview", "notes", "trailer_key",
    ];
    const esc = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "\t" + s;
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
        console.error("TerroTrack: native save dialog failed, saving to vault root instead", e);
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
    const toWatch = movies.filter((m) => statusOf(m) === "unwatched");
    const watchingList = movies.filter((m) => statusOf(m) === "watching");
    const droppedList = movies.filter((m) => statusOf(m) === "dropped");

    const totalMinutes = watched.reduce((sum, m) => sum + (m.runtime || 0), 0);

    const genreCounts = {};
    for (const m of movies) {
      (m.genres || "").split(",").map((g) => g.trim()).filter(Boolean).forEach((g) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

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
      watchingCount: watchingList.length,
      droppedCount: droppedList.length,
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
    const toWatch = shows.filter((s) => statusOf(s) === "unwatched");
    const watchingList = shows.filter((s) => statusOf(s) === "watching");
    const droppedList = shows.filter((s) => statusOf(s) === "dropped");

    const totalMinutes = watched.reduce((sum, s) => sum + (s.episode_runtime || 0) * (s.number_of_episodes || 1), 0);

    const genreCounts = {};
    for (const s of shows) {
      (s.genres || "").split(",").map((g) => g.trim()).filter(Boolean).forEach((g) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

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
      watchingCount: watchingList.length,
      droppedCount: droppedList.length,
      totalMinutes,
      topGenres,
      avgMyRating,
      badge: this.getWatchTimeBadge(totalMinutes),
      topYear,
      topDirector,
      topCast,
    };
  }

  // Placeholder follows the "Search by director / cast" options in Gallery Settings.
  searchPlaceholder(peopleLabel) {
    const parts = ["title"];
    if (this.settings.searchDirector !== false) parts.push(peopleLabel);
    if (this.settings.searchCast !== false) parts.push("cast");
    if (parts.length === 1) return "Search title...";
    return `Search ${parts.slice(0, -1).join(", ")}${parts.length > 2 ? "," : ""} or ${parts[parts.length - 1]}...`;
  }

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
      const row = Object.create(null);
      header.forEach((h, i) => {
        if (h === "__proto__" || h === "constructor" || h === "prototype") return;
        row[h] = values[i] ?? "";
      });
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
      console.error("TerroTrack: import search failed for", title, e);
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
      console.error("TerroTrack: IMDb id lookup failed for", title, e);
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
          favorite: row.favorite === "true",
          status: row.status === "watching" || row.status === "dropped" ? row.status : undefined,
          watchedDate: row.watchedDate || undefined,
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
        titleMatches(m.title, q) ||
        (this.settings.searchDirector !== false && (m.director || "").toLowerCase().includes(q)) ||
        (this.settings.searchCast !== false && (m.cast || "").toLowerCase().includes(q));
      const matchesFilter =
        state.filter === "all" || statusOf(m) === state.filter;
      const matchesGenre =
        state.genres.length === 0 ||
        (m.genres || "").split(",").map((g) => g.trim()).some((g) => state.genres.includes(g));
      const matchesLanguage =
        !(state.languages || []).length || state.languages.includes(this.normalizeLanguageCode(m.original_language));
      const matchesYear = !(state.years || []).length || state.years.includes(String(m.year));
      const matchesRating =
        state.ratings.length === 0 || state.ratings.includes(Math.floor(parseFloat(m.rating || 0)));
      const matchesMyRating =
        state.myRatings.length === 0 ||
        (m.myRating !== "" && m.myRating != null && state.myRatings.includes(parseInt(m.myRating, 10)));

      return (
        matchesSearch && matchesFilter && matchesGenre && matchesLanguage &&
        matchesYear && matchesRating && matchesMyRating && (!state.favOnly || !!m.favorite)
      );
    });

    const dir = state.sortDir === "asc" ? 1 : -1;
    switch (state.sortField) {
      case "title": result.sort((a, b) => a.title.localeCompare(b.title) * dir); break;
      case "year": result.sort((a, b) => (a.year || "").localeCompare(b.year || "") * dir); break;
      case "rating": result.sort((a, b) => (parseFloat(a.rating || 0) - parseFloat(b.rating || 0)) * dir); break;
      case "runtime": result.sort((a, b) => ((a.runtime || 0) - (b.runtime || 0)) * dir); break;
      case "added":
      default:
        result = state.sortDir === "asc" ? result.slice() : result.slice().reverse();
        break;
    }

    if (q) result = rankSearchResults(result, q, (m) => m.title, !state.sortField || state.sortField === "added");

    return result;
  }

  // ---- Discover: data ----
  async tmdbList(path, params = {}) {
    const key = `${path}?${JSON.stringify(params)}`;
    this._discoverCache = this._discoverCache || new Map();
    const hit = this._discoverCache.get(key);
    if (hit && Date.now() - hit.t < DISCOVER_TTL) return hit.data;
    const url =
      `https://api.themoviedb.org/3${path}?` +
      new URLSearchParams({ api_key: this.settings.tmdbApiKey, language: "en-US", page: "1", ...params }).toString();
    const res = await requestUrl({ url });
    const data = res.json.results || [];
    this._discoverCache.set(key, { t: Date.now(), data });
    return data;
  }

  async discoverFeed(media, kind) {
    const today = localDateKey(new Date());
    if (kind === "trending") return this.tmdbList(`/trending/${media}/week`);
    if (kind === "new") return this.tmdbList(media === "movie" ? "/movie/now_playing" : "/tv/on_the_air");
    // upcoming
    if (media === "movie") {
      const list = await this.tmdbList("/movie/upcoming");
      return list
        .filter((x) => (x.release_date || "") >= today)
        .sort((a, b) => (a.release_date || "").localeCompare(b.release_date || ""));
    }
    const later = new Date();
    later.setDate(later.getDate() + 240);
    const list = await this.tmdbList("/discover/tv", {
      "first_air_date.gte": today,
      "first_air_date.lte": localDateKey(later),
      sort_by: "popularity.desc",
    });
    return list
      .filter((x) => (x.first_air_date || "") >= today)
      .sort((a, b) => (a.first_air_date || "").localeCompare(b.first_air_date || ""));
  }

  // Personalised picks from your own ratings and genres.
  async discoverForYou(media) {
    const library = media === "movie" ? await this.readMovies() : await this.readShows();
    const libIds = new Set(library.map((e) => e.id));
    const nameOf = (e) => (media === "movie" ? e.title : e.name);

    const weightOf = (e) => {
      const mine = parseFloat(e.myRating);
      if (!isNaN(mine) && mine > 0) return mine >= 7 ? mine - 5 : mine <= 4 ? -1 : 0.5;
      if (statusOf(e) === "dropped") return -1;
      if (e.watched && parseFloat(e.rating) >= 7.5) return 1;
      if (e.watched) return 0.4;
      return 0;
    };
    const liked = library.map((e) => ({ e, w: weightOf(e) })).filter((x) => x.w > 0).sort((a, b) => b.w - a.w);
    if (!liked.length) return { empty: true, picks: [], because: null };

    // genre taste
    const genreWeight = {};
    liked.forEach(({ e, w }) =>
      (e.genres || "").split(",").map((g) => g.trim()).filter(Boolean).forEach((g) => (genreWeight[g] = (genreWeight[g] || 0) + w))
    );
    const topGenres = Object.entries(genreWeight).sort((a, b) => b[1] - a[1]);
    const maxGW = topGenres.length ? topGenres[0][1] : 1;

    const seeds = liked.slice(0, 6).filter((x) => /^\d+$/.test(String(x.e.id)));
    const jobs = seeds.map(async ({ e, w }) => {
      try {
        const recs = await this.tmdbList(`/${media}/${e.id}/recommendations`);
        return { seed: e, w, recs };
      } catch (err) {
        return { seed: e, w, recs: [] };
      }
    });
    const ids = topGenres.slice(0, 2).map(([g]) => TMDB_GENRES[media][g]).filter(Boolean);
    let discovered = [];
    if (ids.length) {
      try {
        discovered = await this.tmdbList(`/discover/${media}`, {
          with_genres: ids.join("|"),
          sort_by: "popularity.desc",
          "vote_average.gte": "6.8",
          "vote_count.gte": "300",
        });
      } catch (err) {
        discovered = [];
      }
    }
    const results = await Promise.all(jobs);

    const scored = new Map();
    const bump = (item, add, reason) => {
      if (!item || libIds.has(item.id) || !item.poster_path) return;
      let s = scored.get(item.id);
      if (!s) {
        s = { item, score: 0, reasons: [] };
        scored.set(item.id, s);
      }
      s.score += add;
      if (reason) s.reasons.push(reason);
    };
    results.forEach(({ seed, w, recs }) =>
      recs.forEach((item, i) => bump(item, w * (1 + (recs.length - i) / (recs.length * 4)), { seed, w }))
    );
    discovered.forEach((item) => bump(item, 0.6, null));

    const picks = [...scored.values()]
      .map((s) => {
        const gnames = (s.item.genre_ids || []).map((id) => TMDB_GENRE_NAMES[media][id]).filter(Boolean);
        const overlap = gnames.reduce((n, g) => n + (genreWeight[g] || 0) / maxGW, 0);
        const quality = Math.max(0, ((s.item.vote_average || 0) - 6) * 0.35);
        const best = s.reasons.sort((a, b) => b.w - a.w)[0];
        let reason = "";
        if (best) reason = `Because you ${parseFloat(best.seed.myRating) >= 7 ? "loved" : "watched"} ${nameOf(best.seed)}`;
        else {
          const g = gnames.find((x) => genreWeight[x]);
          reason = g ? `Matches your taste in ${g}` : "Popular with viewers like you";
        }
        return { ...s.item, _score: s.score + overlap * 0.5 + quality, _reason: reason };
      })
      .filter((x) => (x.vote_count || 0) >= 40)
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);

    // a second row from the single strongest title
    const top = results.find((r) => r.recs.length);
    const because = top
      ? {
          name: nameOf(top.seed),
          loved: parseFloat(top.seed.myRating) >= 7,
          picks: top.recs.filter((x) => !libIds.has(x.id) && x.poster_path).slice(0, 14),
        }
      : null;
    return { empty: false, picks, because, topGenres: topGenres.slice(0, 3).map(([g]) => g) };
  }

  async addFromDiscover(item, media) {
    const title = discoverTitle(item, media);
    const year = (discoverDate(item, media) || "????").slice(0, 4);
    if (media === "movie") {
      const details = await this.fetchMovieDetails(item.id, {
        title,
        year,
        poster_path: item.poster_path,
        rating: (item.vote_average || 0).toFixed(1),
      });
      await this.addMovie(details);
    } else {
      const details = await this.fetchShowDetails(item.id, {
        name: title,
        year,
        poster_path: item.poster_path,
        rating: (item.vote_average || 0).toFixed(1),
      });
      await this.addShow(details);
    }
  }

  // ---- Discover: UI ----
  async renderDiscoverSection(el, stateKey) {
    this.discoverStates = this.discoverStates || new Map();
    let state = this.discoverStates.get(stateKey);
    if (!state) {
      state = { media: "movie" };
      this.discoverStates.set(stateKey, state);
    }

    const headerWrap = el.createDiv({ cls: "movie-gallery-header-wrap" });
    const headerTop = headerWrap.createDiv({ cls: "movie-gallery-header-top" });
    headerTop.createDiv({ cls: "movie-gallery-heading", text: "✨ Discover" });
    this.buildTabBar(headerTop, stateKey, "discover");

    const bar = headerWrap.createDiv({ cls: "mg-discover-bar" });
    const seg = bar.createDiv({ cls: "movie-gallery-segmented" });
    [["movie", "Movies"], ["tv", "TV Shows"]].forEach(([value, label]) => {
      const b = seg.createEl("button", { cls: "movie-gallery-segment", text: label });
      b.toggleClass("selected", state.media === value);
      b.addEventListener("click", () => {
        state.media = value;
        this.renderGallery(stateKey);
      });
    });
    bar.createDiv({ cls: "mg-discover-hint", text: "Powered by TMDB" });
    const refresh = bar.createEl("button", { cls: "mg-discover-refresh", attr: { "aria-label": "Refresh" } });
    refresh.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg><span>Refresh</span>';
    refresh.addEventListener("click", () => {
      this._discoverCache = new Map();
      this.renderGallery(stateKey);
    });

    const body = el.createDiv({ cls: "mg-discover" });
    if (!this.settings.tmdbApiKey) {
      const empty = body.createDiv({ cls: "mg-discover-empty" });
      empty.createDiv({ cls: "mg-discover-empty-title", text: "Add your TMDB API key to start discovering" });
      empty.createDiv({ cls: "mg-discover-empty-sub", text: "Open Settings → TerroTrack and paste your key. Trending, new releases, upcoming titles and personal picks will appear here." });
      return;
    }

    const media = state.media;
    const library = media === "movie" ? await this.readMovies() : await this.readShows();
    const libIds = new Set(library.map((e) => e.id));
    const rows = [];
    const addRow = (title, subtitle, load, opts = {}) => {
      const host = body.createDiv({ cls: "mg-row" });
      rows.push(this.buildDiscoverRow(host, { title, subtitle, media, libIds, load, ...opts }));
    };

    addRow("Picked for you", "Based on what you've rated and watched", () => this._forYou(media), { kind: "foryou" });
    addRow("Trending this week", "What everyone is watching", () => this.discoverFeed(media, "trending"));
    addRow(media === "movie" ? "In theaters now" : "On the air", media === "movie" ? "New releases" : "Currently airing new episodes", () => this.discoverFeed(media, "new"), { showDate: false });
    addRow("Coming soon", media === "movie" ? "Upcoming releases" : "New series on the way", () => this.discoverFeed(media, "upcoming"), { showDate: true });
  }

  async _forYou(media) {
    this._forYouCache = this._forYouCache || new Map();
    const hit = this._forYouCache.get(media);
    if (hit && Date.now() - hit.t < DISCOVER_TTL) return hit.data;
    const data = await this.discoverForYou(media);
    this._forYouCache.set(media, { t: Date.now(), data });
    return data;
  }

  buildDiscoverRow(host, cfg) {
    const { title, subtitle, media, libIds, load, showDate, kind } = cfg;
    const head = host.createDiv({ cls: "mg-row-head" });
    const titles = head.createDiv({ cls: "mg-row-titles" });
    titles.createDiv({ cls: "mg-row-title", text: title });
    titles.createDiv({ cls: "mg-row-sub", text: subtitle });
    const arrows = head.createDiv({ cls: "mg-row-arrows" });
    const left = arrows.createEl("button", { cls: "mg-row-arrow", attr: { "aria-label": "Scroll left" } });
    left.innerHTML = fsvg('<path d="m15 6-6 6 6 6"/>', 16);
    const right = arrows.createEl("button", { cls: "mg-row-arrow", attr: { "aria-label": "Scroll right" } });
    right.innerHTML = fsvg('<path d="m9 6 6 6-6 6"/>', 16);

    const track = host.createDiv({ cls: "mg-row-track" });
    const by = (dir) => track.scrollBy({ left: dir * Math.round(track.clientWidth * 0.85), behavior: "smooth" });
    left.addEventListener("click", () => by(-1));
    right.addEventListener("click", () => by(1));

    for (let i = 0; i < 8; i++) track.createDiv({ cls: "mg-card is-skeleton" });

    const fill = (items, extra) => {
      track.empty();
      if (!items.length) {
        track.createDiv({ cls: "mg-row-empty", text: extra || "Nothing to show right now." });
        arrows.addClass("is-hidden");
        return;
      }
      items.forEach((item) => this.buildDiscoverCard(track, item, { media, libIds, showDate, reason: item._reason }));
    };

    Promise.resolve()
      .then(load)
      .then((res) => {
        if (!host.isConnected) return;
        if (kind === "foryou") {
          if (res.empty) {
            return fill([], "Rate or watch a few titles and your personal picks will show up here.");
          }
          const g = res.topGenres && res.topGenres.length ? `Leaning ${res.topGenres.join(" · ")}` : "";
          if (g) titles.querySelector(".mg-row-sub").setText(g);
          fill(res.picks, "No fresh recommendations yet — try again after rating a few more titles.");
          if (res.because && res.because.picks.length) {
            const extra = host.parentElement.createDiv({ cls: "mg-row" });
            host.after(extra);
            this.buildDiscoverRow(extra, {
              title: `Because you ${res.because.loved ? "loved" : "watched"} ${res.because.name}`,
              subtitle: "More like it",
              media, libIds, showDate: false,
              load: () => res.because.picks,
            });
          }
          return;
        }
        fill(res);
      })
      .catch((err) => {
        console.error("TerroTrack: discover failed", err);
        if (!host.isConnected) return;
        fill([], "Couldn't load this right now. Check your TMDB key and connection, then hit Refresh.");
      });
  }

  buildDiscoverCard(track, item, opts) {
    const { media, libIds, showDate, reason } = opts;
    const title = discoverTitle(item, media);
    const date = discoverDate(item, media);
    const card = track.createDiv({ cls: "mg-card", attr: { tabindex: "0", role: "button", "aria-label": title } });
    const poster = card.createDiv({ cls: "mg-card-poster" });
    if (item.poster_path) poster.createEl("img", { attr: { src: `${POSTER_BASE}${item.poster_path}`, alt: title, loading: "lazy" } });
    else poster.createDiv({ cls: "mg-card-noposter", text: title });
    if (item.vote_average) poster.createSpan({ cls: "mg-card-rating", text: `★ ${item.vote_average.toFixed(1)}` });

    const badge = poster.createDiv({ cls: "mg-card-add" });
    const markAdded = () => {
      badge.empty();
      badge.setText("✓");
      badge.addClass("is-added");
      badge.setAttribute("aria-label", "In your library");
    };
    if (libIds.has(item.id)) markAdded();
    else {
      badge.setText("+");
      badge.setAttribute("aria-label", "Add to library");
      badge.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (badge.classList.contains("is-added") || badge.classList.contains("is-busy")) return;
        badge.addClass("is-busy");
        badge.setText("…");
        try {
          await this.addFromDiscover(item, media);
          libIds.add(item.id);
          markAdded();
        } catch (err) {
          console.error(err);
          badge.setText("+");
        }
        badge.removeClass("is-busy");
      });
    }

    card.createDiv({ cls: "mg-card-title", text: title });
    const meta = [];
    if (showDate && date) meta.push(formatShortDate(date));
    else if (date) meta.push(date.slice(0, 4));
    if (meta.length) card.createDiv({ cls: "mg-card-meta", text: meta.join(" · ") });
    if (reason) card.createDiv({ cls: "mg-card-reason", text: reason });

    const open = () => new DiscoverModal(this.app, this, item, media, libIds, markAdded, reason).open();
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") open();
    });
    return card;
  }

  // Heart on a poster: shows when favourited, appears on hover otherwise.
  buildFavBadge(parent, entry, save, isTv = false) {
    const btn = parent.createEl("button", {
      cls: "mg-fav-btn" + (isTv ? " is-tv" : "") + (entry.favorite ? " is-on" : ""),
      attr: { "aria-label": entry.favorite ? "Remove from favourites" : "Add to favourites", "aria-pressed": String(!!entry.favorite) },
    });
    btn.innerHTML = HEART_SVG;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      entry.favorite = !entry.favorite;
      btn.toggleClass("is-on", entry.favorite);
      await save();
    });
    return btn;
  }

  // Toolbar toggle: show only favourites.
  buildFavToggle(group, state, items, rerender) {
    const n = items.filter((x) => x.favorite).length;
    const btn = group.createEl("button", {
      cls: "movie-gallery-group-btn mg-fav-filter" + (state.favOnly ? " is-on" : ""),
      attr: { "aria-label": state.favOnly ? "Showing favourites only" : "Show favourites only", "aria-pressed": String(!!state.favOnly), title: "Favourites" },
    });
    btn.innerHTML = HEART_SVG;
    if (n) btn.createSpan({ cls: "mg-fav-count", text: String(n) });
    btn.addEventListener("click", () => {
      state.favOnly = !state.favOnly;
      rerender();
    });
    return btn;
  }

  buildTabBar(parent, stateKey, active) {
    const counts = this._tabCounts || {};
    const icons = {
      movies: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/></svg>',
      tv: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/></svg>',
      discover: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/></svg>',
    };
    const bar = parent.createDiv({ cls: "mg-tabs", attr: { role: "tablist" } });
    [["movies", "Movies"], ["tv", "TV Shows"], ["discover", "Discover"]].forEach(([key, label]) => {
      const b = bar.createEl("button", {
        cls: "mg-tab" + (key === active ? " active" : ""),
        attr: { role: "tab", "aria-selected": String(key === active) },
      });
      b.createSpan({ cls: "mg-tab-icon" }).innerHTML = icons[key];
      b.createSpan({ cls: "mg-tab-label", text: label });
      if (counts[key] != null) b.createSpan({ cls: "mg-tab-count", text: String(counts[key]) });
      b.addEventListener("click", () => {
        if (key === active) return;
        this.activeTabByEl.set(stateKey, key);
        this.renderGallery(stateKey);
      });
    });
    return bar;
  }

  async renderGallery(el) {
    if (!this.activeTabByEl) this.activeTabByEl = new Map();
    const activeTab = this.activeTabByEl.get(el) || "movies";

    el.empty();
    el.addClass("movie-gallery-block");

    const sectionEl = el.createDiv();

    this._tabCounts = { movies: (await this.readMovies()).length, tv: (await this.readShows()).length };

    if (activeTab === "discover") {
      await this.renderDiscoverSection(sectionEl, el);
    } else if (activeTab === "tv") {
      await this.renderTvSection(sectionEl, el);
    } else {
      await this.renderMovieSection(sectionEl, el);
    }
  }

  async renderMovieSection(el, stateKey) {
    let state = this.galleryStates.get(stateKey);
    if (!state) {
      state = {
        search: "", filter: "all", genres: [], languages: [],
        years: [], sortField: "added", sortDir: "desc",
        ratings: [], myRatings: [],
      };
      this.galleryStates.set(stateKey, state);
    }

    el.empty();
    el.addClass("movie-gallery-block");

    const allMovies = await this.readMovies();

    const genreOptions = Array.from(
      new Set(allMovies.flatMap((m) => (m.genres || "").split(",").map((g) => g.trim()).filter(Boolean)))
    ).sort();

    const languageOptions = Array.from(
      new Set(allMovies.map((m) => this.normalizeLanguageCode(m.original_language)).filter(Boolean))
    ).sort();

    const yearOptions = Array.from(new Set(allMovies.map((m) => m.year).filter(Boolean))).sort(
      (a, b) => b.localeCompare(a)
    );

    // ---- Row 1: heading (left) + tabs (right) ----
    const headerWrap = el.createDiv({ cls: "movie-gallery-header-wrap" });

    const headerTop = headerWrap.createDiv({ cls: "movie-gallery-header-top" });
    headerTop.createDiv({ cls: "movie-gallery-heading", text: "🎬 Movie Library" });

    this.buildTabBar(headerTop, stateKey, "movies");

    // ---- Row 2: toolbar ----
    const toolbar = headerWrap.createDiv({ cls: "movie-gallery-toolbar" });

    const leftCluster = toolbar.createDiv({ cls: "movie-gallery-toolbar-left" });

    const searchInput = leftCluster.createEl("input", {
      type: "text",
      cls: "movie-gallery-search",
      attr: { placeholder: "Search title, director, or cast..." },
    });
    searchInput.value = state.search;
    this.attachSearchClear(searchInput);
    searchInput.setAttribute("placeholder", this.searchPlaceholder("director"));

    let movieSearchDebounce = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(movieSearchDebounce);
      movieSearchDebounce = setTimeout(() => {
        state.search = searchInput.value;
        renderGrid();
      }, 200);
    });

    const statusRow = leftCluster.createDiv({ cls: "movie-gallery-segmented" });
    [
      ["all", "All"],
      ["unwatched", "To Watch"],
      ["watching", "Watching"],
      ["watched", "Watched"],
      ["dropped", "Trashed"],
    ].forEach(([value, label]) => {
      const seg = statusRow.createEl("button", { cls: "movie-gallery-segment", text: label });
      seg.toggleClass("selected", state.filter === value);
      seg.addEventListener("click", () => {
        state.filter = value;
        this.renderMovieSection(el, stateKey);
      });
    });

    const sortFieldOptions = [
      ["added", "Recently added"],
      ["title", "Title"],
      ["year", "Year"],
      ["rating", "Rating"],
      ["runtime", "Runtime"],
    ];

    const yearBounds = yearOptions.length ? [yearOptions[yearOptions.length - 1], yearOptions[0]] : null;
    const yearCounts = {};
    allMovies.forEach((x) => {
      if (x.year) yearCounts[x.year] = (yearCounts[x.year] || 0) + 1;
    });

    const filterFields = [
      { key: "genre", type: "genre", label: "Genre", options: genreOptions, badge: (s) => s.genres.length || null },
      { key: "year", type: "years", label: "Year", stateKey: "years", bounds: yearBounds, counts: yearCounts, badge: (s) => countYearRuns(s.years) || null },
      { key: "language", type: "choice", stateKey: "languages", label: "Language", options: languageOptions.map((c) => [c, this.languageName(c)]), badge: (s) => (s.languages || []).length || null },
      { key: "rating", type: "ratingCombined", label: "Rating", badge: (s) => s.ratings.length + s.myRatings.length || null },
    ];

    const activeFilterCount =
      state.genres.length +
      (state.languages || []).length +
      countYearRuns(state.years) +
      state.ratings.length +
      state.myRatings.length;

    const summarizeMovies = (s) => {
      const bits = [];
      bits.push(s.genres.length ? `${s.genres.join(", ")} titles` : "Every title in your library");
      const clauses = [];
      if ((s.years || []).length) clauses.push(`released in ${describeYears(s.years)}`);
      if ((s.languages || []).length) clauses.push(`in ${s.languages.map((c) => this.languageName(c)).join(" or ")}`);
      if (s.ratings.length) clauses.push(`rated ${[...s.ratings].sort((a, b) => b - a).join(", ")} on TMDB`);
      if (s.myRatings.length) clauses.push(`that you personally rated ${[...s.myRatings].sort((a, b) => b - a).join(", ")}`);
      if (!s.genres.length && !clauses.length) return "Nothing narrowed down yet — you're seeing your whole library.";
      let sentence = bits[0];
      if (clauses.length) sentence += ", " + clauses.join(", ");
      return sentence + ".";
    };

    // ---- Sort (standalone) ----
    const sortGroup = leftCluster.createDiv({ cls: "movie-gallery-sort-group" });

    const sortSelect = sortGroup.createEl("select", { cls: "movie-gallery-sort-select" });
    sortFieldOptions.forEach(([value, label]) => {
      const opt = sortSelect.createEl("option", { text: label, attr: { value } });
      if (state.sortField === value) opt.selected = true;
    });
    sortSelect.value = state.sortField;
    sortSelect.addEventListener("change", () => {
      state.sortField = sortSelect.value;
      renderGrid();
    });

    const sortDirBtn = sortGroup.createEl("button", {
      cls: "movie-gallery-group-btn",
      attr: { "aria-label": state.sortDir === "asc" ? "Ascending" : "Descending" },
    });
    sortDirBtn.innerHTML = sortDirIcon(state.sortDir);
    sortDirBtn.addEventListener("click", () => {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      this.renderMovieSection(el, stateKey);
    });

    // ---- Grouped: filter | stats | settings ----
    const toolsGroup = leftCluster.createDiv({ cls: "movie-gallery-view-group" });

    this.buildFavToggle(toolsGroup, state, allMovies, () => this.renderMovieSection(el, stateKey));

    const filterBtn = toolsGroup.createEl("button", {
      cls: "movie-gallery-group-btn movie-gallery-group-btn-with-label",
      attr: { "aria-label": "Filters" },
    });
    filterBtn.innerHTML = `${FILTER_ICON_SVG}<span>Filter</span>`;
    if (activeFilterCount) filterBtn.createSpan({ cls: "movie-gallery-icon-badge", text: String(activeFilterCount) });
    filterBtn.addEventListener("click", () => {
      new FilterModal(this.app, {
        state,
        fields: filterFields,
        activeKey: "genre",
        summarize: summarizeMovies,
        count: () => this.filterAndSort(allMovies, state).length,
        onChange: () => this.renderMovieSection(el, stateKey),
        onClear: () => {
          Object.assign(state, {
            genres: [], languages: [], years: [],
            ratings: [], myRatings: [],
          });
        },
      }).open();
    });

    const statsBtn = toolsGroup.createEl("button", {
      cls: "movie-gallery-group-btn movie-gallery-group-btn-with-label",
      attr: { "aria-label": "Library stats" },
    });
    statsBtn.innerHTML = `${STATS_ICON_SVG}<span>Stats</span>`;
    statsBtn.addEventListener("click", () => new StatsModal(this.app, this, stateKey).open());

    const settingsBtn = toolsGroup.createEl("button", {
      cls: "movie-gallery-group-btn movie-gallery-group-btn-with-label",
      attr: { "aria-label": "Gallery settings" },
    });
    settingsBtn.innerHTML = `${SETTINGS_ICON_SVG}<span>Settings</span>`;
    settingsBtn.addEventListener("click", () => new GallerySettingsModal(this.app, this).open());

    // ---- Right edge: Add button ----
    const rightCluster = toolbar.createDiv({ cls: "movie-gallery-toolbar-right" });

    const addBtn = makeAddButton(rightCluster, "Add Movie");
    addBtn.addEventListener("click", () => new AddMovieModal(this.app, this).open());

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
        grid.createDiv({ cls: "movie-gallery-empty", text: "No movies yet. Click \"+ Add Movie\" to search TMDB." });
        return;
      }
      if (!movies.length) {
        grid.createDiv({ cls: "movie-gallery-empty", text: "No movies match your search/filter." });
        return;
      }

      const f = this.settings.cardFields;
      const visibleMovies = movies.slice(0, movieVisibleCount);

      for (const m of visibleMovies) {
        const card = grid.createDiv({ cls: "movie-gallery-card" + (m.watched ? " watched" : "") + ` status-${statusOf(m)}` });
        const posterWrap = card.createDiv({ cls: "movie-gallery-poster-wrap" });
        const posterUrl = getPosterUrl(m);
        const posterImg = posterWrap.createEl("img", { attr: { src: posterUrl, alt: m.title, loading: "lazy" } });

        if (f.rating && m.rating) {
          posterWrap.createSpan({ cls: "movie-gallery-poster-badge movie-gallery-poster-badge-rating", text: `★ ${m.rating}` });
        }

        if (f.status && statusOf(m) !== "unwatched") {
          const st = statusOf(m);
          posterWrap.createSpan({ cls: `movie-gallery-poster-badge movie-gallery-poster-badge-${st}`, text: STATUS_BADGE[st], attr: { title: (STATUS_OPTIONS.find((o) => o[0] === st) || [])[1] } });
        }
        if (f.favorite !== false) this.buildFavBadge(posterWrap, m, () => this.updateMovie(m));

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

        if (f.myRating && m.myRating) metaLine(`Me: ${m.myRating}`);
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
        search: "", filter: "all", genres: [], languages: [],
        years: [], sortField: "added", sortDir: "desc",
        ratings: [], myRatings: [], showStatuses: [],
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
      new Set(allShows.map((s) => this.normalizeLanguageCode(s.original_language)).filter(Boolean))
    ).sort();
    const yearOptions = Array.from(new Set(allShows.map((s) => s.year).filter(Boolean))).sort((a, b) =>
      b.localeCompare(a)
    );

    // ---- Row 1: heading + tabs ----
    const headerWrap = el.createDiv({ cls: "movie-gallery-header-wrap" });

    const headerTop = headerWrap.createDiv({ cls: "movie-gallery-header-top" });
    headerTop.createDiv({ cls: "movie-gallery-heading", text: "📺 TV Library" });

    this.buildTabBar(headerTop, stateKey, "tv");

    // ---- Row 2: toolbar ----
    const toolbar = headerWrap.createDiv({ cls: "movie-gallery-toolbar" });

    const leftCluster = toolbar.createDiv({ cls: "movie-gallery-toolbar-left" });

    const searchInput = leftCluster.createEl("input", {
      type: "text",
      cls: "movie-gallery-search",
      attr: { placeholder: "Search title, creator, or cast..." },
    });
    searchInput.value = state.search;
    this.attachSearchClear(searchInput);
    searchInput.setAttribute("placeholder", this.searchPlaceholder("creator"));

    let tvSearchDebounce = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(tvSearchDebounce);
      tvSearchDebounce = setTimeout(() => {
        state.search = searchInput.value;
        renderGrid();
      }, 200);
    });

    const statusRow = leftCluster.createDiv({ cls: "movie-gallery-segmented" });
    [
      ["all", "All"],
      ["unwatched", "To Watch"],
      ["watching", "Watching"],
      ["watched", "Watched"],
      ["dropped", "Trashed"],
    ].forEach(([value, label]) => {
      const seg = statusRow.createEl("button", { cls: "movie-gallery-segment", text: label });
      seg.toggleClass("selected", state.filter === value);
      seg.addEventListener("click", () => {
        state.filter = value;
        this.renderTvSection(el, stateKey);
      });
    });

    const sortFieldOptions = [
      ["added", "Recently added"],
      ["title", "Title"],
      ["year", "Year"],
      ["rating", "Rating"],
      ["runtime", "Runtime"],
    ];

    const yearBounds = yearOptions.length ? [yearOptions[yearOptions.length - 1], yearOptions[0]] : null;
    const yearCounts = {};
    allShows.forEach((x) => {
      if (x.year) yearCounts[x.year] = (yearCounts[x.year] || 0) + 1;
    });

    const seriesCounts = { returning: 0, cancelled: 0, ended: 0 };
    allShows.forEach((s) => {
      const k = normalizeSeriesStatus(s.show_status);
      if (k) seriesCounts[k]++;
    });
    const seriesOptions = [
      ["returning", "Returning", seriesCounts.returning],
      ["cancelled", "Cancelled", seriesCounts.cancelled],
      ["ended", "Ended", seriesCounts.ended],
    ];

    const filterFields = [
      { key: "genre", type: "genre", label: "Genre", options: genreOptions, badge: (s) => s.genres.length || null },
      { key: "year", type: "years", label: "Year", stateKey: "years", bounds: yearBounds, counts: yearCounts, badge: (s) => countYearRuns(s.years) || null },
      { key: "language", type: "choice", stateKey: "languages", label: "Language", options: languageOptions.map((c) => [c, this.languageName(c)]), badge: (s) => (s.languages || []).length || null },
      { key: "rating", type: "ratingCombined", label: "Rating", badge: (s) => s.ratings.length + s.myRatings.length || null },
      { key: "series", type: "choice", stateKey: "showStatuses", label: "Series", options: seriesOptions, badge: (s) => (s.showStatuses || []).length || null },
    ];

    const activeFilterCount =
      state.genres.length +
      (state.languages || []).length +
      countYearRuns(state.years) +
      state.ratings.length +
      state.myRatings.length +
      (state.showStatuses || []).length;

    const summarizeShows = (s) => {
      const bits = [];
      bits.push(s.genres.length ? `${s.genres.join(", ")} shows` : "Every show in your library");
      const clauses = [];
      if ((s.years || []).length) clauses.push(`released in ${describeYears(s.years)}`);
      if ((s.languages || []).length) clauses.push(`in ${s.languages.map((c) => this.languageName(c)).join(" or ")}`);
      if (s.ratings.length) clauses.push(`rated ${[...s.ratings].sort((a, b) => b - a).join(", ")} on TMDB`);
      if (s.myRatings.length) clauses.push(`that you personally rated ${[...s.myRatings].sort((a, b) => b - a).join(", ")}`);
      if ((s.showStatuses || []).length) {
        const names = { returning: "still returning", cancelled: "cancelled", ended: "ended" };
        clauses.push(`that are ${s.showStatuses.map((k) => names[k]).join(" or ")}`);
      }
      if (!s.genres.length && !clauses.length) return "Nothing narrowed down yet — you're seeing your whole library.";
      let sentence = bits[0];
      if (clauses.length) sentence += ", " + clauses.join(", ");
      return sentence + ".";
    };

    // ---- Sort (standalone) ----
    const sortGroup = leftCluster.createDiv({ cls: "movie-gallery-sort-group" });

    const sortSelect = sortGroup.createEl("select", { cls: "movie-gallery-sort-select" });
    sortFieldOptions.forEach(([value, label]) => {
      const opt = sortSelect.createEl("option", { text: label, attr: { value } });
      if (state.sortField === value) opt.selected = true;
    });
    sortSelect.value = state.sortField;
    sortSelect.addEventListener("change", () => {
      state.sortField = sortSelect.value;
      renderGrid();
    });

    const sortDirBtn = sortGroup.createEl("button", {
      cls: "movie-gallery-group-btn",
      attr: { "aria-label": state.sortDir === "asc" ? "Ascending" : "Descending" },
    });
    sortDirBtn.innerHTML = sortDirIcon(state.sortDir);
    sortDirBtn.addEventListener("click", () => {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      this.renderTvSection(el, stateKey);
    });

    // ---- Grouped: filter | stats | settings ----
    const toolsGroup = leftCluster.createDiv({ cls: "movie-gallery-view-group" });

    this.buildFavToggle(toolsGroup, state, allShows, () => this.renderTvSection(el, stateKey));

    const filterBtn = toolsGroup.createEl("button", {
      cls: "movie-gallery-group-btn movie-gallery-group-btn-with-label",
      attr: { "aria-label": "Filters" },
    });
    filterBtn.innerHTML = `${FILTER_ICON_SVG}<span>Filter</span>`;
    if (activeFilterCount) filterBtn.createSpan({ cls: "movie-gallery-icon-badge", text: String(activeFilterCount) });
    filterBtn.addEventListener("click", () => {
      new FilterModal(this.app, {
        state,
        fields: filterFields,
        activeKey: "genre",
        summarize: summarizeShows,
        count: () => allShows.filter(matchesShow).length,
        onChange: () => this.renderTvSection(el, stateKey),
        onClear: () => {
          Object.assign(state, {
            genres: [], languages: [], years: [],
            ratings: [], myRatings: [], showStatuses: [],
          });
        },
      }).open();
    });

    const statsBtn = toolsGroup.createEl("button", {
      cls: "movie-gallery-group-btn movie-gallery-group-btn-with-label",
      attr: { "aria-label": "TV stats" },
    });
    statsBtn.innerHTML = `${STATS_ICON_SVG}<span>Stats</span>`;
    statsBtn.addEventListener("click", () => new TvStatsModal(this.app, this, stateKey).open());

    const settingsBtn = toolsGroup.createEl("button", {
      cls: "movie-gallery-group-btn movie-gallery-group-btn-with-label",
      attr: { "aria-label": "TV gallery settings" },
    });
    settingsBtn.innerHTML = `${SETTINGS_ICON_SVG}<span>Settings</span>`;
    settingsBtn.addEventListener("click", () => new TvGallerySettingsModal(this.app, this).open());

    // ---- Right edge: Add button ----
    const rightCluster = toolbar.createDiv({ cls: "movie-gallery-toolbar-right" });

    const addBtn = makeAddButton(rightCluster, "Add Show");
    addBtn.addEventListener("click", () => new AddShowModal(this.app, this).open());

    const countEl = el.createDiv({ cls: "movie-gallery-count" });
    const grid = el.createDiv({ cls: "movie-gallery-grid" });

    const CARD_SIZE_PX = { small: 110, medium: 140, large: 180 };
    if (this.settings.tvCardsPerRow && this.settings.tvCardsPerRow !== "auto") {
      grid.style.gridTemplateColumns = `repeat(${this.settings.tvCardsPerRow}, 1fr)`;
    } else {
      const px = CARD_SIZE_PX[this.settings.tvCardSize] || 140;
      grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${px}px, 1fr))`;
    }

    const matchesShow = (s) => {
      const q = state.search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        titleMatches(s.name, q) ||
        (this.settings.searchDirector !== false && (s.creators || "").toLowerCase().includes(q)) ||
        (this.settings.searchCast !== false && (s.cast || "").toLowerCase().includes(q));
      const matchesFilter =
        state.filter === "all" || statusOf(s) === state.filter;
      const matchesGenre =
        state.genres.length === 0 ||
        (s.genres || "").split(",").map((g) => g.trim()).some((g) => state.genres.includes(g));
      const matchesLanguage =
        !(state.languages || []).length || state.languages.includes(this.normalizeLanguageCode(s.original_language));
      const matchesYear = !(state.years || []).length || state.years.includes(String(s.year));
      const matchesRating =
        state.ratings.length === 0 || state.ratings.includes(Math.floor(parseFloat(s.rating || 0)));
      const matchesMyRating =
        state.myRatings.length === 0 ||
        (s.myRating !== "" && s.myRating != null && state.myRatings.includes(parseInt(s.myRating, 10)));
      const matchesSeries =
        !(state.showStatuses || []).length || state.showStatuses.includes(normalizeSeriesStatus(s.show_status));
      return matchesSearch && matchesFilter && matchesGenre && matchesLanguage && matchesYear && matchesRating && matchesMyRating && matchesSeries && (!state.favOnly || !!s.favorite);
    };

    let tvVisibleCount = 60;
    const renderGrid = (preserveCount) => {
      if (!preserveCount) tvVisibleCount = 60;
      grid.empty();
      const q = state.search.trim().toLowerCase();
      let shows = allShows.filter(matchesShow);

      const dir = state.sortDir === "asc" ? 1 : -1;
      switch (state.sortField) {
        case "title": shows.sort((a, b) => a.name.localeCompare(b.name) * dir); break;
        case "year": shows.sort((a, b) => (a.year || "").localeCompare(b.year || "") * dir); break;
        case "rating": shows.sort((a, b) => (parseFloat(a.rating || 0) - parseFloat(b.rating || 0)) * dir); break;
        case "runtime": shows.sort((a, b) => ((a.episode_runtime || 0) - (b.episode_runtime || 0)) * dir); break;
        case "added":
        default:
          shows = state.sortDir === "asc" ? shows.slice() : shows.slice().reverse();
      }

      if (q) shows = rankSearchResults(shows, q, (s) => s.name, !state.sortField || state.sortField === "added");

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
        const card = grid.createDiv({ cls: "movie-gallery-card" + (s.watched ? " watched" : "") + ` status-${statusOf(s)}` });
        const posterWrap = card.createDiv({ cls: "movie-gallery-poster-wrap" });
        const posterUrl = getPosterUrl(s);
        const posterImg = posterWrap.createEl("img", { attr: { src: posterUrl, alt: s.name, loading: "lazy" } });

        if (f.rating && s.rating) {
          posterWrap.createSpan({ cls: "movie-gallery-poster-badge movie-gallery-poster-badge-rating", text: `★ ${s.rating}` });
        }

        if (f.status && statusOf(s) !== "unwatched") {
          const st = statusOf(s);
          posterWrap.createSpan({ cls: `movie-gallery-poster-badge movie-gallery-poster-badge-${st}`, text: STATUS_BADGE[st], attr: { title: (STATUS_OPTIONS.find((o) => o[0] === st) || [])[1] } });
        }
        if (f.favorite !== false) this.buildFavBadge(posterWrap, s, () => this.updateShow(s), true);

        const totalSeasons = s.number_of_seasons || 0;
        const totalEps = s.number_of_episodes || 0;
        const prog = getShowProgress(s);
        const watchedSeasons = Math.min(prog.seasons, totalSeasons || Infinity);
        const watchedEps = Math.min(prog.episodes, totalEps || Infinity);
        const showSeasons = f.seasons && totalSeasons;
        const showEpisodes = f.episodes && totalEps;
        if (showSeasons || showEpisodes) {
          const footer = posterWrap.createDiv({ cls: "movie-gallery-poster-footer" });
          const parts = [];
          if (showSeasons) parts.push(`${watchedSeasons}/${totalSeasons} season${totalSeasons === 1 ? "" : "s"}`);
          if (showEpisodes) parts.push(`${watchedEps}/${totalEps} eps`);
          footer.createDiv({ cls: "movie-gallery-poster-pill", text: parts.join(" · ") });

          // one bar: episode progress (falls back to seasons when episodes are hidden)
          const barRatio = showEpisodes ? watchedEps / totalEps : watchedSeasons / totalSeasons;
          const bars = footer.createDiv({ cls: "movie-gallery-poster-bars" });
          const track = bars.createDiv({ cls: "movie-gallery-poster-progress" });
          track.createDiv({ cls: "movie-gallery-poster-progress-fill" }).style.width =
            `${Math.min(100, barRatio * 100)}%`;
        }

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

        if (f.myRating && s.myRating) metaLine(`Me: ${s.myRating}`);
        if (f.genres) metaLine(s.genres);
        if (f.director) metaLine(s.creators);
        if (f.cast) metaLine(s.cast);
        if (f.release_date) metaLine(this.formatDate(s.first_air_date));
        if (f.runtime) metaLine(this.formatRuntime(s.episode_runtime));
        if (f.language) metaLine(this.languageName(s.original_language));
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

const fsvg = (inner, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const FILTER_META = {
  genre: { icon: fsvg('<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"/><path d="M7 7h.01"/>'), desc: "Show titles that match any of the genres you pick." },
  year: { icon: fsvg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'), desc: "Limit the library to a range of release years." },
  language: { icon: fsvg('<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'), desc: "Original language of the title." },
  rating: { icon: fsvg('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>'), desc: "Pick TMDB scores and your own ratings." },
  runtime: { icon: fsvg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'), desc: "Filter by running time." },
  series: { icon: fsvg('<rect x="2" y="7" width="20" height="15" rx="2"/><path d="m17 2-5 5-5-5"/>'), desc: "Where the series stands today." },
};

class FilterModal extends Modal {
  constructor(app, opts) {
    super(app);
    this.opts = opts;
    this.activeKey = opts.activeKey || opts.fields[0].key;
  }

  onOpen() {
    this.modalEl.addClass("movie-filter-modal-shell");
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("movie-filter-modal");

    const { state, fields, onChange, onClear, summarize, count } = this.opts;
    if (!fields.find((f) => f.key === this.activeKey)) this.activeKey = fields[0].key;
    const totalActive = fields.reduce((n, f) => n + (f.badge ? f.badge(state) || 0 : 0), 0);

    const header = contentEl.createDiv({ cls: "movie-filter-header" });
    header.createEl("h2", { cls: "movie-filter-heading", text: "Filters" });
    header.createSpan({
      cls: "movie-filter-active-pill" + (totalActive ? "" : " is-zero"),
      text: totalActive ? `${totalActive} active` : "None active",
    });

    const layout = contentEl.createDiv({ cls: "movie-filter-layout" });
    const sidebar = layout.createDiv({ cls: "movie-filter-sidebar" });
    const main = layout.createDiv({ cls: "movie-filter-main" });

    fields.forEach((f) => {
      const item = sidebar.createEl("button", { cls: "movie-filter-sidebar-item" });
      item.toggleClass("active", f.key === this.activeKey);
      const meta = FILTER_META[f.key];
      if (meta) item.createSpan({ cls: "movie-filter-sidebar-icon" }).innerHTML = meta.icon;
      item.createSpan({ cls: "movie-filter-sidebar-label", text: f.label });
      const badge = f.badge ? f.badge(state) : null;
      if (badge) item.createSpan({ cls: "movie-filter-sidebar-badge", text: String(badge) });
      item.addEventListener("click", () => {
        this.activeKey = f.key;
        this.render();
      });
    });

    const field = fields.find((f) => f.key === this.activeKey);
    const mainHeader = main.createDiv({ cls: "movie-filter-main-header" });
    const titles = mainHeader.createDiv({ cls: "movie-filter-main-titles" });
    titles.createDiv({ cls: "movie-filter-main-title", text: field.label });
    const desc = FILTER_META[field.key] && FILTER_META[field.key].desc;
    if (desc) titles.createDiv({ cls: "movie-filter-main-desc", text: desc });
    if (field.badge ? field.badge(state) : null) {
      const clearTabBtn = mainHeader.createEl("button", { cls: "movie-filter-clear-tab" });
      clearTabBtn.innerHTML = `${fsvg('<path d="M18 6 6 18M6 6l12 12"/>', 12)}<span>Clear</span>`;
      clearTabBtn.addEventListener("click", () => {
        this.clearField(field, state);
        onChange();
        this.render();
      });
    }

    const body = main.createDiv({ cls: "movie-filter-main-body" });
    this.renderFieldBody(body, field, state, onChange);

    const summary = contentEl.createDiv({ cls: "movie-filter-summary" });
    summary.createSpan({ cls: "movie-filter-summary-icon" }).innerHTML = fsvg('<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>', 14);
    summary.createSpan({ cls: "movie-filter-summary-text", text: summarize(state) });

    const footer = contentEl.createDiv({ cls: "movie-filter-footer" });
    const resetBtn = footer.createEl("button", { cls: "movie-filter-reset-btn" });
    resetBtn.innerHTML = `${fsvg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>', 14)}<span>Reset all</span>`;
    resetBtn.disabled = !totalActive;
    resetBtn.addEventListener("click", () => {
      onClear();
      onChange();
      this.render();
    });
    const n = count ? count() : null;
    const doneBtn = footer.createEl("button", {
      cls: "movie-gallery-add-btn",
      text: n === null ? "Done" : `Show ${n} result${n === 1 ? "" : "s"}`,
    });
    doneBtn.addEventListener("click", () => this.close());
  }

  clearField(field, state) {
    if (field.type === "genre") state.genres = [];
    else if (field.type === "select") state[field.key] = "all";
    else if (field.type === "choice") state[field.stateKey] = [];
    else if (field.type === "ratingBoxes") state[field.key] = [];
    else if (field.type === "years") state[field.stateKey] = [];
    else if (field.type === "ratingCombined") {
      state.ratings = [];
      state.myRatings = [];
    } else if (field.type === "range") {
      state[field.minKey] = "";
      state[field.maxKey] = "";
    }
  }

  renderFieldBody(body, field, state, onChange) {
    const rerender = () => {
      onChange();
      this.render();
    };

    const chip = (row, label, selected, onClick, countText) => {
      const c = row.createEl("button", { cls: "movie-filter-chip" + (selected ? " selected" : "") });
      if (selected) c.createSpan({ cls: "movie-filter-chip-check" }).innerHTML = fsvg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 12);
      c.createSpan({ text: label });
      if (countText != null) c.createSpan({ cls: "movie-filter-chip-count", text: String(countText) });
      c.addEventListener("click", onClick);
      return c;
    };

    if (field.type === "genre") {
      const row = body.createDiv({ cls: "movie-filter-pill-row" });
      field.options.forEach((g) => {
        chip(row, g, state.genres.includes(g), () => {
          state.genres = state.genres.includes(g) ? state.genres.filter((x) => x !== g) : [...state.genres, g];
          rerender();
        });
      });
    }

    if (field.type === "choice") {
      const row = body.createDiv({ cls: "movie-filter-pill-row" });
      const cur = state[field.stateKey] || [];
      field.options.forEach(([value, label, n]) => {
        chip(row, label, cur.includes(value), () => {
          state[field.stateKey] = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
          rerender();
        }, n);
      });
    }

    if (field.type === "select") {
      const select = body.createEl("select", { cls: "movie-gallery-filter" });
      select.createEl("option", { text: field.allLabel, attr: { value: "all" } });
      field.options.forEach((opt) => {
        const optLabel = field.format ? field.format(opt) : String(opt);
        const o = select.createEl("option", { text: optLabel, attr: { value: String(opt) } });
        if (state[field.key] === String(opt)) o.selected = true;
      });
      select.value = state[field.key];
      select.addEventListener("change", () => {
        state[field.key] = select.value;
        rerender();
      });
    }

    const renderRatingRow = (parent, key, max) => {
      const row = parent.createDiv({ cls: "movie-filter-rating-grid" });
      for (let v = max; v >= 1; v--) {
        const box = row.createEl("button", { cls: "movie-rating-option movie-filter-rating-box", text: String(v) });
        box.toggleClass("selected", state[key].includes(v));
        box.addEventListener("click", () => {
          state[key] = state[key].includes(v) ? state[key].filter((x) => x !== v) : [...state[key], v];
          rerender();
        });
      }
    };

    if (field.type === "ratingBoxes") {
      renderRatingRow(body, field.key, field.max);
    }

    if (field.type === "ratingCombined") {
      body.createDiv({ cls: "movie-filter-subsection-label", text: "TMDB Rating" });
      renderRatingRow(body, "ratings", 9);
      body.createDiv({ cls: "movie-filter-subsection-label movie-filter-subsection-label-spaced", text: "My Rating" });
      renderRatingRow(body, "myRatings", 10);
    }

    if (field.type === "years") {
      this.renderYearGrid(body, field, state, rerender);
    }
  }

  // A calendar of years only. Two modes:
  //  Range      – click a year, then another, to select everything between.
  //               Click an end to trim it; click inside the range to clear it.
  //  Individual – every click toggles that year on or off (shift-click adds a span).
  renderYearGrid(body, field, state, rerender) {
    if (!field.bounds) {
      body.createDiv({ cls: "movie-filter-range-hint", text: "No years to pick from yet." });
      return;
    }
    const [bMin, bMax] = field.bounds.map((n) => parseInt(n, 10));
    const counts = field.counts || {};
    const key = field.stateKey;
    const mode = state.yearMode || "range";
    const nums = (state[key] || []).map(Number).filter((n) => !isNaN(n));
    const lo = nums.length ? Math.min(...nums) : null;
    const hi = nums.length ? Math.max(...nums) : null;
    const contiguous = nums.length > 1 && hi - lo + 1 === new Set(nums).size;
    const chosen = new Set(nums.map(String));

    const commit = (set) => {
      state[key] = [...set].sort((a, b) => b - a);
      rerender();
    };
    const setSpan = (a, b) => {
      const s = new Set();
      for (let y = Math.max(a, bMin); y <= Math.min(b, bMax); y++) s.add(String(y));
      commit(s);
    };
    const rangePick = (y) => {
      if (lo === null) return setSpan(y, y);
      if (lo === hi) return y === lo ? commit(new Set()) : setSpan(Math.min(lo, y), Math.max(lo, y));
      if (y === lo) return setSpan(lo + 1, hi);
      if (y === hi) return setSpan(lo, hi - 1);
      if (y > lo && y < hi) return commit(new Set());
      return setSpan(Math.min(lo, y), Math.max(hi, y));
    };

    // ---- selection summary + mode switch ----
    const bar = body.createDiv({ cls: "movie-year-modebar" });
    const sel = bar.createDiv({ cls: "movie-year-selection" });
    const rangeChip = (label, value) => {
      const c = sel.createDiv({ cls: "movie-year-range-chip" });
      c.createSpan({ cls: "movie-year-range-label", text: label });
      c.createSpan({ cls: "movie-year-range-value", text: value });
    };
    if (!nums.length) {
      rangeChip("Year", "Any");
    } else if (contiguous) {
      rangeChip("From", String(lo));
      sel.createSpan({ cls: "movie-year-range-dash", text: "→" });
      rangeChip("To", String(hi));
    } else {
      [...chosen].sort((a, b) => b - a).slice(0, 6).forEach((y) => {
        const chip = sel.createEl("button", { cls: "movie-year-sel-chip", attr: { "aria-label": `Remove ${y}` } });
        chip.createSpan({ text: y });
        chip.createSpan({ cls: "movie-year-sel-x", text: "×" });
        chip.addEventListener("click", () => {
          chosen.delete(y);
          commit(chosen);
        });
      });
      if (chosen.size > 6) sel.createSpan({ cls: "movie-year-sel-more", text: `+${chosen.size - 6} more` });
    }

    const modes = bar.createDiv({ cls: "movie-year-mode", attr: { role: "radiogroup" } });
    [["range", "Range"], ["pick", "Individual"]].forEach(([value, label]) => {
      const b = modes.createEl("button", { cls: "movie-year-mode-btn" + (mode === value ? " selected" : ""), text: label, attr: { role: "radio" } });
      b.addEventListener("click", () => {
        state.yearMode = value;
        this.render();
      });
    });

    // ---- decade pills choose which page of the calendar is showing ----
    const firstDecade = Math.floor(bMin / 10) * 10;
    const lastDecade = Math.floor(bMax / 10) * 10;
    const decades = [];
    for (let d = firstDecade; d <= lastDecade; d += 10) decades.push(d);
    if (this.yearDecade == null || this.yearDecade < firstDecade || this.yearDecade > lastDecade) {
      this.yearDecade = Math.floor((hi || bMax) / 10) * 10;
    }
    const decRow = body.createDiv({ cls: "movie-year-decades" });
    decades.forEach((d) => {
      const hasPick = nums.some((y) => y >= d && y <= d + 9);
      const chip = decRow.createEl("button", {
        cls: "movie-year-decade" + (d === this.yearDecade ? " is-page" : ""),
        attr: { "aria-pressed": String(d === this.yearDecade), title: `Show ${d}–${d + 9}` },
      });
      chip.createSpan({ text: `${d}s` });
      if (hasPick) chip.createSpan({ cls: "movie-year-decade-dot", attr: { "aria-label": "Has selected years" } });
      chip.addEventListener("click", () => {
        this.yearDecade = d;
        this.render();
      });
    });

    // ---- the page: ten years, oldest first ----
    const grid = body.createDiv({ cls: "movie-year-grid" });
    for (let y = this.yearDecade; y <= this.yearDecade + 9; y++) {
      const inLib = y >= bMin && y <= bMax;
      // skip a whole row of five when none of its years exist in the library
      const rowStart = this.yearDecade + (y - this.yearDecade >= 5 ? 5 : 0);
      if (!Array.from({ length: 5 }, (_, k) => rowStart + k).some((yy) => yy >= bMin && yy <= bMax)) continue;
      const n = counts[String(y)] || 0;
      const isOn = chosen.has(String(y));
      const cell = grid.createEl("button", {
        cls: "movie-year-cell" + (isOn ? " is-selected" : "") + (isOn && contiguous && y === lo ? " is-start" : "") + (isOn && contiguous && y === hi ? " is-end" : "") + (!inLib || !n ? " is-empty" : ""),
        attr: { "data-year": String(y), "aria-pressed": String(isOn) },
      });
      cell.createSpan({ cls: "movie-year-num", text: String(y) });
      if (n) cell.createSpan({ cls: "movie-year-count", text: String(n) });
      if (!inLib) cell.disabled = true;
      cell.addEventListener("click", (e) => {
        if (mode === "range") return rangePick(y);
        const here = String(y);
        if (e.shiftKey && this._lastYear && this._lastYear !== here) {
          const [a, b] = [parseInt(this._lastYear, 10), y].sort((p, q) => p - q);
          for (let k = a; k <= b; k++) if (k >= bMin && k <= bMax) chosen.add(String(k));
        } else if (isOn) {
          chosen.delete(here);
        } else {
          chosen.add(here);
        }
        this._lastYear = here;
        commit(chosen);
      });
    }
    body.createDiv({
      cls: "movie-filter-range-hint",
      text:
        mode === "range"
          ? "Pick a decade, then click a year and another to select everything between. Click an end to trim it."
          : "Click a year to select it, click again to unselect. Shift-click adds everything in between.",
    });
  }

  onClose() {
    this.contentEl.empty();
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
        text: "Set your TMDB API key in Settings → TerroTrack to search TMDB, or fill in the form below manually.",
        cls: "movie-gallery-warning",
      });
    }

    const divider = contentEl.createDiv({ cls: "movie-add-divider" });
    divider.createSpan({ text: "OR ENTER MANUALLY" });

    const form = contentEl.createDiv({ cls: "movie-add-form" });
    const draft = {
      title: "", year: "", rating: "", myRating: "", release_date: "",
      runtime: null, original_language: "", budget: 0, genres: "",
      director: "", cast: "", watched: false, custom_poster_url: "",
      trailer_key: "", overview: "", notes: "",
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
      options: [["to_watch", "To Watch"], ["watching", "Watching"], ["watched", "Watched"], ["dropped", "Trashed"]],
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
        ...statusFields(draft.status),
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
        text: "Set your TMDB API key in Settings → TerroTrack to search TMDB, or fill in the form below manually.",
        cls: "movie-gallery-warning",
      });
    }

    const divider = contentEl.createDiv({ cls: "movie-add-divider" });
    divider.createSpan({ text: "OR ENTER MANUALLY" });

    const form = contentEl.createDiv({ cls: "movie-add-form" });
    const draft = {
      name: "", year: "", rating: "", myRating: "", first_air_date: "",
      episode_runtime: null, original_language: "", genres: "", creators: "",
      cast: "", watched: false, custom_poster_url: "", trailer_key: "",
      overview: "", notes: "", number_of_seasons: null, number_of_episodes: null,
      episodesWatched: 0,
      seasonsWatched: 0,
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
    addField(r4b, "Seasons Watched", "seasonsWatched", { placeholder: "e.g. 2" });
    addField(r4b, "Episodes Watched", "episodesWatched", { placeholder: "e.g. 12" });

    addField(makeRow(true), "Language", "original_language", { placeholder: "e.g. en" });

    const r5 = makeRow();
    addField(r5, "Genres", "genres", { placeholder: "Drama, Comedy" });
    addField(r5, "Creator", "creators");

    const r6 = makeRow();
    addField(r6, "Status", "status", {
      type: "select",
      options: [["to_watch", "To Watch"], ["watching", "Watching"], ["watched", "Watched"], ["dropped", "Trashed"]],
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
        ...statusFields(draft.status),
        episodesWatched: draft.episodesWatched ? parseInt(draft.episodesWatched, 10) : 0,
        seasonsWatched: draft.seasonsWatched ? parseInt(draft.seasonsWatched, 10) : 0,
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

      // Keep the two counters consistent (episodes win if both were entered).
      syncShowProgress(show, show.episodesWatched ? "episodes" : "seasons");
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

function formatShortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return iso;
  return `${HM_MONTHS[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : ""}`;
}

class DiscoverModal extends Modal {
  constructor(app, plugin, item, media, libIds, onAdded, reason) {
    super(app);
    this.plugin = plugin;
    this.item = item;
    this.media = media;
    this.libIds = libIds;
    this.onAdded = onAdded;
    this.reason = reason;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("mg-discover-modal");
    const it = this.item;
    const title = discoverTitle(it, this.media);
    const date = discoverDate(it, this.media);

    const layout = contentEl.createDiv({ cls: "mg-dm-layout" });
    if (it.poster_path) layout.createEl("img", { cls: "mg-dm-poster", attr: { src: `${POSTER_BASE}${it.poster_path}`, alt: title } });
    const info = layout.createDiv({ cls: "mg-dm-info" });
    info.createEl("h2", { cls: "mg-dm-title", text: title });
    const sub = info.createDiv({ cls: "mg-dm-sub" });
    if (date) sub.createSpan({ text: formatShortDate(date) });
    if (it.vote_average) sub.createSpan({ cls: "mg-dm-rating", text: `★ ${it.vote_average.toFixed(1)}` });
    sub.createSpan({ text: this.media === "movie" ? "Movie" : "TV Show" });

    const genres = (it.genre_ids || []).map((id) => TMDB_GENRE_NAMES[this.media][id]).filter(Boolean);
    if (genres.length) {
      const row = info.createDiv({ cls: "mg-dm-genres" });
      genres.forEach((g) => row.createSpan({ cls: "mg-dm-genre", text: g }));
    }
    if (this.reason) info.createDiv({ cls: "mg-dm-reason", text: this.reason });
    info.createDiv({ cls: "mg-dm-overview", text: it.overview || "No description available." });

    const actions = info.createDiv({ cls: "mg-dm-actions" });
    const addBtn = makeAddButton(actions, this.libIds.has(it.id) ? "In your library" : "Add to library");
    if (this.libIds.has(it.id)) addBtn.disabled = true;
    addBtn.addEventListener("click", async () => {
      addBtn.disabled = true;
      setActionBtnLabel(addBtn, "Adding…", false);
      try {
        await this.plugin.addFromDiscover(it, this.media);
        this.libIds.add(it.id);
        this.onAdded && this.onAdded();
        setActionBtnLabel(addBtn, "In your library", false);
      } catch (err) {
        console.error(err);
        addBtn.disabled = false;
        setActionBtnLabel(addBtn, "Add to library", false);
      }
    });
    const tmdb = actions.createEl("button", { cls: "mg-dm-link", text: "Open on TMDB" });
    tmdb.addEventListener("click", () =>
      window.open(`https://www.themoviedb.org/${this.media}/${it.id}`, "_blank", "noopener,noreferrer")
    );
  }

  onClose() {
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

    // -- Overview + genres, height-bounded to the poster ------------------
    const overviewGenresWrap = info.createDiv({ cls: "movie-detail-overview-genres" });

    let overviewEl = null;
    let toggleBtn = null;

    if (m.overview) {
      overviewEl = overviewGenresWrap.createEl("p", { cls: "movie-detail-overview-lead is-clamped" });
      const textNode = document.createTextNode("");
      overviewEl.appendChild(textNode);
      const moreLink = overviewEl.createEl("a", {
        cls: "movie-detail-overview-more",
        text: "Show more",
        href: "#",
      });
      moreLink.style.display = "none";
      toggleBtn = moreLink;

      requestAnimationFrame(() => {
        const posterEl = layout.querySelector(".movie-detail-poster");
        if (!posterEl) return;

        const posterHeight = posterEl.getBoundingClientRect().height;
        const titleEl = info.querySelector(".movie-detail-title");
        const subtitleEl = info.querySelector(".movie-detail-subtitle");
        const titleHeight = titleEl ? titleEl.getBoundingClientRect().height : 0;
        const subtitleHeight = subtitleEl ? subtitleEl.getBoundingClientRect().height : 0;
        const genreRow = overviewGenresWrap.querySelector(".movie-detail-chip-row");
        const genresHeight = genreRow ? genreRow.getBoundingClientRect().height : 0;
        const gapAllowance = 32;

        const availableForOverview = posterHeight - titleHeight - subtitleHeight - genresHeight - gapAllowance;
        if (availableForOverview <= 0) {
          textNode.nodeValue = m.overview;
          overviewEl.removeClass("is-clamped");
          return;
        }

        const style = window.getComputedStyle(overviewEl);
        const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.55);
        const maxLines = Math.max(2, Math.floor(availableForOverview / lineHeight));

        textNode.nodeValue = m.overview;
        moreLink.style.display = "none";
        overviewEl.removeClass("is-clamped");

        const fullHeight = overviewEl.scrollHeight;
        if (fullHeight <= availableForOverview + 2) {
          return;
        }

        moreLink.style.display = "";
        const full = m.overview;
        let lo = 0;
        let hi = full.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi + 1) / 2);
          textNode.nodeValue = full.slice(0, mid).trimEnd() + "… ";
          if (overviewEl.getBoundingClientRect().height / lineHeight > maxLines + 0.15) {
            hi = mid - 1;
          } else {
            lo = mid;
          }
        }
        textNode.nodeValue = full.slice(0, lo).trimEnd() + "… ";
        overviewEl.addClass("is-clamped");
        overviewEl.style.webkitLineClamp = String(maxLines);
        overviewEl.style.display = "-webkit-box";
        overviewEl.style.webkitBoxOrient = "vertical";
        overviewEl.style.overflow = "hidden";

        let expanded = false;
        moreLink.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          expanded = !expanded;
          if (expanded) {
            textNode.nodeValue = full + " ";
            moreLink.setText("Show less");
            overviewEl.style.webkitLineClamp = "unset";
            overviewEl.style.display = "block";
            overviewEl.style.overflow = "visible";
          } else {
            textNode.nodeValue = full.slice(0, lo).trimEnd() + "… ";
            moreLink.setText("Show more");
            overviewEl.style.display = "-webkit-box";
            overviewEl.style.webkitLineClamp = String(maxLines);
            overviewEl.style.overflow = "hidden";
          }
        });
      });
    }

    if (m.genres) {
      const genreRow = overviewGenresWrap.createDiv({ cls: "movie-detail-chip-row" });
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

    const statusFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
    statusFact.createDiv({ cls: "movie-detail-fact-label", text: "Status" });
    const statusRow = statusFact.createDiv({ cls: "movie-detail-status-row" });
    buildStatusControl(this, statusRow, m, "movie");

    const favBtn = statusRow.createEl("button", {
      cls: "movie-detail-fav-btn" + (m.favorite ? " is-on" : ""),
      attr: { "aria-pressed": String(!!m.favorite) },
    });
    favBtn.innerHTML = HEART_SVG;
    favBtn.createSpan({ text: m.favorite ? "Favourite" : "Add to favourites" });
    favBtn.addEventListener("click", async () => {
      m.favorite = !m.favorite;
      await this.plugin.updateMovie(m);
      this.renderView();
    });

    const ratingFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
    ratingFact.createDiv({ cls: "movie-detail-fact-label", text: "My Rating" });
    buildStarRating(ratingFact, {
      value: m.myRating,
      onChange: async (newVal) => {
        m.myRating = newVal;
        await this.plugin.updateMovie(m);
        this.renderView();
      },
    });

    if (m.cast) {
      const castFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full movie-detail-fact-trailing" });
      castFact.createDiv({ cls: "movie-detail-fact-label", text: "Cast" });
      castFact.createDiv({ cls: "movie-detail-fact-value", text: m.cast });
    }


    buildNotesCard(this, contentEl, {
      title: m.title,
      notes: m.notes,
      onSave: async (text) => {
        m.notes = text;
        await this.plugin.updateMovie(m);
        this.renderView();
      },
    });

    const actions = contentEl.createDiv({ cls: "movie-detail-actions" });
    if (m.trailer_key) {
      const trailerBtn = makeActionBtn(actions, "movie-detail-trailer-btn", "play", "Watch Trailer");
      trailerBtn.addEventListener("click", () => {
        window.open(`https://www.youtube.com/watch?v=${m.trailer_key}`, "_blank", "noopener,noreferrer");
      });
    }
    const editBtn = makeActionBtn(actions, "movie-detail-edit-btn", "edit", "Edit");
    editBtn.addEventListener("click", () => this.renderEdit());

    const updateBtn = makeActionBtn(actions, "movie-detail-update-btn", "refresh", "Update");
    updateBtn.addEventListener("click", async () => {
      if (!this.plugin.settings.tmdbApiKey) {
        new Notice("Add a TMDB API key in settings to update this entry.");
        return;
      }
      setActionBtnLabel(updateBtn, "Updating…", true);
      updateBtn.disabled = true;
      const fresh = await this.plugin.refreshMovieEntry(m.id);
      if (fresh) {
        this.movie = fresh;
        new Notice(`Updated "${fresh.title}"`);
        this.renderView();
      } else {
        setActionBtnLabel(updateBtn, "Update", false);
        updateBtn.disabled = false;
      }
    });

    const deleteBtn = makeActionBtn(actions, "movie-detail-delete", "trash", "Delete");
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
        const trimmed = v.trim();
        const match = trimmed.match(/(?:v=|youtu\.be\/)([\w-]{6,})/);
        if (match) m.trailer_key = match[1];
        else if (/^[\w-]{6,}$/.test(trimmed)) m.trailer_key = trimmed;
        else m.trailer_key = "";
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
    if (this._noteLayer) this._noteLayer.close();
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

    const overviewGenresWrap = info.createDiv({ cls: "movie-detail-overview-genres" });

    let overviewEl = null;
    let toggleBtn = null;

    if (s.overview) {
      overviewEl = overviewGenresWrap.createEl("p", { cls: "movie-detail-overview-lead is-clamped" });
      const textNode = document.createTextNode("");
      overviewEl.appendChild(textNode);
      const moreLink = overviewEl.createEl("a", {
        cls: "movie-detail-overview-more",
        text: "Show more",
        href: "#",
      });
      moreLink.style.display = "none";
      toggleBtn = moreLink;

      requestAnimationFrame(() => {
        const posterEl = layout.querySelector(".movie-detail-poster");
        if (!posterEl) return;

        const posterHeight = posterEl.getBoundingClientRect().height;
        const titleEl = info.querySelector(".movie-detail-title");
        const subtitleEl = info.querySelector(".movie-detail-subtitle");
        const titleHeight = titleEl ? titleEl.getBoundingClientRect().height : 0;
        const subtitleHeight = subtitleEl ? subtitleEl.getBoundingClientRect().height : 0;
        const genreRow = overviewGenresWrap.querySelector(".movie-detail-chip-row");
        const genresHeight = genreRow ? genreRow.getBoundingClientRect().height : 0;
        const gapAllowance = 32;

        const availableForOverview = posterHeight - titleHeight - subtitleHeight - genresHeight - gapAllowance;
        if (availableForOverview <= 0) {
          textNode.nodeValue = s.overview;
          overviewEl.removeClass("is-clamped");
          return;
        }

        const style = window.getComputedStyle(overviewEl);
        const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.55);
        const maxLines = Math.max(2, Math.floor(availableForOverview / lineHeight));

        textNode.nodeValue = s.overview;
        moreLink.style.display = "none";
        overviewEl.removeClass("is-clamped");

        const fullHeight = overviewEl.scrollHeight;
        if (fullHeight <= availableForOverview + 2) {
          return;
        }

        moreLink.style.display = "";
        const full = s.overview;
        let lo = 0;
        let hi = full.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi + 1) / 2);
          textNode.nodeValue = full.slice(0, mid).trimEnd() + "… ";
          if (overviewEl.getBoundingClientRect().height / lineHeight > maxLines + 0.15) {
            hi = mid - 1;
          } else {
            lo = mid;
          }
        }
        textNode.nodeValue = full.slice(0, lo).trimEnd() + "… ";
        overviewEl.addClass("is-clamped");
        overviewEl.style.webkitLineClamp = String(maxLines);
        overviewEl.style.display = "-webkit-box";
        overviewEl.style.webkitBoxOrient = "vertical";
        overviewEl.style.overflow = "hidden";

        let expanded = false;
        moreLink.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          expanded = !expanded;
          if (expanded) {
            textNode.nodeValue = full + " ";
            moreLink.setText("Show less");
            overviewEl.style.webkitLineClamp = "unset";
            overviewEl.style.display = "block";
            overviewEl.style.overflow = "visible";
          } else {
            textNode.nodeValue = full.slice(0, lo).trimEnd() + "… ";
            moreLink.setText("Show more");
            overviewEl.style.display = "-webkit-box";
            overviewEl.style.webkitLineClamp = String(maxLines);
            overviewEl.style.overflow = "hidden";
          }
        });
      });
    }

    if (s.genres) {
      const genreRow = overviewGenresWrap.createDiv({ cls: "movie-detail-chip-row" });
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

    const statusFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
    statusFact.createDiv({ cls: "movie-detail-fact-label", text: "Status" });
    const statusRow = statusFact.createDiv({ cls: "movie-detail-status-row" });
    buildStatusControl(this, statusRow, s, "tv");

    const favBtn = statusRow.createEl("button", {
      cls: "movie-detail-fav-btn" + (s.favorite ? " is-on" : ""),
      attr: { "aria-pressed": String(!!s.favorite) },
    });
    favBtn.innerHTML = HEART_SVG;
    favBtn.createSpan({ text: s.favorite ? "Favourite" : "Add to favourites" });
    favBtn.addEventListener("click", async () => {
      s.favorite = !s.favorite;
      await this.plugin.updateShow(s);
      this.renderView();
    });

    const ratingFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
    ratingFact.createDiv({ cls: "movie-detail-fact-label", text: "My Rating" });
    buildStarRating(ratingFact, {
      value: s.myRating,
      onChange: async (newVal) => {
        s.myRating = newVal;
        await this.plugin.updateShow(s);
        this.renderView();
      },
    });

    buildProgressFact(this, facts, s);

    // Older entries: fetch real per-season episode counts once so the link is exact.
    const tried = (this.plugin._seasonDataTried = this.plugin._seasonDataTried || new Set());
    if (
      (s.number_of_seasons || 0) > 1 &&
      !(Array.isArray(s.season_episodes) && s.season_episodes.length) &&
      !tried.has(s.id)
    ) {
      tried.add(s.id);
      this.plugin.backfillSeasonEpisodes(s).then(async (ok) => {
        if (!ok) return;
        syncShowProgress(s, "episodes");
        await this.plugin.updateShow(s);
        if (!this._closed) this.renderView();
      });
    }

    if (s.cast) {
      const castFact = facts.createDiv({ cls: "movie-detail-fact movie-detail-fact-full" });
      castFact.createDiv({ cls: "movie-detail-fact-label", text: "Cast" });
      castFact.createDiv({ cls: "movie-detail-fact-value", text: s.cast });
    }


    buildNotesCard(this, contentEl, {
      title: s.name,
      notes: s.notes,
      onSave: async (text) => {
        s.notes = text;
        await this.plugin.updateShow(s);
        this.renderView();
      },
    });

    const actions = contentEl.createDiv({ cls: "movie-detail-actions" });
    if (s.trailer_key) {
      const trailerBtn = makeActionBtn(actions, "movie-detail-trailer-btn", "play", "Watch Trailer");
      trailerBtn.addEventListener("click", () => {
        window.open(`https://www.youtube.com/watch?v=${s.trailer_key}`, "_blank", "noopener,noreferrer");
      });
    }
    const editBtn = makeActionBtn(actions, "movie-detail-edit-btn", "edit", "Edit");
    editBtn.addEventListener("click", () => this.renderEdit());

    const updateBtn = makeActionBtn(actions, "movie-detail-update-btn", "refresh", "Update");
    updateBtn.addEventListener("click", async () => {
      if (!this.plugin.settings.tmdbApiKey) {
        new Notice("Add a TMDB API key in settings to update this entry.");
        return;
      }
      setActionBtnLabel(updateBtn, "Updating…", true);
      updateBtn.disabled = true;
      const fresh = await this.plugin.refreshShowEntry(s.id);
      if (fresh) {
        this.show = fresh;
        new Notice(`Updated "${fresh.name}"`);
        this.renderView();
      } else {
        setActionBtnLabel(updateBtn, "Update", false);
        updateBtn.disabled = false;
      }
    });

    const deleteBtn = makeActionBtn(actions, "movie-detail-delete", "trash", "Delete");
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
    addField(r3c, "Seasons Watched", "seasonsWatched", {
      getValue: () => String(getShowProgress(s).seasons || ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        s.seasonsWatched = isNaN(n) ? 0 : n;
        this._progressEdited = "seasons";
      },
    });
    addField(r3c, "Episodes Watched", "episodesWatched", {
      getValue: () => (s.episodesWatched ? String(s.episodesWatched) : ""),
      onInput: (v) => {
        const n = parseInt(v, 10);
        s.episodesWatched = isNaN(n) ? 0 : n;
        this._progressEdited = "episodes";
      },
    });

    addField(makeRow(true), "Language code", "original_language", { placeholder: "e.g. en" });

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
        const trimmed = v.trim();
        const match = trimmed.match(/(?:v=|youtu\.be\/)([\w-]{6,})/);
        if (match) s.trailer_key = match[1];
        else if (/^[\w-]{6,}$/.test(trimmed)) s.trailer_key = trimmed;
        else s.trailer_key = "";
      },
    });

    addField(makeRow(true), "Overview", "overview", { type: "textarea" });
    addField(makeRow(true), "Notes", "notes", { type: "textarea", placeholder: "Personal notes..." });

    const actions = contentEl.createDiv({ cls: "movie-add-actions" });
    const cancelBtn = actions.createEl("button", { text: "Cancel", cls: "movie-add-cancel" });
    cancelBtn.addEventListener("click", () => this.renderView());

    const saveBtn = actions.createEl("button", { text: "Save Changes", cls: "movie-add-save" });
    saveBtn.addEventListener("click", async () => {
      if (this._progressEdited) {
        syncShowProgress(s, this._progressEdited);
        this._progressEdited = null;
      }
      await this.plugin.updateShow(s);
      this.renderView();
    });
  }

  onClose() {
    if (this._noteLayer) this._noteLayer.close();
    this._closed = true;
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
      ["favorite", "Favourite"],
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
      item.toggleClass("is-checked", checkbox.checked);
      checkbox.addEventListener("change", async () => {
        item.toggleClass("is-checked", checkbox.checked);
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

    addSearchSettings(contentEl, this.plugin, "director");

    contentEl.createDiv({ cls: "movie-gallery-settings-divider" });
    contentEl.createEl("h3", { text: "Data", cls: "movie-gallery-settings-section-title" });

    buildDataTools(contentEl, {
      plugin: this.plugin,
      noun: "movie",
      skipNoun: "movie",
      updateDesc: "Refresh info from TMDB. Status, notes and ratings are kept.",
      refreshAll: (cb) => this.plugin.refreshAllMovies(cb),
      backup: (fmt) => this.plugin.backupMovies(fmt),
      importFile: (text, name, cb) => this.plugin.importMovies(text, name, cb),
      importDesc: "Backup, Letterboxd or IMDb export",
      noKeyMsg: "Set your TMDB API key first — needed to match Letterboxd/IMDb entries.",
      formatLabels: { letterboxd: "Letterboxd", imdb: "IMDb", native: "backup" },
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
      ["favorite", "Favourite"],
      ["release_date", "First Air Date"],
      ["runtime", "Episode Runtime"],
      ["language", "Language"],
      ["seasons", "Season progress"],
      ["episodes", "Episode progress"],
      ["myRating", "My Rating"],
      ["overview", "Overview"],
      ["notes", "Notes"],
    ];

    fieldLabels.forEach(([key, label]) => {
      const item = fieldsWrap.createEl("label", { cls: "movie-gallery-checkbox-item" });
      item.createSpan({ cls: "movie-gallery-checkbox-label", text: label });
      const checkbox = item.createEl("input", { type: "checkbox" });
      checkbox.checked = !!this.plugin.settings.tvCardFields[key];
      item.toggleClass("is-checked", checkbox.checked);
      checkbox.addEventListener("change", async () => {
        item.toggleClass("is-checked", checkbox.checked);
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

    addSearchSettings(contentEl, this.plugin, "creator");

    contentEl.createDiv({ cls: "movie-gallery-settings-divider" });
    contentEl.createEl("h3", { text: "Data", cls: "movie-gallery-settings-section-title" });

    buildDataTools(contentEl, {
      plugin: this.plugin,
      noun: "show",
      skipNoun: "TV",
      updateDesc: "Refresh info from TMDB. Status, notes, ratings and progress are kept.",
      refreshAll: (cb) => this.plugin.refreshAllShows(cb),
      backup: (fmt) => this.plugin.backupShows(fmt),
      importFile: (text, name, cb) => this.plugin.importShows(text, name, cb),
      importDesc: "Backup or IMDb export (movies are skipped)",
      noKeyMsg: "Set your TMDB API key first — needed to match IMDb entries.",
      unsupportedMsg: "Letterboxd doesn't track TV shows, so that export can't be used here.",
      formatLabels: { imdb: "IMDb", native: "backup" },
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
    buildActivityHeatmap(contentEl, this.plugin);

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
    statCard(stats.watchingCount, "Watching");
    statCard(stats.toWatchCount, "To Watch");
    statCard(stats.droppedCount, "Trashed");

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
      const parts = [
        ["var(--mg-success)", "Watched", stats.watchedCount],
        ["#3b82f6", "Watching", stats.watchingCount],
        ["rgba(255,255,255,0.25)", "To Watch", stats.toWatchCount],
        ["#a35b61", "Trashed", stats.droppedCount],
      ].filter(([, , n]) => n > 0);
      let acc = 0;
      const stops = parts
        .map(([color, , n]) => {
          const from = acc;
          acc += (n / stats.total) * 100;
          return `${color} ${from}% ${acc}%`;
        })
        .join(", ");
      makeDonutCol("Watched", `${watchedPct}%`, "watched", stops, parts.map(([color, label, n]) => [color, `${label} (${n})`]));
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
        x: labelX, y: labelY, fill: "#ccc", "font-size": "8.5",
        "text-anchor": anchor, "dominant-baseline": "middle",
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
    buildActivityHeatmap(contentEl, this.plugin);

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
    statCard(stats.watchingCount, "Watching");
    statCard(stats.toWatchCount, "To Watch");
    statCard(stats.droppedCount, "Trashed");

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
      const parts = [
        ["var(--mg-success)", "Watched", stats.watchedCount],
        ["#3b82f6", "Watching", stats.watchingCount],
        ["rgba(255,255,255,0.25)", "To Watch", stats.toWatchCount],
        ["#a35b61", "Trashed", stats.droppedCount],
      ].filter(([, , n]) => n > 0);
      let acc = 0;
      const stops = parts
        .map(([color, , n]) => {
          const from = acc;
          acc += (n / stats.total) * 100;
          return `${color} ${from}% ${acc}%`;
        })
        .join(", ");
      makeDonutCol("Watched", `${watchedPct}%`, "watched", stops, parts.map(([color, label, n]) => [color, `${label} (${n})`]));
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
        x: labelX, y: labelY, fill: "#ccc", "font-size": "8.5",
        "text-anchor": anchor, "dominant-baseline": "middle",
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
    containerEl.createEl("h2", { text: "TerroTrack Settings" });

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
      .setName("Movies data file")
      .setDesc("File (relative to vault root) where your movies are stored, e.g. movies.json. Changing this points the plugin at a different file; it doesn't rename or move the existing one.")
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

    new Setting(containerEl)
      .setName("TV shows data file")
      .setDesc("File (relative to vault root) where your TV shows are stored, e.g. tvshows.json. Changing this points the plugin at a different file; it doesn't rename or move the existing one.")
      .addText((text) =>
        text
          .setPlaceholder("tvshows.json")
          .setValue(this.plugin.settings.tvDataFile)
          .onChange(async (value) => {
            this.plugin.settings.tvDataFile = value.trim() || "tvshows.json";
            await this.plugin.saveSettings();
            this.plugin.refreshGalleries();
          })
      );

    new Setting(containerEl)
      .setName("Activity file")
      .setDesc("File (relative to vault root) that stores the daily activity behind the Library Stats heatmap, e.g. activity.json")
      .addText((text) =>
        text
          .setPlaceholder("activity.json")
          .setValue(this.plugin.settings.activityFile)
          .onChange(async (value) => {
            this.plugin.settings.activityFile = value.trim() || "activity.json";
            await this.plugin.saveSettings();
            // follow the new name: use that file if it exists, otherwise carry the log over
            const path = this.plugin.settings.activityFile;
            if (await this.plugin.app.vault.adapter.exists(path)) await this.plugin.loadActivity();
            else await this.plugin.writeActivity();
          })
      );
  }
}

module.exports = MovieGalleryPlugin;
