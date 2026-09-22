/* ==========================================================================
   BioSphere Encyclopedia â€” vanilla JavaScript single-page application
   Hash-router + REST client for the Python backend at /py/*
   ========================================================================== */
(function () {
"use strict";

/* ---------------------------------------------------------------- helpers */
var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function debounce(fn, ms) {
  var t; return function () {
    var args = arguments, self = this;
    clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, ms);
  };
}
function toast(msg, isErr) {
  var el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.className = "toast"; }, 2600);
}

var PREF_KEY = "biosphere-prefs";
function prefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); } catch (e) { return {}; }
}
function savePrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {} }
function pref(k, fallback) { return prefs()[k] !== undefined ? prefs()[k] : fallback; }
function setPref(k, v) { var p = prefs(); p[k] = v; savePrefs(p); }

var I18N = {
  en: { search: "Search species, scientific names, habitatsâ€¦", day: "Species of the Day", facts: "Did You Know?", trending: "Trending species", explore: "Explore", results: "results", clear: "Clear all", read: "Read the full profile â†’", noResults: "No species matched those filters." },
  mr: { search: "à¤ªà¥à¤°à¤œà¤¾à¤¤à¥€, à¤¶à¤¾à¤¸à¥à¤¤à¥à¤°à¥€à¤¯ à¤¨à¤¾à¤µ, à¤…à¤§à¤¿à¤µà¤¾à¤¸ à¤¶à¥‹à¤§à¤¾â€¦", day: "à¤†à¤œà¤šà¥€ à¤ªà¥à¤°à¤œà¤¾à¤¤à¥€", facts: "à¤¤à¥à¤®à¥à¤¹à¤¾à¤²à¤¾ à¤®à¤¾à¤¹à¥€à¤¤ à¤†à¤¹à¥‡ à¤•à¤¾?", trending: "à¤²à¥‹à¤•à¤ªà¥à¤°à¤¿à¤¯ à¤ªà¥à¤°à¤œà¤¾à¤¤à¥€", explore: "à¤¶à¥‹à¤§à¤¾", results: "à¤¨à¤¿à¤•à¤¾à¤²", clear: "à¤¸à¤°à¥à¤µ à¤¸à¤¾à¤« à¤•à¤°à¤¾", read: "à¤¸à¤‚à¤ªà¥‚à¤°à¥à¤£ à¤®à¤¾à¤¹à¤¿à¤¤à¥€ à¤µà¤¾à¤šà¤¾ â†’", noResults: "à¤•à¥‹à¤£à¤¤à¥€à¤¹à¥€ à¤ªà¥à¤°à¤œà¤¾à¤¤à¥€ à¤¸à¤¾à¤ªà¤¡à¤²à¥€ à¤¨à¤¾à¤¹à¥€." },
  hi: { search: "à¤ªà¥à¤°à¤œà¤¾à¤¤à¤¿, à¤µà¥ˆà¤œà¥à¤žà¤¾à¤¨à¤¿à¤• à¤¨à¤¾à¤®, à¤†à¤µà¤¾à¤¸ à¤–à¥‹à¤œà¥‡à¤‚â€¦", day: "à¤†à¤œ à¤•à¥€ à¤ªà¥à¤°à¤œà¤¾à¤¤à¤¿", facts: "à¤•à¥à¤¯à¤¾ à¤†à¤ª à¤œà¤¾à¤¨à¤¤à¥‡ à¤¹à¥ˆà¤‚?", trending: "à¤²à¥‹à¤•à¤ªà¥à¤°à¤¿à¤¯ à¤ªà¥à¤°à¤œà¤¾à¤¤à¤¿à¤¯à¤¾à¤", explore: "à¤–à¥‹à¤œà¥‡à¤‚", results: "à¤ªà¤°à¤¿à¤£à¤¾à¤®", clear: "à¤¸à¤¬ à¤¹à¤Ÿà¤¾à¤à¤", read: "à¤ªà¥‚à¤°à¥€ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ à¤ªà¤¢à¤¼à¥‡à¤‚ â†’", noResults: "à¤•à¥‹à¤ˆ à¤ªà¥à¤°à¤œà¤¾à¤¤à¤¿ à¤¨à¤¹à¥€à¤‚ à¤®à¤¿à¤²à¥€à¥¤" }
};
function lang() { return pref("lang", "en"); }
function t(key) { var d = I18N[lang()] || I18N.en; return d[key] || I18N.en[key] || key; }
function localName(s) {
  var l = lang();
  if (l === "mr" && s.name_mr) return s.name_mr;
  if (l === "hi" && s.name_hi) return s.name_hi;
  return s.common_name;
}

/* ---------------------------------------------------------------- API */
function api(path) {
  return fetch("/py" + path).then(function (r) {
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  });
}
var cache = {};
function apiCached(path) {
  if (!cache[path]) cache[path] = api(path).catch(function () { delete cache[path]; throw new Error("network"); });
  return cache[path];
}

/* ------------------------------------------------------ conservation state */
var LEGEND = {
  EX: { label: "Extinct", color: "#000000" }, EW: { label: "Extinct in the Wild", color: "#3f3f46" },
  CR: { label: "Critically Endangered", color: "#dc2626" }, EN: { label: "Endangered", color: "#ea580c" },
  VU: { label: "Vulnerable", color: "#d97706" }, NT: { label: "Near Threatened", color: "#65a30d" },
  LC: { label: "Least Concern", color: "#16a34a" }, DD: { label: "Data Deficient", color: "#64748b" },
  NE: { label: "Not Evaluated", color: "#94a3b8" }, DOM: { label: "Domesticated", color: "#0ea5e9" }
};
function statusBadge(code, small) {
  var l = LEGEND[code] || LEGEND.NE;
  return '<span class="badge-status" style="background:' + l.color + '" title="' + esc(l.label) + '">' +
    esc(code) + (small ? "" : ' <small>' + esc(l.label) + "</small>") + "</span>";
}

/* ------------------------------------------------------- plate generator */
var PALETTES = [["#0f766e", "#84cc16"], ["#1d4ed8", "#38bdf8"], ["#b45309", "#fbbf24"], ["#7c3aed", "#f472b6"], ["#065f46", "#34d399"], ["#9f1239", "#fb923c"], ["#0e7490", "#a78bfa"], ["#4d7c0f", "#facc15"]];
function plate(seed, emoji, big) {
  var h = 0;
  for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  var p = PALETTES[h % PALETTES.length];
  return '<div class="plate' + (big ? " big" : "") + '" style="background:radial-gradient(120% 120% at 20% 10%,' + p[1] + ' 0%,' + p[0] + ' 70%)"><span>' + esc(emoji) + "</span></div>";
}

/* ------------------------------------------------- lazy species imagery */
function attachImage(container, wikiTitle, slug, emoji, alt) {
  container.innerHTML = '<div class="skeleton" style="position:absolute;inset:0"></div>';
  fetch("/py/gallery?title=" + encodeURIComponent(wikiTitle) + "&gallery=0")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.lead) { container.innerHTML = plate(slug, emoji); return; }
      var img = new Image();
      img.className = "sp-img";
      img.alt = alt;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.onerror = function () { container.innerHTML = plate(slug, emoji); };
      img.onload = function () {
        container.innerHTML = "";
        container.appendChild(img);
        if (container.dataset.mystery) {
          var o = document.createElement("div");
          o.className = "quiz-mystery";
          o.textContent = "â“";
          container.appendChild(o);
        }
      };
      img.src = d.lead;
    })
    .catch(function () { container.innerHTML = plate(slug, emoji); });
}

var lazyObserver = ("IntersectionObserver" in window)
  ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        lazyObserver.unobserve(el);
        attachImage(el, el.dataset.wiki, el.dataset.slug, el.dataset.emoji, el.dataset.alt || "");
      });
    }, { rootMargin: "260px" })
  : null;

function lazyImages(root) {
  $$(".sp-img-wrap[data-wiki]", root).forEach(function (el) {
    if (lazyObserver) lazyObserver.observe(el); else attachImage(el, el.dataset.wiki, el.dataset.slug, el.dataset.emoji, el.dataset.alt || "");
  });
}

function reveal(root) {
  var els = $$(".reveal", root || document);
  if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("on"); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add("on"); io.unobserve(entry.target); }
    });
  }, { rootMargin: "0px 0px -40px" });
  els.forEach(function (e) { io.observe(e); });
}

/* -------------------------------------------------------------- species cards */
function speciesCard(s, view) {
  var href = "#/species/" + s.slug;
  var imgWrap = '<div class="sp-img-wrap" data-wiki="' + esc(s.wiki_title || "") + '" data-slug="' + esc(s.slug) + '" data-emoji="' + esc(s.emoji || "ðŸ¾") + '" data-alt="' + esc(s.common_name) + '"></div>';
  if (view === "list") {
    return '<a class="panel list-card card-hover" href="' + href + '">' + imgWrap +
      "<div><div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap\"><b class=\"sp-name\">" + esc(localName(s)) + "</b>" + statusBadge(s.conservation, true) + "</div>" +
      '<span class="sp-sci">' + esc(s.scientific_name) + "</span>" +
      '<p class="sp-sum" style="-webkit-line-clamp:3">' + esc(s.summary) + "</p></div></a>";
  }
  return '<a class="panel species-card card-hover" href="' + href + '">' + imgWrap +
    '<span class="sp-badge">' + statusBadge(s.conservation, true) + "</span>" +
    '<span class="sp-emoji">' + esc(s.emoji || "ðŸ¾") + "</span>" +
    '<div class="sp-body"><b class="sp-name">' + esc(localName(s)) + '</b><span class="sp-sci">' + esc(s.scientific_name) + "</span>" +
    '<span class="sp-sum">' + esc(s.summary) + "</span>" +
    '<span class="sp-meta"><span class="pill pill-green">' + esc(s.diet_type || "") + "</span>" +
    (s.habitats && s.habitats[0] ? '<span class="pill">' + esc(s.habitats[0]) + "</span>" : "") + "</span></div></a>";
}
function speciesGrid(items, view) {
  if (!items || !items.length) {
    return '<div class="panel empty-state"><div class="es-emoji">ðŸ”</div><p>' + esc(t("noResults")) + '</p><a class="btn btn-primary" href="#/explore">' + esc(t("clear")) + "</a></div>";
  }
  return '<div class="grid ' + (view === "list" ? "" : "grid-4") + '">' + items.map(function (s) { return speciesCard(s, view); }).join("") + "</div>";
}

/* ================================================================= VIEWS */
var BACKDROPS = [
  "https://images.pexels.com/photos/20875493/pexels-photo-20875493.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600",
  "https://images.pexels.com/photos/14382743/pexels-photo-14382743.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600",
  "https://images.pexels.com/photos/35384671/pexels-photo-35384671.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600",
  "https://images.pexels.com/photos/38965588/pexels-photo-38965588.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600"
];
var MOSAIC = [
  { slug: "bengal-tiger", wiki: "Bengal_tiger", emoji: "ðŸ…", name: "Bengal Tiger", tall: true },
  { slug: "indian-peafowl", wiki: "Indian_peafowl", emoji: "ðŸ¦š", name: "Indian Peafowl" },
  { slug: "blue-morpho", wiki: "Morpho_peleides", emoji: "ðŸ¦‹", name: "Blue Morpho" },
  { slug: "lotus", wiki: "Nelumbo_nucifera", emoji: "ðŸª·", name: "Sacred Lotus" }
];

function renderHome() {
  setTitle("BioSphere Encyclopedia â€” Every living thing on Earth");
  app.innerHTML =
    '<section class="hero"><div class="hero-bg" id="hero-bg">' +
    BACKDROPS.map(function (src, i) { return '<div class="slide' + (i === 0 ? " on" : "") + '" style="background-image:url(' + src + ')"></div>'; }).join("") +
    '</div><div class="hero-veil"></div>' +
    ["ðŸ¦‹", "ðŸ", "ðŸŒ¿", "ðŸª¸", "ðŸ¦", "ðŸ„"].map(function (e, i) {
      return '<span class="float-emoji" style="left:' + (8 + i * 15) + '%;top:' + (18 + (i * 31) % 55) + '%;animation-delay:' + (i * .5) + 's">' + e + "</span>";
    }).join("") +
    '<div class="container hero-inner"><div>' +
    '<span class="hero-tag">ðŸŒ Open biodiversity atlas</span>' +
    "<h1>Every living thing on Earth, in one place</h1>" +
    '<p class="hero-sub">From the smallest soil microbe to the blue whale â€” deep profiles with live photo galleries, Marathi and Hindi names, IUCN status, diet, lifespan, distribution and astonishing facts. Built with plain HTML, CSS and JavaScript, powered by a Python + PostgreSQL backend.</p>' +
    '<div class="hero-cta"><a class="btn btn-primary" href="#/explore">Start exploring â†’</a>' +
    '<a class="btn btn-outline-w" href="#/quiz">Take the ID quiz</a>' +
    '<a class="btn btn-outline-w" href="#/map">Open the atlas</a></div>' +
    '<div class="hero-stats" id="hero-stats">' + ["Profiles", "Kingdoms", "Countries", "Threatened"].map(function (x) { return '<div class="hero-stat"><b>â€“</b><span>' + x + "</span></div>"; }).join("") +
    '</div></div>' +
    '<div class="hero-mosaic">' +
    MOSAIC.map(function (m) {
      return '<a class="mosaic-item' + (m.tall ? " tall" : "") + '" href="#/species/' + m.slug + '">' +
        '<div class="mosaic-img sp-img-wrap" data-wiki="' + m.wiki + '" data-slug="' + m.slug + '" data-emoji="' + m.emoji + '" data-alt="' + m.name + '" style="position:absolute"></div>' +
        '<span class="mosaic-label">' + m.name + "</span></a>";
    }).join("") +
    "</div></div></section>" +
    '<section class="container" style="padding-top:38px">' +
    '<div class="section-head reveal"><div><p class="eyebrow">Browse by kingdom</p><h2 class="section-h">Fifteen great branches of life</h2></div><a class="section-link" href="#/explore">Advanced explorer â†’</a></div>' +
    '<div id="home-cats" class="grid grid-4 reveal"><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div></div>' +
    "</section>" +
    '<section class="strip" style="margin-top:38px"><div class="container" style="padding:38px 16px">' +
    '<div class="section-head reveal"><div><p class="eyebrow">Daily spotlight</p><h2 class="section-h">' + esc(t("day")) + "</h2></div></div>" +
    '<div id="home-day" class="reveal"><div class="skeleton" style="height:280px;border-radius:22px"></div></div>' +
    "</div></section>" +
    '<section class="container" style="padding-top:38px">' +
    '<div class="section-head reveal"><div><p class="eyebrow">Most visited</p><h2 class="section-h">' + esc(t("trending")) + '</h2></div><a class="section-link" href="#/explore?sort=popular">See all â†’</a></div>' +
    '<div id="home-trend" class="reveal"><div class="grid grid-4">' + Array(4).fill('<div class="skeleton sk-card"></div>').join("") + "</div></div>" +
    "</section>" +
    '<section class="strip" style="margin-top:38px"><div class="container" style="padding:38px 16px">' +
    '<div class="section-head reveal"><div><p class="eyebrow">Wonder engine</p><h2 class="section-h">' + esc(t("facts")) + "</h2></div></div>" +
    '<div id="home-facts" class="grid grid-3 reveal"></div>' +
    "</div></section>" +
    '<section class="container" style="padding-top:38px">' +
    '<div class="section-head reveal"><div><p class="eyebrow">Interactive</p><h2 class="section-h">Tools for curious minds</h2></div></div>' +
    '<div class="grid grid-4 reveal">' +
    [["#/compare", "âš–ï¸", "Comparison tool", "Place up to three species side by side â€” size, weight, lifespan and status."],
     ["#/map", "ðŸ—ºï¸", "Interactive atlas", "Click a continent or ocean to see which species live there."],
     ["#/quiz", "ðŸ§ ", "Identification quiz", "Can you name the species from one photo and one clue?"],
     ["#/checklist", "âœ…", "My life list", "Track everything you have personally spotted in the wild."]].map(function (tw) {
      return '<a class="panel tool-card card-hover" href="' + tw[0] + '"><span class="t-emoji">' + tw[1] + "</span><h3>" + tw[2] + "</h3><p>" + tw[3] + '</p><span class="t-open">Open â†’</span></a>';
    }).join("") +
    "</div></section>" +
    '<section class="container" style="padding-top:38px"><div class="conservation-strip" id="cons-strip">' +
    '<div class="big-globe">ðŸŒ</div><p class="eyebrow" style="color:#bbf7d0">Why this matters</p>' +
    "<h2 id=\"cons-title\">Discover the species that risk disappearing.</h2>" +
    "<p>Every profile ends with the threats a species faces and the actions a reader can take. Knowing a species exists is the first step to protecting it.</p>" +
    '<div class="hero-cta"><a class="btn" style="background:#fff;color:#065f46" href="#/explore?conservation=CR,EN">See endangered species</a>' +
    '<a class="btn btn-outline-w" href="#/contribute">Contribute data</a></div></div></section>';

  // rotating hero
  var slides = $$("#hero-bg .slide"), si = 0;
  clearInterval(renderHome._timer);
  renderHome._timer = setInterval(function () {
    if (!document.body.contains(slides[0])) { clearInterval(renderHome._timer); return; }
    slides[si].classList.remove("on"); si = (si + 1) % slides.length; slides[si].classList.add("on");
  }, 6500);

  apiCached("/stats").then(function (st) {
    var hs = $("#hero-stats");
    if (hs) {
      var vals = [st.total, st.categories, st.countries, st.threatened];
      $$("b", hs).forEach(function (b, i) { b.textContent = vals[i] != null ? vals[i] : "â€“"; });
    }
    var ct = $("#cons-title");
    if (ct && st.threatened) ct.textContent = st.threatened + " of the " + st.total + " species profiled here are threatened with extinction.";
  }).catch(function () {});

  apiCached("/categories").then(function (cats) {
    var box = $("#home-cats");
    if (!box) return;
    box.innerHTML = cats.map(function (c) {
      return '<a class="cat-card card-hover" style="background:linear-gradient(140deg,' + c.accent_from + "," + c.accent_to + ')" href="#/category/' + c.slug + '">' +
        '<div class="cat-photo lazy-bg" data-wiki="' + esc(c.wiki_title || "") + '"></div>' +
        '<div><p class="big-emoji">' + c.emoji + "</p><h3>" + esc(lang() === "mr" && c.name_mr ? c.name_mr : c.name) + "</h3>" +
        '<span class="mr">' + esc(c.name_mr) + "</span></div>" +
        '<span class="count">' + (c.species_count || 0) + " profiles Â· " + esc(c.known_species) + "</span></a>";
    }).join("");
    lazyBackgrounds(box);
  }).catch(function () { var b = $("#home-cats"); if (b) b.innerHTML = '<p class="muted">Could not load categories.</p>'; });

  api("/day").then(function (d) {
    var s = $("#home-day");
    if (!s || !d.species) return;
    var sp = d.species;
    s.innerHTML = '<div class="panel spot-card">' +
      '<div class="spot-img sp-img-wrap" data-wiki="' + esc(sp.wiki_title) + '" data-slug="' + esc(sp.slug) + '" data-emoji="' + esc(sp.emoji) + '" data-alt="' + esc(sp.common_name) + '"></div>' +
      '<div class="spot-body"><div style="display:flex;gap:6px;flex-wrap:wrap">' + statusBadge(sp.conservation) + '<span class="pill pill-green">' + esc(sp.diet_type) + '</span><span class="pill">' + esc(sp.activity) + "</span></div>" +
      "<h3>" + esc(localName(sp)) + "</h3>" +
      (sp.name_mr || sp.name_hi ? '<p class="local-names">' + (sp.name_mr ? "à¤®à¤°à¤¾à¤ à¥€: " + esc(sp.name_mr) : "") + (sp.name_mr && sp.name_hi ? " Â· " : "") + (sp.name_hi ? "à¤¹à¤¿à¤‚à¤¦à¥€: " + esc(sp.name_hi) : "") + "</p>" : "") +
      '<p class="muted">' + esc(sp.summary) + "</p>" +
      '<div class="spot-stats">' +
      [["Size", (sp.size_summary || "â€”").split(";")[0]], ["Lifespan", sp.lifespan_wild ? sp.lifespan_wild + " yrs" : "â€”"], ["Habitat", (sp.habitats || [])[0] || "â€”"], ["Range", (sp.continents || [])[0] || "â€”"]].map(function (kv) {
        return '<div class="st"><span>' + kv[0] + "</span><b>" + esc(kv[1]) + "</b></div>";
      }).join("") + "</div>" +
      '<a class="btn btn-primary" href="#/species/' + sp.slug + '">' + esc(t("read")) + "</a></div></div>";
    lazyImages(s);
  }).catch(function () { var s = $("#home-day"); if (s) s.parentElement && (s.innerHTML = ""); });

  api("/trending").then(function (d) {
    var el = $("#home-trend");
    if (el) { el.innerHTML = speciesGrid(d.items); lazyImages(el); }
  }).catch(function () {});

  api("/facts").then(function (d) {
    var el = $("#home-facts");
    if (!el) return;
    el.innerHTML = d.items.map(function (f) {
      return '<a class="panel fact-card card-hover" href="#/species/' + f.slug + '"><span class="f-emoji">' + f.emoji + "</span><span><p>" + esc(f.fact) + "</p><span class=\"f-name\">" + esc(f.common_name) + " â†’</span></span></a>";
    }).join("");
  }).catch(function () {});

  lazyImages(app); reveal(app);
}

function lazyBackgrounds(root) {
  $$(".lazy-bg[data-wiki]", root).forEach(function (el) {
    if (!el.dataset.wiki) return;
    apiCouldFailBg(el);
  });
}
function apiCouldFailBg(el) {
  fetch("/py/gallery?title=" + encodeURIComponent(el.dataset.wiki) + "&gallery=0")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (d && d.lead) {
        var img = new Image();
        img.onload = function () { el.style.backgroundImage = "url(" + d.lead + ")"; el.classList.add("on"); };
        img.onerror = function () {};
        img.src = d.lead;
      }
    }).catch(function () {});
}

/* ------------------------------------------------------------------ explore */
function parseHash() {
  var hash = location.hash.replace(/^#/, "") || "/";
  var parts = hash.split("?");
  var q = {};
  (parts[1] || "").split("&").forEach(function (kv) {
    if (!kv) return;
    var p = kv.split("=");
    q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
  });
  var segs = parts[0].split("/").filter(Boolean);
  return { path: "/" + segs.join("/"), segs: segs, q: q };
}
function buildExploreUrl(q) {
  var parts = [];
  Object.keys(q).forEach(function (k) { if (q[k]) parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(q[k])); });
  return "#/explore" + (parts.length ? "?" + parts.join("&") : "");
}

var SORTS = [["popular", "Most popular"], ["az", "Name Aâ€“Z"], ["za", "Name Zâ€“A"], ["largest", "Largest"], ["smallest", "Smallest"], ["longest-lived", "Longest lived"], ["rarest", "Rarest first"]];

function renderExplore(q) {
  setTitle("Explore species Â· BioSphere");
  apiCached("/facets").then(function (facets) {
    LEGEND = facets.legend && Object.keys(facets.legend).length ? facets.legend : LEGEND;
    loadExplore(q, facets);
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state"><div class="es-emoji">ðŸ”Œ</div><p>Backend unavailable. The Python API must be running.</p></div></div>';
  });
}

function loadExplore(q, facets) {
  var params = [];
  ["q", "category", "sub", "conservation", "diet", "habitat", "continent", "tag", "letter", "sort", "page"].forEach(function (k) { if (q[k]) params.push(k + "=" + encodeURIComponent(q[k])); });
  params.push("perPage=24");
  api("/species?" + params.join("&")).then(function (data) {
    var view = q.view === "list" ? "list" : "grid";
    var CATS = loadExplore._cats;
    var renderCats = function (cats) {
      loadExplore._cats = cats;
      var kingdoms = '<p class="f-title">Kingdom</p><div class="f-pills">' + cats.map(function (c) {
        var on = q.category === c.slug;
        return '<button class="f-pill' + (on ? " on" : "") + '" data-set="category" data-val="' + (on ? "" : c.slug) + '">' + c.emoji + " " + esc(c.name) + "</button>";
      }).join("") + "</div>";
      drawExplore(q, facets, data, view, kingdoms);
    };
    if (CATS) renderCats(CATS);
    else apiCached("/categories").then(renderCats).catch(function () { renderCats([]); });
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state"><div class="es-emoji">âš ï¸</div><p>Could not load species.</p></div></div>';
  });
}

function drawExplore(q, facets, data, view, kingdoms) {
  setTitle((q.q ? 'Results for "' + q.q + '" Â· ' : "") + "Explore Â· BioSphere");
  var page = data.page, pages = Math.max(1, Math.ceil(data.total / data.perPage));
  var multi = function (label, key, items, render) {
    return '<div class="f-group"><p class="f-title">' + label + '</p><div class="f-pills">' + items.map(function (it) {
      var current = (q[key] || "").split(",").filter(Boolean);
      var on = current.indexOf(it.value) > -1;
      return '<button class="f-pill' + (on ? " on" : "") + '" data-toggle="' + key + '" data-val="' + esc(it.value) + '">' +
        (render ? render(it.value) : esc(it.value)) + '<span class="n">' + it.count + "</span></button>";
    }).join("") + "</div></div>";
  };

  app.innerHTML = '<div class="container page">' +
    '<p class="crumb"><a href="#/">Home</a> / <span>Explore</span>' + (q.q ? ' / â€œ' + esc(q.q) + 'â€' : "") + "</p>" +
    "<h1 class=\"section-h\" style=\"font-size:clamp(26px,4vw,38px)\">" + (q.q ? "Results for â€œ" + esc(q.q) + "â€" : "Explore the living world") + "</h1>" +
    '<p class="muted" style="margin-top:6px">Combine filters by kingdom, conservation status, diet, habitat and range. Every card links to a full illustrated profile.</p>' +
    '<div class="filter-bar" style="margin-top:16px"><button class="btn btn-ghost btn-sm" id="f-open">Filters</button>' +
    '<span class="results-note"><b>' + data.total + "</b> " + esc(t("results")) + "</span>" +
    '<span style="margin-left:auto;display:flex;gap:8px;align-items:center">' +
    '<select class="sort-select" id="sort-sel" aria-label="Sort results">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + ((q.sort || "popular") === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select>" +
    '<span class="view-toggle"><button data-view="grid" class="' + (view === "grid" ? "on" : "") + '">â–¦</button><button data-view="list" class="' + (view === "list" ? "on" : "") + '">â˜°</button></span>' +
    "</span></div>" +
    '<div class="explore-layout"><aside class="panel filter-panel" id="f-panel"><h2>Filters</h2>' +
    (Object.keys(q).filter(function (k) { return ["category", "conservation", "diet", "habitat", "continent", "letter", "q", "tag"].indexOf(k) > -1 && q[k]; }).length ? '<a class="section-link" id="f-clear" href="#/explore">' + esc(t("clear")) + "</a>" : "") +
    '<div class="f-group">' + kingdoms + "</div>" +
    multi("Conservation status", "conservation", facets.conservation, function (v) { var l = (LEGEND[v] || {}).label || v; return v + " Â· " + l; }) +
    multi("Diet", "diet", facets.diets) +
    multi("Habitat", "habitat", facets.habitats) +
    multi("Continent / ocean", "continent", facets.continents) +
    '<div class="f-group"><p class="f-title">Aâ€“Z index</p><div class="letters">' + "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(function (l) {
      return '<button data-set="letter" data-val="' + (q.letter === l ? "" : l) + '" class="' + (q.letter === l ? "on" : "") + '">' + l + "</button>";
    }).join("") + "</div></div></aside>" +
    '<section id="explore-grid">' + speciesGrid(data.items, view) + "</section></div>" +
    '<nav class="pagination" aria-label="Pagination">' +
    '<button data-page="' + Math.max(1, page - 1) + '"' + (page <= 1 ? " disabled" : "") + ">â€¹ Prev</button>" +
    [1, 2, 3, 4, 5].map(function (o) { var p = page + o - 2; return p >= 1 && p <= pages ? '<button data-page="' + p + '" class="' + (p === page ? "on" : "") + '">' + p + "</button>" : ""; }).join("") +
    '<button data-page="' + Math.min(pages, page + 1) + '"' + (page >= pages ? " disabled" : "") + ">Next â€º</button></nav></div>";

  var navigate = function (patch) {
    var next = Object.assign({}, q, patch);
    delete next.page;
    Object.keys(next).forEach(function (k) { if (!next[k]) delete next[k]; });
    location.hash = buildExploreUrl(next);
  };
  $$("#app [data-set]").forEach(function (btn) {
    btn.onclick = function () { var patch = {}; patch[btn.dataset.set] = btn.dataset.val; navigate(patch); };
  });
  $$("#app [data-toggle]").forEach(function (btn) {
    btn.onclick = function () {
      var key = btn.dataset.toggle, val = btn.dataset.val;
      var cur = (q[key] || "").split(",").filter(Boolean);
      var idx = cur.indexOf(val);
      var next = idx > -1 ? cur.filter(function (v) { return v !== val; }) : cur.concat([val]);
      var patch = {}; patch[key] = next.join(",");
      navigate(patch);
    };
  });
  $("#sort-sel").onchange = function () { navigate({ sort: this.value }); };
  $$(".view-toggle button").forEach(function (b) { b.onclick = function () { navigate({ view: b.dataset.view, page: q.page }); }; });
  $$(".pagination button[data-page]").forEach(function (b) {
    b.onclick = function () { var next = Object.assign({}, q); next.page = b.dataset.page; location.hash = buildExploreUrl(next); window.scrollTo({ top: 0 }); };
  });
  $("#f-open").onclick = function () { $("#f-panel").scrollIntoView({ behavior: "smooth" }); };
  lazyImages(app); reveal(app);
}

/* ------------------------------------------------------------------ species */
var DETAIL_SECTIONS = [["overview", "Overview"], ["gallery", "Gallery"], ["taxonomy", "Classification"], ["physical", "Physical"], ["diet", "Diet"], ["lifespan", "Lifespan"], ["habitat", "Habitat"], ["reproduction", "Reproduction"], ["behaviour", "Behaviour"], ["subspecies", "Subspecies"], ["threats", "Conservation"], ["facts", "Facts"], ["related", "Related"], ["community", "Sightings"]];

function renderSpecies(slug) {
  app.innerHTML = '<div class="container page"><div class="skeleton" style="height:420px;border-radius:22px"></div></div>';
  api("/species/" + encodeURIComponent(slug)).then(function (d) {
    drawSpecies(d.species, d.related, d.sightings);
  }).catch(function () {
    renderNotFound(slug);
  });
}

function kvGrid(rows) {
  if (!rows || !rows.length) return "";
  return '<dl class="kv-grid">' + rows.map(function (r) {
    return '<div class="kv"><dt>' + esc(r.label) + "</dt><dd>" + esc(r.value) + "</dd></div>";
  }).join("") + "</dl>";
}

function pills(list, cls, hrefPrefix) {
  return (list || []).map(function (x) {
    var chip = '<span class="pill ' + cls + '">' + esc(x) + "</span>";
    return hrefPrefix ? '<a href="' + hrefPrefix + encodeURIComponent(x) + '">' + chip + "</a>" : chip;
  }).join(" ");
}

function drawSpecies(s, related, sightings) {
  setTitle(s.common_name + " (" + s.scientific_name + ") Â· BioSphere");
  document.getElementById("app").scrollTop = 0;
  var status = LEGEND[s.conservation] || LEGEND.NE;
  var tax = s.taxonomy || {};
  var facts = s.facts || [];
  var subsp = s.subspecies || [];

  var heroImg = '<figure class="sp-hero-img"><div class="wrap sp-img-wrap" data-wiki="' + esc(s.wiki_title || "") + '" data-slug="' + esc(s.slug) + '" data-emoji="' + esc(s.emoji || "ðŸ¾") + '" data-alt="' + esc(s.common_name) + '"></div>' +
    "<figcaption>Live photograph from Wikimedia Commons. Where no photograph exists, an illustrated specimen plate is shown instead.</figcaption></figure>";

  app.innerHTML =
    '<nav class="crumb container" style="padding-top:18px">' +
      '<a href="#/">Home</a> / <a href="#/category/' + esc(s.category_slug) + '">' + esc(s.category_slug) + "</a> / <a href=\"#/explore?category=" + esc(s.category_slug) + "&sub=" + esc(s.subcategory_slug) + '">' + esc((s.subcategory_slug || "").replace(/-/g, " ")) + "</a> / <b>" + esc(s.common_name) + "</b></nav>" +
    '<header class="sp-hero"><div class="sp-hero-veil lazy-bg" data-wiki="' + esc(s.wiki_title || "") + '"></div>' +
    '<div class="container hero-grid"><div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' + statusBadge(s.conservation) +
      '<span class="pill pill-green">' + esc(s.diet_type) + '</span><span class="pill pill-sky">' + esc(s.activity) + "</span>" +
      (s.tags || []).slice(0, 3).map(function (tag) { return '<a href="#/explore?tag=' + encodeURIComponent(tag) + '"><span class="pill">#' + esc(tag) + "</span></a>"; }).join("") + "</div>" +
      '<div class="sp-name"><h1><span>' + esc(s.emoji || "") + '</span> <span id="sp-display-name">' + esc(localName(s)) + "</span></h1>" +
      '<p class="sci">' + esc(s.scientific_name) + "</p></div>" +
      (s.name_mr || s.name_hi ? '<p class="local-names">' + (s.name_mr ? "<strong>à¤®à¤°à¤¾à¤ à¥€:</strong> " + esc(s.name_mr) + " &nbsp; " : "") + (s.name_hi ? "<strong>à¤¹à¤¿à¤‚à¤¦à¥€:</strong> " + esc(s.name_hi) : "") + "</p>" : "") +
      '<p style="max-width:660px">' + esc(s.summary) + "</p>" +
      '<div class="action-row">' +
        '<button class="btn btn-ghost btn-sm" id="speak-btn">ðŸ”Š Listen</button>' +
        '<button class="btn btn-ghost btn-sm" id="share-btn">ðŸ”— Share</button>' +
        '<button class="btn btn-ghost btn-sm" id="lifelist-btn">+ Life list</button>' +
        '<a class="btn btn-ghost btn-sm" href="#/compare?a=' + esc(s.slug) + '">âš–ï¸ Compare</a>' +
      "</div>" +
      '<div class="quick-stats">' +
      [["Size", (s.size_summary || "â€”").split(";")[0]], ["Weight", s.weight_kg ? s.weight_kg.toLocaleString() + " kg" : "â€”"], ["Lifespan", s.lifespan_wild ? s.lifespan_wild + " yrs wild" : "â€”"], ["Population", s.population || "â€”"]].map(function (kv) {
        return '<div class="qs"><span>' + kv[0] + "</span><b>" + esc(kv[1]) + "</b></div>";
      }).join("") + "</div>" +
      "</div><div>" + heroImg + "</div></div></header>" +
    '<nav class="sp-nav"><div class="container sp-nav-in">' + DETAIL_SECTIONS.map(function (sec) { return '<a href="javascript:void(0)" data-goto="' + sec[0] + '">' + sec[1] + "</a>"; }).join("") + "</div></nav>" +
    '<div class="container detail-layout"><div>' +
      section("overview", "ðŸ“– Overview",
        "<p>" + esc(s.summary) + "</p><p class=\"muted\"><strong>Discovery:</strong> " + esc(s.discovery || "") + "</p>" +
        sizeBar(s)) +
      section("gallery", "ðŸ“¸ Photo gallery", '<div id="gallery-box"><div class="skeleton" style="aspect-ratio:16/10;border-radius:18px"></div></div>') +
      section("taxonomy", "ðŸ§¬ Scientific classification",
        '<div class="panel" style="overflow:hidden"><table class="tax-table"><tbody>' +
        [["Kingdom", tax.kingdom], ["Phylum", tax.phylum], ["Class", tax.class], ["Order", tax.order], ["Family", tax.family], ["Genus", tax.genus], ["Species", tax.species]].map(function (r) {
          return "<tr><th>" + r[0] + "</th><td>" + esc(r[1] || "â€”") + "</td></tr>";
        }).join("") + "</tbody></table></div>") +
      section("physical", "ðŸ“ Physical description",
        '<p style="margin-top:0"><strong>Measurements:</strong> ' + esc(s.size_summary || "â€”") + "</p>" + kvGrid(s.physical) +
        (s.colors && s.colors.length ? '<p style="margin:14px 0 6px"><strong>Colours:</strong> ' + pills(s.colors, "") + "</p>" : "")) +
      section("diet", "ðŸ½ï¸ Diet &amp; feeding",
        '<div style="display:grid;gap:14px;grid-template-columns:1fr" class="diet-grid">' +
        '<div class="panel-muted" style="padding:16px"><p class="f-title">Feeding type</p><p style="font-size:26px;font-weight:800;margin:0;color:var(--green-700)">' + esc(s.diet_type) + "</p>" +
        (s.food_chain ? '<p class="muted" style="font-size:12px;margin:6px 0 0">' + esc(s.food_chain) + "</p>" : "") + "</div>" +
        "<div><p class=\"f-title\">What it eats</p><div style=\"display:flex;flex-wrap:wrap;gap:6px\">" + pills(s.diet_items, "pill-amber") + "</div>" +
        (s.diet_notes ? '<p style="margin-top:12px">' + esc(s.diet_notes) + "</p>" : "") + "</div></div>") +
      section("lifespan", "â³ Lifespan &amp; growth",
        '<div class="grid grid-2">' + [["In the wild", s.lifespan_wild], ["In human care", s.lifespan_captive]].map(function (kv) {
          return '<div class="panel-muted" style="padding:16px"><p class="f-title">' + kv[0] + '</p><p style="font-size:30px;font-weight:800;margin:0">' + (kv[1] || "â€”") + ' <small style="font-size:13px;font-weight:400" class="muted">years</small></p></div>';
        }).join("") + "</div>" +
        (s.lifespan_notes ? '<p style="margin-top:12px">' + esc(s.lifespan_notes) + "</p>" : "") +
        ((s.lifecycle || []).length ? '<div style="margin-top:18px">' + s.lifecycle.map(function (st, i) {
          return '<div class="lifecycle-step"><span class="n">' + (i + 1) + "</span><div><b>" + esc(st.stage) + "</b><span>" + esc(st.detail) + "</span></div></div>";
        }).join("") + "</div>" : "")) +
      section("habitat", "ðŸŒ Habitat &amp; distribution",
        '<div class="grid grid-2"><div><p class="f-title">Habitats</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 14px">' + pills(s.habitats, "pill-green", "#/explore?habitat=") + "</div>" +
        '<p class="f-title">Continents</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' + pills(s.continents, "pill-sky", "#/map?region=") + "</div></div>" +
        '<div class="panel-muted" style="padding:16px;font-size:13.5px"><p style="margin:0"><strong>Countries:</strong> ' + esc((s.countries || []).join(", ") || "â€”") + "</p>" +
        (s.climate ? '<p style="margin:8px 0 0"><strong>Climate:</strong> ' + esc(s.climate) + "</p>" : "") +
        (s.altitude ? '<p style="margin:8px 0 0"><strong>Elevation:</strong> ' + esc(s.altitude) + "</p>" : "") +
        (s.migration ? '<p style="margin:8px 0 0"><strong>Migration:</strong> ' + esc(s.migration) + "</p>" : "") + "</div></div>") +
      (s.reproduction && s.reproduction.length ? section("reproduction", "ðŸ”„ Reproduction", kvGrid(s.reproduction)) : '<span id="reproduction"></span>') +
      (s.behavior && s.behavior.length ? section("behaviour", "ðŸ§  Behaviour &amp; characteristics", kvGrid(s.behavior) +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px"><span class="pill pill-sky">Activity: ' + esc(s.activity) + "</span>" + (s.speed ? '<span class="pill pill-amber">Speed: ' + esc(s.speed) + "</span>" : "") + "</div>") : '<span id="behaviour"></span>') +
      (subsp.length ? section("subspecies", "ðŸ§¬ Subspecies &amp; varieties",
        '<div class="kv-grid" style="display:grid;gap:9px">' + subsp.map(function (sub) {
          return '<div class="subsp-card"><b>' + esc(sub.name) + '</b><span class="region">' + esc(sub.region) + "</span><p>" + esc(sub.note) + "</p></div>";
        }).join("") + "</div>") : '<span id="subspecies"></span>') +
      section("threats", "âš ï¸ Threats &amp; conservation",
        '<div class="status-panel" style="background:' + status.color + '"><span class="st-label">IUCN Red List status</span>' +
        '<p class="st-value">' + esc(status.label) + '</p><p>' + esc(statusDesc(s.conservation)) + '</p><p>Population: ' + esc(s.population) + "</p></div>" +
        ((s.threats || []).length ? '<div class="kv-grid" style="display:grid;gap:8px">' + s.threats.map(function (x) {
          return '<div class="panel-muted" style="padding:11px 14px;font-size:13.5px">âš ï¸ ' + esc(x) + "</div>";
        }).join("") + "</div>" : "") +
        (s.conservation_notes ? '<p style="margin-top:14px">' + esc(s.conservation_notes) + "</p>" : "") +
        (s.how_to_help ? '<div class="help-box"><p class="hb-title">How you can help</p><p>' + esc(s.how_to_help) + "</p></div>" : "")) +
      section("facts", "ðŸ¤” " + facts.length + " amazing facts",
        '<div class="fact-grid">' + facts.map(function (f) { return '<div class="fact-li">' + esc(f) + "</div>"; }).join("") + "</div>") +
      section("related", "ðŸ”— Related species", '<div id="rel-grid">' + speciesGrid(related) + "</div>") +
      section("community", "ðŸ—£ï¸ Community sightings &amp; reviews", '<div id="sight-zone"></div>') +
      "</div>" +
      '<aside><div class="panel sidebar-card"><p class="sc-title">Quick facts</p><ul class="sidebar-facts">' +
      [["Kingdom", tax.kingdom], ["Family", tax.family], ["Diet", s.diet_type], ["Activity", s.activity], ["Speed", s.speed || "â€”"], ["Habitat", (s.habitats || [])[0] || "â€”"], ["Status", status.label]].map(function (kv) {
        return '<li><span class="k">' + kv[0] + '</span><span class="v">' + esc(kv[1] || "â€”") + "</span></li>";
      }).join("") + "</ul></div>" +
      '<div class="panel sidebar-card"><p class="sc-title">External references</p><ul class="ext-links">' +
      '<li><a href="https://en.wikipedia.org/wiki/' + encodeURIComponent(s.wiki_title || "") + '" target="_blank" rel="noreferrer noopener">Wikipedia â†’</a></li>' +
      '<li><a href="https://www.gbif.org/species/search?q=' + encodeURIComponent(s.scientific_name) + '" target="_blank" rel="noreferrer noopener">GBIF occurrence records â†’</a></li>' +
      '<li><a href="https://www.iucnredlist.org/search?query=' + encodeURIComponent(s.scientific_name) + '" target="_blank" rel="noreferrer noopener">IUCN Red List â†’</a></li>' +
      '<li><a href="https://www.inaturalist.org/search?q=' + encodeURIComponent(s.scientific_name) + '" target="_blank" rel="noreferrer noopener">iNaturalist observations â†’</a></li></ul></div></aside>' +
      "</div>";

  function section(id, title, body) { return '<section id="' + id + '" class="detail-section"><h2>' + title + "</h2>" + body + "</section>"; }

  // gallery
  loadGallery(s);
  // sightings
  drawSightings(s, sightings || []);
  // hero bg
  lazyBackgrounds(app);
  lazyImages(app); reveal(app);

  $$("#app [data-goto]").forEach(function (a) {
    a.onclick = function () {
      var el = document.getElementById(a.dataset.goto);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  });

  $("#speak-btn").onclick = function () { speak(s); };
  $("#share-btn").onclick = function () {
    var url = location.href;
    if (navigator.share) { navigator.share({ title: s.common_name, url: url }).catch(function () {}); return; }
    navigator.clipboard && navigator.clipboard.writeText(url).then(function () { toast("Link copied"); });
  };
  updateLifeListBtn(s);
}

function statusDesc(code) {
  return {
    EX: "No known individuals remaining.", EW: "Survives only in captivity.",
    CR: "Extremely high risk of extinction in the wild.", EN: "Very high risk of extinction in the wild.",
    VU: "High risk of extinction in the wild.", NT: "Likely to become threatened soon.",
    LC: "Widespread and abundant.", DD: "Not enough data to assess.",
    NE: "Has not yet been evaluated.", DOM: "Bred and maintained by humans."
  }[code] || "Has not yet been evaluated.";
}

function sizeBar(s) {
  if (!s.length_cm) return "";
  var human = 170, max = Math.max(s.length_cm, human);
  var sp = Math.max(6, (s.length_cm / max) * 100), hu = Math.max(6, (human / max) * 100);
  var fmt = function (cm) { return cm >= 100 ? (cm / 100).toFixed(1) + " m" : Math.round(cm) + " cm"; };
  return '<div class="sizecmp"><p class="f-title">Size next to a human</p>' +
    '<div class="sizebar-row"><div class="sizebar-head"><b>' + esc(s.common_name) + "</b><span class=\"muted\">" + fmt(s.length_cm) + "</span></div>" +
    '<div class="sizebar-track"><div class="sizebar-fill" style="width:' + sp + '%"></div></div></div>' +
    '<div class="sizebar-row"><div class="sizebar-head"><b>Adult human</b><span class="muted">1.7 m</span></div>' +
    '<div class="sizebar-track"><div class="sizebar-fill grey" style="width:' + hu + '%"></div></div></div></div>';
}

function speak(s) {
  if (!("speechSynthesis" in window)) { toast("Speech not supported here", true); return; }
  if (window.__speaking) { window.speechSynthesis.cancel(); window.__speaking = false; toast("Stopped"); return; }
  var text = [s.common_name, s.summary, s.diet_notes, s.lifespan_notes, s.conservation_notes].filter(Boolean).join(". ").slice(0, 2400);
  var u = new SpeechSynthesisUtterance(text);
  u.rate = 0.98;
  u.onend = function () { window.__speaking = false; };
  window.__speaking = true;
  window.speechSynthesis.speak(u);
  toast("Reading profile aloudâ€¦");
}

/* gallery */
function loadGallery(s) {
  fetch("/py/gallery?title=" + encodeURIComponent(s.wiki_title || "") + "&gallery=1")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var box = $("#gallery-box");
      if (!box) return;
      if (!d || !d.images || !d.images.length) {
        box.innerHTML = '<div class="grid grid-3">' + [0, 1, 2].map(function (i) {
          return '<div style="position:relative;aspect-ratio:4/3;border-radius:14px;overflow:hidden">' + plate(s.slug + i, s.emoji || "ðŸ¾") + "</div>";
        }).join("") + '<p class="muted" style="grid-column:1/-1;font-size:12px">Live photo feed unavailable â€” illustrated specimen plates shown instead.</p></div>';
        return;
      }
      var index = 0;
      var shots = d.images;
      var render = function () {
        var shot = shots[index];
        box.innerHTML = '<div class="gallery-view">' +
          '<img class="gallery-main" id="gal-img" alt="' + esc(shot.caption || s.common_name) + '" src="' + shot.url + '" referrerpolicy="no-referrer" />' +
          '<span class="gallery-counter">ðŸ“¸ ' + (index + 1) + " / " + shots.length + "</span>" +
          '<button class="gal-btn gal-prev" aria-label="Previous photo">â€¹</button>' +
          '<button class="gal-btn gal-next" aria-label="Next photo">â€º</button>' +
          '<div class="gallery-cap"><span>' + esc(shot.caption || s.common_name) + "</span><small>Â© " + esc(shot.credit) + " Â· Wikimedia Commons</small></div></div>" +
          '<div class="gallery-thumbs">' + shots.map(function (th, i) {
            return '<img src="' + th.url + '" data-i="' + i + '" class="' + (i === index ? "on" : "") + '" alt="" loading="lazy" referrerpolicy="no-referrer" />';
          }).join("") + "</div>";
        var img = $("#gal-img");
        var touchX = null;
        img.onerror = function () {
          if (img.dataset.fb !== "1" && shot.originalUrl && shot.originalUrl !== shot.url) {
            img.dataset.fb = "1"; img.src = shot.originalUrl;
          } else if (shots.length > 1) { index = (index + 1) % shots.length; render(); }
        };
        img.onclick = function () { openLightbox(shot); };
        _$(".gal-prev").onclick = function () { index = (index - 1 + shots.length) % shots.length; render(); };
        _$(".gal-next").onclick = function () { index = (index + 1) % shots.length; render(); };
        function _$(sel) { return $(sel, box.parentElement) || $(sel); }
        $(".gallery-view", box).addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
        $(".gallery-view", box).addEventListener("touchend", function (e) {
          if (touchX == null) return;
          var dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 45) { index = (index + (dx < 0 ? 1 : -1) + shots.length) % shots.length; render(); }
        });
        $$(".gallery-thumbs img", box).forEach(function (th) { th.onclick = function () { index = Number(th.dataset.i); render(); }; });
      };
      render();
    });
}

function openLightbox(shot) {
  var lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = '<img alt="" src="' + (shot.originalUrl || shot.url) + '" referrerpolicy="no-referrer" /><button class="lightbox-close">Close âœ•</button>';
  document.body.appendChild(lb);
  $("img", lb).onerror = function () { this.src = shot.url; };
  lb.onclick = function () { lb.remove(); };
  var escHandler = function (e) { if (e.key === "Escape") { lb.remove(); document.removeEventListener("keydown", escHandler); } };
  document.addEventListener("keydown", escHandler);
}

/* sightings */
function drawSightings(s, items) {
  var zone = $("#sight-zone");
  var avg = items.length ? (items.reduce(function (a, b) { return a + (b.rating || 0); }, 0) / items.length).toFixed(1) : null;
  zone.innerHTML = '<div class="community-grid">' +
    '<form class="panel" style="padding:18px" id="sight-form">' +
      '<h3 style="font-family:var(--font-display);margin:0 0 4px">Have you seen a ' + esc(s.common_name) + "?</h3>" +
      '<p class="muted" style="font-size:13px;margin:0 0 14px">Log your sighting into the community record (stored in PostgreSQL).</p>' +
      '<div class="form-grid">' +
      '<input name="observer" required placeholder="Your name or handle" maxlength="80" />' +
      '<input name="location" placeholder="Where? e.g. Tadoba, Maharashtra" maxlength="120" />' +
      '<textarea name="note" rows="3" placeholder="Behaviour, time of day, habitatâ€¦" maxlength="1000"></textarea>' +
      '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
      '<label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" name="seen" checked /> seen in the wild</label>' +
      '<span class="rating-row" id="rating-row">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" class="' + (n <= 5 ? "on" : "") + '">â­</button>'; }).join("") + "</span></div>" +
      '<button class="btn btn-primary" type="submit" style="justify-self:start">Submit sighting</button>' +
      "</div></form>" +
    "<div><div style=\"display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px\">" +
      '<h3 style="font-family:var(--font-display);margin:0">Community sightings</h3>' +
      (avg ? '<span class="muted" style="font-size:13px">â­ ' + avg + " Â· " + items.length + " reports</span>" : "") + "</div>" +
      '<div id="sight-list">' +
      (items.length ? items.slice(0, 10).map(function (it) {
        return '<div class="panel sight-item"><div class="sight-head"><b>' + esc(it.observer) + "</b>" +
          (it.location ? '<span class="loc">ðŸ“ ' + esc(it.location) + "</span>" : "") +
          '<span class="stars">' + "â­".repeat(it.rating || 5) + "</span></div>" +
          (it.note ? '<p class="sight-note">' + esc(it.note) + "</p>" : "") +
          '<p class="muted" style="font-size:10.5px;margin:4px 0 0">' + esc(String(it.created_at || "").slice(0, 10)) + (it.seen ? " Â· seen in the wild" : " Â· not yet seen") + "</p></div>";
      }).join("") : '<div class="panel-muted empty-state"><div class="es-emoji">ðŸ‘€</div><p>No sightings logged yet. Be the first!</p></div>') +
      "</div></div></div>";
  var rating = 5;
  $$("#rating-row button").forEach(function (b) {
    b.onclick = function () {
      rating = Number(b.dataset.n);
      $$("#rating-row button").forEach(function (x) { x.classList.toggle("on", Number(x.dataset.n) <= rating); });
    };
  });
  $("#sight-form").onsubmit = function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    fetch("/py/sightings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speciesSlug: s.slug,
        observer: String(fd.get("observer") || "").trim(),
        location: String(fd.get("location") || "").trim(),
        note: String(fd.get("note") || "").trim(),
        rating: rating,
        seen: Boolean(fd.get("seen"))
      })
    }).then(function (r) {
      if (!r.ok) throw new Error("bad");
      return r.json();
    }).then(function () {
      toast("Sighting submitted â€” thank you!");
      api("/species/" + s.slug).then(function (d) { drawSightings(s, d.sightings || []); });
      e.target.reset();
    }).catch(function () { toast("Could not save sighting", true); });
  };
}

/* life list */
function lifeList() {
  try { return JSON.parse(localStorage.getItem("biosphere-lifelist") || "[]"); } catch (e) { return []; }
}
function updateLifeListBtn(s) {
  var btn = $("#lifelist-btn");
  if (!btn) return;
  var on = lifeList().indexOf(s.slug) > -1;
  btn.textContent = on ? "âœ“ On my life list" : "+ Life list";
  btn.onclick = function () {
    var list = lifeList();
    var onNow = list.indexOf(s.slug) > -1;
    var next = onNow ? list.filter(function (x) { return x !== s.slug; }) : list.concat([s.slug]);
    try { localStorage.setItem("biosphere-lifelist", JSON.stringify(next)); } catch (e) {}
    updateLifeListBtn(s);
    toast(onNow ? "Removed from life list" : "Added to your life list");
  };
}

/* ------------------------------------------------------------------ category */
function renderCategory(slug, q) {
  app.innerHTML = '<div class="container page"><div class="skeleton sk-hero"></div></div>';
  Promise.all([apiCached("/categories"), api("/subcategories?category=" + encodeURIComponent(slug))]).then(function (res) {
    var cats = res[0], subs = res[1];
    var cat = cats.find(function (c) { return c.slug === slug; });
    if (!cat) { renderNotFound(slug); return; }
    var params = "category=" + slug + "&perPage=48&sort=popular" + (q.sub ? "&sub=" + encodeURIComponent(q.sub) : "") + (q.letter ? "&letter=" + encodeURIComponent(q.letter) : "");
    api("/species?" + params).then(function (data) {
      setTitle(cat.name + " Â· BioSphere");
      var available = {};
      data.items.forEach(function (s) { available[(s.common_name[0] || "").toUpperCase()] = true; });
      app.innerHTML =
        '<header class="cat-hero" style="background:linear-gradient(135deg,' + cat.accent_from + "," + cat.accent_to + ')">' +
        '<div class="cat-hero-bg"><div class="cat-hero-photo lazy-bg" data-wiki="' + esc(cat.wiki_title || "") + '"></div></div>' +
        '<span class="big-e">' + cat.emoji + "</span>" +
        '<div class="container cat-hero-in">' +
        '<p class="crumb" style="color:rgba(255,255,255,.8)"><a href="#/" style="color:inherit">Home</a> / <span>' + esc(cat.name) + "</span></p>" +
        '<p class="tagline">' + esc(cat.tagline) + "</p>" +
        "<h1>" + cat.emoji + " " + esc(lang() === "mr" && cat.name_mr ? cat.name_mr : cat.name) + "</h1>" +
        '<p style="opacity:.9;margin:0">' + esc(cat.name_mr) + " Â· " + esc(cat.name_hi) + "</p>" +
        '<p class="desc">' + esc(cat.description) + "</p>" +
        '<div class="chips-row"><span class="chipd">' + data.total + ' detailed profiles</span><span class="chipd">' + esc(cat.known_species) + ' known to science</span><span class="chipd">' + subs.length + " sub-groups</span></div>" +
        "</div></header>" +
        '<div class="container page">' +
        '<div class="sub-pills"><a class="f-pill' + (!q.sub ? " on" : "") + '" href="#/category/' + slug + '">All</a>' +
        subs.map(function (sc) {
          return '<a class="f-pill' + (q.sub === sc.slug ? " on" : "") + '" href="#/category/' + slug + "?sub=" + sc.slug + '">' + sc.emoji + " " + esc(sc.name) + ' <span class="n">' + (sc.species_count || 0) + "</span></a>";
        }).join("") + "</div>" +
        '<div class="letters" style="margin-bottom:22px">' + "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(function (l) {
          var enabled = available[l];
          return enabled
            ? '<a href="#/category/' + slug + "?letter=" + l + (q.sub ? "&sub=" + q.sub : "") + '" class="f-pill' + (q.letter === l ? " on" : "") + '" style="padding:3px 9px">' + l + "</a>"
            : '<button disabled>' + l + "</button>";
        }).join("") + (q.letter ? '<a class="section-link" href="#/category/' + slug + (q.sub ? "?sub=" + q.sub : "") + '">clear</a>' : "") + "</div>" +
        speciesGrid(data.items) +
        '<div class="panel-muted roadmap reveal"><h2 class="section-h" style="font-size:20px">Coverage roadmap</h2>' +
        '<p class="muted" style="font-size:13.5px">Science has described roughly <strong>' + esc(cat.known_species) + "</strong> species in this group. We publish the most significant and most searched species first, then expand outward â€” every profile is written and checked against published sources.</p>" +
        '<div class="progress"><b style="width:' + Math.min(100, Math.max(4, data.total * 3)) + '%"></b></div>' +
        '<p class="muted" style="font-size:11.5px;margin:8px 0 0">' + data.total + " in-depth profiles published in this kingdom so far.</p></div>" +
        "</div>";
      lazyBackgrounds(app); lazyImages(app); reveal(app);
    });
  }).catch(function () { renderNotFound(slug); });
}

/* ------------------------------------------------------------------ atlas */
var REGIONS = [
  ["North America", "ðŸ¦…", "#2563eb", "1 / 3", "1 / 3"], ["Europe", "ðŸ¦Š", "#7c3aed", "4 / 6", "1 / 2"],
  ["Asia", "ðŸ…", "#ea580c", "6 / 9", "1 / 3"], ["Africa", "ðŸ¦", "#ca8a04", "4 / 6", "2 / 4"],
  ["South America", "ðŸ¦œ", "#16a34a", "2 / 4", "3 / 5"], ["Australia & Oceania", "ðŸ¦˜", "#0d9488", "7 / 9", "3 / 5"],
  ["Antarctica", "ðŸ§", "#0ea5e9", "3 / 7", "5 / 6"], ["Oceans", "ðŸ‹", "#0369a1", "1 / 2", "4 / 6"]
];
function renderAtlas(q) {
  var region = q.region || "Asia";
  setTitle("Interactive biodiversity atlas Â· BioSphere");
  api("/atlas?region=" + encodeURIComponent(region)).then(function (d) {
    var counts = {};
    (d.counts || []).forEach(function (c) { counts[c.value] = c.count; });
    app.innerHTML = '<div class="container page">' +
      '<p class="eyebrow">Where life lives</p><h1 class="section-h" style="font-size:clamp(26px,4vw,38px)">Interactive biodiversity atlas</h1>' +
      '<p class="muted">Every landmass and ocean has its own evolutionary story. Select a region to see the species profiled from there.</p>' +
      '<div class="panel atlas-grid" style="margin:20px 0">' +
      REGIONS.map(function (r) {
        var on = region === r[0];
        return '<a href="#/map?region=' + encodeURIComponent(r[0]) + '" class="region-tile' + (on ? " on" : "") + '" style="grid-column:' + r[3] + ";grid-row:" + r[4] + ";background:linear-gradient(140deg," + r[2] + (on ? "," + r[2] + "cc" : "33," + r[2] + "18") + ');' + (on ? "border-color:" + r[2] : "") + '">' +
          '<span class="r-emoji">' + r[1] + "</span><b>" + r[0] + "</b><span>" + (counts[r[0]] || 0) + " species</span></a>";
      }).join("") + "</div>" +
      '<div class="section-head"><h2 class="section-h" style="font-size:22px">' + esc(region) + '</h2><a class="section-link" href="#/explore?continent=' + encodeURIComponent(region) + '">Open in explorer â†’</a></div>' +
      speciesGrid(d.items) + "</div>";
    lazyImages(app); reveal(app);
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state"><div class="es-emoji">ðŸ§­</div><p>Atlas unavailable right now.</p></div></div>';
  });
}

/* ------------------------------------------------------------------ compare */
function renderCompare(q) {
  setTitle("Species comparison Â· BioSphere");
  api("/species?perPage=200&sort=az").then(function (all) {
    var picked = ["a", "b", "c"].map(function (k) { return q[k]; }).filter(Boolean).slice(0, 3);
    if (!picked.length) picked = ["bengal-tiger", "african-elephant"];
    var draws = [];
    Promise.all(picked.map(function (slug) {
      return api("/species/" + slug).then(function (d) { draws.push(d.species); }).catch(function () {});
    })).then(function () {
      drawCompare(all.items, picked.map(function (slug) {
        var found = null;
        draws.forEach(function (s) { if (s.slug === slug) found = s; });
        return found;
      }).filter(Boolean), q);
    });
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state"><div class="es-emoji">âš–ï¸</div><p>Could not load the comparison data.</p></div></div>';
  });
}

function drawCompare(options, selected, q) {
  var optionHtml = function (sel) {
    return '<option value="">Choose a speciesâ€¦</option>' + options.map(function (o) {
      return '<option value="' + o.slug + '"' + (sel === o.slug ? " selected" : "") + ">" + o.emoji + " " + esc(o.common_name) + "</option>";
    }).join("");
  };
  var nums = [
    ["Length / height", "length_cm", "cm"], ["Weight", "weight_kg", "kg"],
    ["Lifespan (wild)", "lifespan_wild", "yrs"], ["Lifespan (care)", "lifespan_captive", "yrs"]
  ];
  var textRows = [
    ["Scientific name", function (s) { return "<i>" + esc(s.scientific_name) + "</i>"; }],
    ["Diet", function (s) { return esc(s.diet_type); }],
    ["Activity", function (s) { return esc(s.activity); }],
    ["Speed", function (s) { return esc(s.speed || "â€”"); }],
    ["Status", function (s) { return statusBadge(s.conservation, true); }],
    ["Population", function (s) { return esc(s.population || "â€”"); }],
    ["Habitats", function (s) { return pills((s.habitats || []).slice(0, 4), ""); }],
    ["Range", function (s) { return esc((s.continents || []).join(", ")); }]
  ];
  app.innerHTML = '<div class="container page">' +
    '<p class="eyebrow">Interactive tool</p><h1 class="section-h" style="font-size:clamp(26px,4vw,38px)">Species comparison</h1>' +
    '<p class="muted">Put up to three species head to head. Bars scale relative to the largest value in each row.</p>' +
    '<div class="panel cmp-select-row">' +
      [0, 1, 2].map(function (i) {
        return '<select class="sort-select" data-slot="' + i + '" style="min-width:180px">' + optionHtml(selected[i] && selected[i].slug) + "</select>";
      }).join("") +
      '<button class="btn btn-ghost btn-sm" id="cmp-clear">Clear board</button></div>' +
    (selected.length ?
      '<div class="grid" style="grid-template-columns:repeat(' + selected.length + ",1fr);gap:14px;margin-bottom:18px\">" +
      selected.map(function (s) {
        return '<div class="panel cmp-card"><div class="sp-img-wrap" data-wiki="' + esc(s.wiki_title || "") + '" data-slug="' + esc(s.slug) + '" data-emoji="' + esc(s.emoji || "") + '" data-alt="' + esc(s.common_name) + '"></div>' +
          '<div style="padding:12px"><a href="#/species/' + s.slug + '"><b>' + esc(localName(s)) + "</b></a><div style=\"margin-top:6px;display:flex;gap:5px;flex-wrap:wrap\">" + statusBadge(s.conservation, true) + '<span class="pill pill-green">' + esc(s.diet_type) + "</span></div></div></div>";
      }).join("") + "</div>" +
      '<div class="panel table-scroll"><table class="cmp-table"><tbody>' +
      nums.map(function (row) {
        var max = Math.max.apply(null, selected.map(function (s) { return Number(s[row[1]] || 0); }).concat([1]));
        return "<tr><th>" + row[0] + "</th>" + selected.map(function (s) {
          var v = Number(s[row[1]] || 0);
          return "<td><b>" + (v ? v.toLocaleString() + " " + row[2] : "â€”") + '</b><div class="cmp-bar-track"><div class="cmp-bar" style="width:' + (v / max) * 100 + '%"></div></div></td>';
        }).join("") + "</tr>";
      }).join("") +
      textRows.map(function (row) {
        return "<tr><th>" + row[0] + "</th>" + selected.map(function (s) { return "<td>" + row[1](s) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>"
      : '<div class="panel empty-state"><div class="es-emoji">âš–ï¸</div><p>Pick a species to begin comparing.</p></div>') +
    "</div>";

  $$("#app select[data-slot]").forEach(function (sel) {
    sel.onchange = function () {
      var slots = $$("#app select[data-slot]").map(function (x) { return x.value; }).filter(Boolean);
      var keys = ["a", "b", "c"];
      var url = "#/compare?" + slots.map(function (v, i) { return keys[i] + "=" + encodeURIComponent(v); }).join("&");
      location.hash = url;
    };
  });
  $("#cmp-clear").onclick = function () { location.hash = "#/compare"; };
  lazyImages(app); reveal(app);
}

/* ------------------------------------------------------------------ quiz */
function renderQuiz() {
  setTitle("Identify the species quiz Â· BioSphere");
  app.innerHTML = '<div class="container page"><div class="quiz-shell"><div class="skeleton" style="height:400px;border-radius:22px"></div></div></div>';
  api("/quiz?count=8").then(function (d) {
    var questions = d.questions || [];
    if (!questions.length) throw new Error("no questions");
    var state = { i: 0, score: 0, picked: null, hint: false, questions: questions };
    drawQuiz(state);
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state quiz-shell"><div class="es-emoji">ðŸ§ </div><p>Could not load the quiz.</p><button class="btn btn-primary" onclick="location.reload()">Retry</button></div></div>';
  });
}

function drawQuiz(st) {
  var qs = st.questions;
  if (st.i >= qs.length) {
    var pct = Math.round((st.score / qs.length) * 100);
    var verdict = pct === 100 ? "Perfect â€” you are a walking field guide!" : pct >= 75 ? "Excellent naturalist instincts." : pct >= 50 ? "Solid effort â€” keep exploring." : "Time for a wander through the encyclopedia!";
    app.innerHTML = '<div class="container page"><div class="quiz-shell panel" style="padding:40px;text-align:center">' +
      '<div style="font-size:56px">' + (pct >= 75 ? "ðŸ†" : pct >= 50 ? "ðŸŒ¿" : "ðŸ”") + "</div>" +
      '<h2 class="section-h" style="font-size:30px">' + st.score + " / " + qs.length + "</h2>" +
      '<p class="muted">' + verdict + "</p>" +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px">' +
      '<button class="btn btn-primary" id="quiz-again">Play again</button><a class="btn btn-ghost" href="#/explore">Browse species</a></div></div></div>';
    $("#quiz-again").onclick = renderQuiz;
    return;
  }
  var q = qs[st.i];
  app.innerHTML = '<div class="container page"><div class="quiz-shell panel">' +
    '<div class="quiz-top"><b>Question ' + (st.i + 1) + " of " + qs.length + "</b><span class=\"muted\">Score: " + st.score + "</span></div>" +
    '<div class="quiz-progress"><b style="width:' + (st.i / qs.length) * 100 + '%"></b></div>' +
    '<div class="quiz-img-wrap' + (st.picked ? "" : " blurred") + '" id="quiz-img"></div>' +
    '<div class="quiz-body">' +
      (st.hint || st.picked
        ? '<p class="quiz-hint">ðŸ’¡ ' + esc(q.hint) + (st.picked ? '<span class="sci">' + esc(q.scientificName) + "</span>" : "") + "</p>"
        : '<button class="section-link" id="quiz-hint" style="background:none;border:0;padding:0">Need a clue?</button>') +
      '<div class="quiz-opts">' + q.options.map(function (opt) {
        var cls = "quiz-opt";
        if (st.picked) {
          if (opt.slug === q.answer) cls += " correct";
          else if (opt.slug === st.picked) cls += " wrong";
        }
        return '<button class="' + cls + '" data-slug="' + opt.slug + '"' + (st.picked ? " disabled" : "") + ">" + esc(opt.name) + "</button>";
      }).join("") + "</div>" +
      (st.picked ? '<div style="display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap"><b>' + (st.picked === q.answer ? "âœ… Correct!" : "âŒ Not quite.") + '</b><a class="section-link" href="#/species/' + q.answer + '">Read the profile</a><button class="btn btn-primary btn-sm" id="quiz-next" style="margin-left:auto">' + (st.i + 1 === qs.length ? "See results" : "Next â†’") + "</button></div>" : "") +
    "</div></div></div>";

  var imgWrap = $("#quiz-img");
  if (!st.picked) imgWrap.dataset.mystery = "1";
  attachImage(imgWrap, q.wikiTitle, q.slug, st.picked ? q.emoji : "â“", "Mystery species");

  if (!st.hint && !st.picked) $("#quiz-hint").onclick = function () { st.hint = true; drawQuiz(st); };
  $$(".quiz-opt").forEach(function (btn) {
    btn.onclick = function () {
      st.picked = btn.dataset.slug;
      if (st.picked === q.answer) st.score += 1;
      drawQuiz(st);
    };
  });
  if (st.picked) $("#quiz-next").onclick = function () { st.i += 1; st.picked = null; st.hint = false; drawQuiz(st); };
}

/* ------------------------------------------------------------------ checklist */
function renderChecklist() {
  setTitle("My life list Â· BioSphere");
  api("/species?perPage=200&sort=az").then(function (d) {
    var all = d.items || [];
    var draw = function (query) {
      var listNow = lifeList();
      var seen = all.filter(function (s) { return listNow.indexOf(s.slug) > -1; });
      var qLower = (query || "").toLowerCase();
      var filtered = qLower ? all.filter(function (s) { return s.common_name.toLowerCase().indexOf(qLower) > -1; }).slice(0, 60) : all.slice(0, 60);
      var byCat = {};
      seen.forEach(function (s) { byCat[s.category_slug] = (byCat[s.category_slug] || 0) + 1; });
      var pct = Math.round((seen.length / Math.max(1, all.length)) * 100);
      app.innerHTML = '<div class="container page">' +
        '<p class="eyebrow">Personal tracker</p><h1 class="section-h" style="font-size:clamp(26px,4vw,38px)">My life list</h1>' +
        '<p class="muted">Tick off everything you have seen in the wild. Stored privately in this browser.</p>' +
        '<div class="explore-layout"><div>' +
        '<div class="panel" style="padding:18px;margin-bottom:16px"><div class="life-list-bar"><b>' + seen.length + ' <small style="font-size:14px" class="muted">species logged</small></b><span class="muted">' + pct + "% of the encyclopedia</span></div>" +
        '<div class="progress"><b style="width:' + Math.max(2, pct) + '%"></b></div></div>' +
        '<input class="sort-select" id="life-query" style="width:100%;margin-bottom:14px;border-radius:12px" placeholder="Search the encyclopedia to add a speciesâ€¦" value="' + esc(query || "") + '" />' +
        '<div class="grid grid-2">' + filtered.map(function (s) {
          var checked = listNow.indexOf(s.slug) > -1;
          return '<label class="check-row' + (checked ? " checked" : "") + '"><input type="checkbox" data-slug="' + s.slug + '"' + (checked ? " checked" : "") + " /><span>" + s.emoji + "</span><span style=\"flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">" + esc(s.common_name) + "</span>" + statusBadge(s.conservation, true) + "</label>";
        }).join("") + "</div></div>" +
        '<aside><div class="panel sidebar-card"><p class="sc-title">Your list by kingdom</p><ul class="sidebar-facts">' +
        (draw.cats || []).map(function (c) { return '<li><span class="k">' + c.emoji + " " + esc(c.name) + '</span><span class="v">' + (byCat[c.slug] || 0) + "</span></li>"; }).join("") +
        "</ul></div></aside></div></div>";
      $("#life-query").oninput = debounce(function () { draw(this.value); }, 250);
      $$("#app .check-row input").forEach(function (cb) {
        cb.onchange = function () {
          var list = lifeList();
          var slug = cb.dataset.slug;
          var next = cb.checked ? list.concat([slug]) : list.filter(function (x) { return x !== slug; });
          try { localStorage.setItem("biosphere-lifelist", JSON.stringify(next)); } catch (e) {}
          draw($("#life-query").value);
        };
      });
    };
    apiCached("/categories").then(function (cats) { draw.cats = cats; draw(""); }).catch(function () { draw.cats = []; draw(""); });
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state"><div class="es-emoji">âœ…</div><p>Could not load the encyclopedia list.</p></div></div>';
  });
}

/* ------------------------------------------------------------------ contribute */
function renderContribute() {
  setTitle("Contribute a species Â· BioSphere");
  apiCached("/categories").then(function (cats) {
    app.innerHTML = '<div class="container page prose" style="max-width:720px">' +
      '<p class="eyebrow">Community science</p><h1>Contribute to the encyclopedia</h1>' +
      '<p class="muted">Spotted a species we have not covered? Know the Marathi, Hindi, Tamil or Bengali name for something? Found an error? This form lands in the PostgreSQL editorial queue.</p>' +
      '<div class="panel" style="padding:22px;margin-top:20px"><form id="contrib-form" class="form-grid">' +
      '<div class="grid grid-2"><input name="commonName" required placeholder="Common name *" maxlength="120" /><input name="scientificName" placeholder="Scientific name" maxlength="160" /></div>' +
      '<div class="grid grid-2"><select name="categorySlug">' +
        '<option value="">Kingdom / group (optional)</option>' + cats.map(function (c) { return '<option value="' + c.slug + '">' + c.emoji + " " + esc(c.name) + "</option>"; }).join("") + "</select>" +
      '<input name="region" placeholder="Region / where found" maxlength="120" /></div>' +
      '<textarea name="details" rows="6" placeholder="Describe the species, local-language names, or the correction. Include sources if you have them." maxlength="4000"></textarea>' +
      '<div class="grid grid-2"><input name="contributor" placeholder="Your name (optional)" maxlength="80" /><input type="email" name="email" placeholder="Email (optional)" maxlength="160" /></div>' +
      '<button class="btn btn-primary" style="justify-self:start" type="submit">Submit contribution</button>' +
      "</form></div></div>";
    $("#contrib-form").onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var body = {};
      ["commonName", "scientificName", "categorySlug", "region", "details", "contributor", "email"].forEach(function (k) { body[k] = String(fd.get(k) || ""); });
      fetch("/py/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error("bad"); return r.json(); })
        .then(function () {
          app.innerHTML = '<div class="container page"><div class="panel empty-state" style="max-width:640px;margin:0 auto"><div class="es-emoji">ðŸŒ±</div><h2 class="section-h">Submission received</h2><p class="muted">Thank you â€” your contribution is stored in the editorial queue. Submissions with sources are published fastest.</p><a class="btn btn-primary" href="#/contribute">Submit another</a></div></div>';
        })
        .catch(function () { toast("Could not submit", true); });
    };
  });
}

/* ------------------------------------------------------------------ static pages */
var GLOSSARY = [
  ["Classification", [["Binomial nomenclature", "The two-part Latin naming system â€” genus then species, e.g. Panthera tigris."], ["Taxon", "Any named group of organisms at any rank, from kingdom to subspecies."], ["Endemic", "Found naturally in one area and nowhere else, like the Southern Birdwing in the Western Ghats."], ["Subspecies", "A geographically distinct population within a species."], ["Cultivar", "A plant variety produced by selective breeding."]]],
  ["Ecology", [["Keystone species", "A species whose removal would collapse its ecosystem."], ["Apex predator", "A predator with no natural enemies as an adult."], ["Trophic cascade", "A chain reaction through a food web from a top predator."], ["Mutualism", "A relationship where both partners benefit."], ["Biodiversity hotspot", "A region with exceptional endemism under severe threat â€” India has four."]]],
  ["Behaviour", [["Diurnal", "Active mainly by day."], ["Nocturnal", "Active mainly at night."], ["Crepuscular", "Active at dawn and dusk."], ["Aestivation", "Dormancy through hot or dry periods."], ["Aposematism", "Bright colours advertising toxicity."]]],
  ["Anatomy", [["Carapace", "The hard upper shell of a turtle or crustacean."], ["Baleen", "Keratin filter plates some whales use to strain krill."], ["Chromatophore", "A pigment cell enabling colour change."], ["Prehensile", "Capable of grasping â€” as in a seahorse's tail."], ["Epiphyte", "A plant growing on another for support, like most orchids."]]],
  ["Reproduction", [["Gestation", "Development inside the mother before birth."], ["Oviparous", "Egg-laying."], ["Viviparous", "Live-bearing."], ["Metamorphosis", "A radical change of body form during development."], ["Parthenogenesis", "Reproduction from an unfertilised egg."]]],
  ["Conservation", [["Biopiracy", "Patenting traditional knowledge without consent or benefit sharing."], ["CITES", "The treaty regulating cross-border trade in threatened species."], ["Bycatch", "Non-target animals caught in fishing gear."], ["Habitat fragmentation", "Breaking continuous habitat into isolated patches."], ["De-extinction", "Attempting to recreate an extinct species through genomics."]]]
];

function renderGlossary() {
  setTitle("Glossary of scientific terms Â· BioSphere");
  apiCached("/facets").then(function (facets) {
    var legend = facets.legend || LEGEND;
    app.innerHTML = '<div class="container page prose" style="max-width:900px"><h1>Glossary of scientific terms</h1>' +
      '<p class="muted">Every technical term used across BioSphere, in plain English.</p>' +
      '<h2>IUCN Red List categories</h2><div class="glossary-grid">' +
      Object.keys(legend).map(function (code) {
        var l = legend[code];
        return '<div class="panel gloss-item" style="display:flex;gap:10px;align-items:flex-start">' + statusBadge(code, true) + "<div><dt><b>" + esc(l.label) + "</b></dt><dd>" + esc(statusDesc(code)) + "</dd></div></div>";
      }).join("") + "</div>" +
      GLOSSARY.map(function (grp) {
        return "<h2>" + grp[0] + "</h2><div class=\"glossary-grid\">" + grp[1].map(function (pair) {
          return '<dl class="panel gloss-item"><dt>' + esc(pair[0]) + "</dt><dd>" + esc(pair[1]) + "</dd></dl>";
        }).join("") + "</div>";
      }).join("") + "</div>";
  });
}

var FAQS = [
  ["Is BioSphere Encyclopedia free?", "Yes â€” no paywall, no accounts, no advertising trackers. Teachers and students can use every feature freely."],
  ["Where do the photographs come from?", "Images are streamed live from Wikimedia Commons through the Python media proxy, which resizes them and serves them from the same origin to avoid broken or rate-limited images."],
  ["What stack powers the site?", "A hand-written HTML, CSS and JavaScript frontend; a Python (FastAPI) backend; and a PostgreSQL database â€” with Next.js acting as the static host and reverse proxy."],
  ["Why Marathi and Hindi names?", "Local names carry generations of ecological knowledge. Use the language switcher in the header to change display names."],
  ["Can I cite this site in a school project?", "Yes â€” cite the species page URL and access date. For academic work, also follow the GBIF and IUCN links on each profile."],
  ["How do I report an error?", "Use the Contribute page with the species name and the section to fix. Corrections are prioritised over new species."],
  ["Will you cover all two million described species?", "Not all at once â€” we publish the most searched and ecologically significant species first, then work outwards. Depth beats breadth."]
];

function renderFaq() {
  setTitle("FAQ Â· BioSphere");
  app.innerHTML = '<div class="container page prose" style="max-width:760px"><h1>Frequently asked questions</h1>' +
    FAQS.map(function (f) { return '<details class="panel faq-item"><summary>' + esc(f[0]) + "</summary><p>" + esc(f[1]) + "</p></details>"; }).join("") + "</div>";
}

function renderAbout() {
  setTitle("About Â· BioSphere");
  app.innerHTML = '<div class="container page prose" style="max-width:820px">' +
    '<p class="eyebrow">Our mission</p><h1>A digital natural history museum, open to everyone</h1>' +
    '<p class="muted">Around two million species have been formally described by science, and researchers estimate between 8 and 20 million more are waiting. BioSphere Encyclopedia makes that diversity understandable â€” one carefully written, beautifully illustrated profile at a time.</p>' +
    '<h2>The stack behind this page</h2>' +
    '<div class="grid grid-2">' +
    [["ðŸ–¥ï¸", "Frontend", "Hand-written HTML, CSS and JavaScript â€” a single-page app with a hash router, lazy image loading, dark mode and full keyboard accessibility."],
     ["ðŸ", "Backend", "Python with FastAPI serving 18 REST endpoints â€” species search, filters, galleries, quizzes, sightings and contributions."],
     ["ðŸ˜", "Database", "PostgreSQL stores 179 species profiles, 15 kingdoms, 90 sub-groups, sightings and community contributions."],
     ["ðŸ§©", "Reverse proxy", "Next.js serves this static frontend at the root and transparently proxies /py/* to the Python service."]].map(function (c) {
      return '<div class="panel" style="padding:18px"><span style="font-size:30px">' + c[0] + '</span><h3 style="margin:8px 0 4px">' + c[1] + "</h3><p class=\"muted\" style=\"font-size:13.5px;margin:0\">" + c[2] + "</p></div>";
    }).join("") + "</div>" +
    "<h2>Principles</h2><ul><li><strong>Accuracy before volume</strong> â€” every profile is written against published sources (IUCN, GBIF, peer review).</li><li><strong>Local names matter</strong> â€” Marathi and Hindi names sit beside the Latin binomial.</li><li><strong>Living media</strong> â€” photos stream from Wikimedia Commons; illustrated plates cover the gaps.</li><li><strong>Accessible to everyone</strong> â€” keyboard support, text scaling, high contrast, text-to-speech.</li><li><strong>Free forever</strong> â€” no paywall, no tracking walls.</li></ul>" +
    '<div class="hero-cta" style="margin-top:16px"><a class="btn btn-primary" href="#/contribute">Contribute a species</a><a class="btn btn-ghost" href="#/explore">Start exploring</a></div></div>';
}

var PRIVACY = [
  ["What we collect", "Almost nothing. No accounts, no tracking cookies. Sighting and contribution forms store only what you type, in PostgreSQL. Preferences and your life list live in your own browser's local storage."],
  ["Cookies", "None. Preferences use localStorage, which you can clear any time."],
  ["Third-party media", "Species photographs come from Wikimedia Commons through our own server-side proxy, so your browser does not contact third parties for species images. Hero photography is served by Pexels."],
  ["User submissions", "Sightings and contributions are published with the name you supply. Never submit anything you would not want public."],
  ["Accuracy disclaimer", "An educational resource, not a safety manual. Never rely on it alone to judge whether a plant, mushroom or animal is safe to eat or handle."]
];
function renderPrivacy() {
  setTitle("Privacy & terms Â· BioSphere");
  app.innerHTML = '<div class="container page prose" style="max-width:760px"><h1>Privacy &amp; terms</h1><p class="muted">Short version: we do not want your data, only your curiosity.</p>' +
    PRIVACY.map(function (s) { return '<section class="panel" style="padding:18px;margin-bottom:12px"><h2 style="margin-top:0">' + esc(s[0]) + '</h2><p class="muted" style="margin:0">' + esc(s[1]) + "</p></section>"; }).join("") + "</div>";
}

function renderNotFound(what) {
  setTitle("Not found Â· BioSphere");
  app.innerHTML = '<div class="container page"><div class="panel empty-state" style="max-width:620px;margin:30px auto">' +
    '<div class="es-emoji">ðŸ”­</div><h1 class="section-h" style="font-size:30px">Species not found</h1>' +
    (what ? '<p class="muted">Nothing matches <b>' + esc(what) + '</b>.</p>' : "") +
    '<p class="muted">This page may have gone extinct â€” around 80% of the world\'s species are still undescribed.</p>' +
    '<div class="hero-cta" style="justify-content:center"><a class="btn btn-primary" href="#/explore">Explore all species</a><a class="btn btn-ghost" href="#/">Back to home</a></div></div></div>';
}

/* ------------------------------------------------------------------ router */
var app = $("#app");
function setTitle(title) { document.title = title; }

function route() {
  var h = parseHash();
  window.scrollTo(0, 0);
  var seg = h.segs[0] || "";
  switch (seg) {
    case "": renderHome(); break;
    case "explore": renderExplore(h.q); break;
    case "species": renderSpecies(h.segs[1] ? decodeURIComponent(h.segs[1]) : ""); break;
    case "category": renderCategory(decodeURIComponent(h.segs[1] || ""), h.q); break;
    case "map": renderAtlas(h.q); break;
    case "compare": renderCompare(h.q); break;
    case "quiz": renderQuiz(); break;
    case "checklist": renderChecklist(); break;
    case "contribute": renderContribute(); break;
    case "glossary": renderGlossary(); break;
    case "faq": renderFaq(); break;
    case "about": renderAbout(); break;
    case "privacy": renderPrivacy(); break;
    default: renderNotFound(h.segs.join("/"));
  }
}

/* ------------------------------------------------------------------ header */
function initHeader() {
  var input = $("#search-input"), box = $("#suggest-box"), form = $("#search-form");
  var searchDo = debounce(function () {
    var value = input.value.trim();
    if (value.length < 2) { box.hidden = true; return; }
    api("/suggest?q=" + encodeURIComponent(value)).then(function (d) {
      if (!d.items || !d.items.length) { box.hidden = true; return; }
      box.innerHTML = d.items.map(function (it) {
        return '<li><a href="#/species/' + it.slug + '"><span class="s-emoji">' + it.emoji + '</span><span><span class="s-name">' +
          esc(lang() === "mr" && it.name_mr ? it.name_mr : it.common_name) +
          (it.name_mr && lang() !== "mr" ? ' <span class="muted">' + esc(it.name_mr) + "</span>" : "") +
          '</span><span class="s-sci">' + esc(it.scientific_name) + "</span></span></a></li>";
      }).join("");
      box.hidden = false;
      $$("a", box).forEach(function (a) { a.onclick = function () { box.hidden = true; input.value = ""; }; });
    }).catch(function () {});
  }, 200);
  input.addEventListener("input", searchDo);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (v) { box.hidden = true; location.hash = buildExploreUrl({ q: v }); }
  });
  document.addEventListener("click", function (e) {
    if (!box.contains(e.target) && e.target !== input) box.hidden = true;
  });
  $("#search-form-m").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("#search-input-m").value.trim();
    if (v) location.hash = buildExploreUrl({ q: v });
  });

  // voice search
  $("#voice-btn").onclick = function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Voice search not supported here", true); return; }
    var rec = new SR();
    rec.lang = "en-IN";
    this.classList.add("listening");
    var btn = $("#voice-btn");
    rec.onresult = function (ev) {
      input.value = ev.results[0][0].transcript;
      btn.classList.remove("listening");
      searchDo();
    };
    rec.onerror = rec.onend = function () { btn.classList.remove("listening"); };
    try { rec.start(); } catch (e) { btn.classList.remove("listening"); }
  };

  // theme
  var themeBtn = $("#theme-btn");
  var syncTheme = function () {
    var dark = pref("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "");
    themeBtn.textContent = dark ? "â˜€ï¸" : "ðŸŒ™";
  };
  themeBtn.onclick = function () {
    var now = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setPref("theme", now); syncTheme();
  };
  syncTheme();

  // language
  $$(".lang-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.lang === lang());
    btn.onclick = function () {
      setPref("lang", btn.dataset.lang);
      $$(".lang-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
      var sInput = $("#search-input");
      sInput.placeholder = t("search");
      route();
    };
  });
  input.placeholder = t("search");

  // accessibility
  var a11yBtn = $("#a11y-btn"), a11yPop = $("#a11y-pop");
  a11yBtn.onclick = function (e) { e.stopPropagation(); a11yPop.hidden = !a11yPop.hidden; };
  document.addEventListener("click", function (e) { if (!a11yPop.contains(e.target) && e.target !== a11yBtn) a11yPop.hidden = true; });
  var scale = pref("fontScale", 1);
  $$(".font-scales button").forEach(function (b) {
    b.classList.toggle("active", Number(b.dataset.scale) === scale);
    b.onclick = function () {
      setPref("fontScale", Number(b.dataset.scale));
      document.documentElement.style.fontSize = (16 * Number(b.dataset.scale)) + "px";
      $$(".font-scales button").forEach(function (x) { x.classList.toggle("active", x === b); });
    };
  });
  var contrast = $("#contrast-toggle");
  contrast.checked = Boolean(pref("contrast", false));
  contrast.onchange = function () {
    setPref("contrast", contrast.checked);
    document.documentElement.classList.toggle("contrast", contrast.checked);
  };

  // mega menu
  var megaBtn = $("#mega-btn"), megaMenu = $("#mega-menu");
  var drawMega = function (cats) {
    megaMenu.innerHTML = '<div class="mega-grid">' + cats.map(function (c) {
      return '<a class="mega-cat" href="#/category/' + c.slug + '"><span class="cat-emoji" style="background:linear-gradient(135deg,' + c.accent_from + "," + c.accent_to + ')">' + c.emoji + "</span><span><span class=\"cat-name\">" + esc(c.name) + '</span><span class="cat-meta">' + esc(c.known_species) + " Â· " + (c.species_count || 0) + " profiles</span></span></a>";
    }).join("") + "</div>";
    $$("a", megaMenu).forEach(function (a) { a.onclick = function () { megaMenu.hidden = true; megaBtn.setAttribute("aria-expanded", "false"); }; });
  };
  apiCached("/categories").then(drawMega).catch(function () {});
  megaBtn.onclick = function () {
    megaMenu.hidden = !megaMenu.hidden;
    megaBtn.setAttribute("aria-expanded", String(!megaMenu.hidden));
  };
  $(".has-mega").addEventListener("mouseenter", function () { megaMenu.hidden = false; });
  $(".has-mega").addEventListener("mouseleave", function () { megaMenu.hidden = true; });

  // mobile menu
  var menuBtn = $("#menu-btn"), mobileMenu = $("#mobile-menu");
  menuBtn.onclick = function () { mobileMenu.hidden = !mobileMenu.hidden; menuBtn.textContent = mobileMenu.hidden ? "â˜°" : "âœ•"; };
  apiCached("/categories").then(function (cats) {
    $("#mobile-cats").innerHTML = cats.map(function (c) { return '<a href="#/category/' + c.slug + '">' + c.emoji + " " + esc(c.name) + "</a>"; }).join("");
  }).catch(function () {});
  mobileMenu.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { mobileMenu.hidden = true; menuBtn.textContent = "â˜°"; }
  });

  // footer
  apiCached("/categories").then(function (cats) {
    var box = $("#footer-cats");
    box.innerHTML = '<p class="footer-title">Kingdoms</p>' + cats.slice(0, 8).map(function (c) {
      return '<a href="#/category/' + c.slug + '">' + c.emoji + " " + esc(c.name) + "</a>";
    }).join("");
  }).catch(function () {});
  $("#footer-copy").textContent = "Â© " + new Date().getFullYear() + " BioSphere Encyclopedia Â· Frontend: HTML + CSS + JS Â· Backend: Python (FastAPI) Â· Database: PostgreSQL Â· Photos: Wikimedia Commons";
}

/* ------------------------------------------------------------------ boot */
window.addEventListener("hashchange", route);
document.addEventListener("DOMContentLoaded", function () {
  app = $("#app");
  initHeader();
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    // Optional PWA hook â€” registration only if a worker exists.
  }
});
})();
        return '<div class="panel cmp-card"><div class="sp-img-wrap" data-wiki="' + esc(s.wiki_title || "") + '" data-slug="' + esc(s.slug) + '" data-emoji="' + esc(s.emoji || "") + '" data-alt="' + esc(s.common_name) + '"></div>' +
          '<div style="padding:12px"><a href="#/species/' + s.slug + '"><b>' + esc(localName(s)) + "</b></a><div style=\"margin-top:6px;display:flex;gap:5px;flex-wrap:wrap\">" + statusBadge(s.conservation, true) + '<span class="pill pill-green">' + esc(s.diet_type) + "</span></div></div></div>";
      }).join("") + "</div>" +
      '<div class="panel table-scroll"><table class="cmp-table"><tbody>' +
      nums.map(function (row) {
        var max = Math.max.apply(null, selected.map(function (s) { return Number(s[row[1]] || 0); }).concat([1]));
        return "<tr><th>" + row[0] + "</th>" + selected.map(function (s) {
          var v = Number(s[row[1]] || 0);
          return "<td><b>" + (v ? v.toLocaleString() + " " + row[2] : "â€”") + '</b><div class="cmp-bar-track"><div class="cmp-bar" style="width:' + (v / max) * 100 + '%"></div></div></td>';
        }).join("") + "</tr>";
      }).join("") +
      textRows.map(function (row) {
        return "<tr><th>" + row[0] + "</th>" + selected.map(function (s) { return "<td>" + row[1](s) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>"
      : '<div class="panel empty-state"><div class="es-emoji">âš–ï¸</div><p>Pick a species to begin comparing.</p></div>') +
    "</div>";

  $$("#app select[data-slot]").forEach(function (sel) {
    sel.onchange = function () {
      var slots = $$("#app select[data-slot]").map(function (x) { return x.value; }).filter(Boolean);
      var keys = ["a", "b", "c"];
      var url = "#/compare?" + slots.map(function (v, i) { return keys[i] + "=" + encodeURIComponent(v); }).join("&");
      location.hash = url;
    };
  });
  $("#cmp-clear").onclick = function () { location.hash = "#/compare"; };
  lazyImages(app); reveal(app);
}

/* ------------------------------------------------------------------ quiz */
function renderQuiz() {
  setTitle("Identify the species quiz Â· BioSphere");
  app.innerHTML = '<div class="container page"><div class="quiz-shell"><div class="skeleton" style="height:400px;border-radius:22px"></div></div></div>';
  api("/quiz?count=8").then(function (d) {
    var questions = d.questions || [];
    if (!questions.length) throw new Error("no questions");
    var state = { i: 0, score: 0, picked: null, hint: false, questions: questions };
    drawQuiz(state);
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state quiz-shell"><div class="es-emoji">ðŸ§ </div><p>Could not load the quiz.</p><button class="btn btn-primary" onclick="location.reload()">Retry</button></div></div>';
  });
}

function drawQuiz(st) {
  var qs = st.questions;
  if (st.i >= qs.length) {
    var pct = Math.round((st.score / qs.length) * 100);
    var verdict = pct === 100 ? "Perfect â€” you are a walking field guide!" : pct >= 75 ? "Excellent naturalist instincts." : pct >= 50 ? "Solid effort â€” keep exploring." : "Time for a wander through the encyclopedia!";
    app.innerHTML = '<div class="container page"><div class="quiz-shell panel" style="padding:40px;text-align:center">' +
      '<div style="font-size:56px">' + (pct >= 75 ? "ðŸ†" : pct >= 50 ? "ðŸŒ¿" : "ðŸ”") + "</div>" +
      '<h2 class="section-h" style="font-size:30px">' + st.score + " / " + qs.length + "</h2>" +
      '<p class="muted">' + verdict + "</p>" +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px">' +
      '<button class="btn btn-primary" id="quiz-again">Play again</button><a class="btn btn-ghost" href="#/explore">Browse species</a></div></div></div>';
    $("#quiz-again").onclick = renderQuiz;
    return;
  }
  var q = qs[st.i];
  app.innerHTML = '<div class="container page"><div class="quiz-shell panel">' +
    '<div class="quiz-top"><b>Question ' + (st.i + 1) + " of " + qs.length + "</b><span class=\"muted\">Score: " + st.score + "</span></div>" +
    '<div class="quiz-progress"><b style="width:' + (st.i / qs.length) * 100 + '%"></b></div>' +
    '<div class="quiz-img-wrap' + (st.picked ? "" : " blurred") + '" id="quiz-img"></div>' +
    '<div class="quiz-body">' +
      (st.hint || st.picked
        ? '<p class="quiz-hint">ðŸ’¡ ' + esc(q.hint) + (st.picked ? '<span class="sci">' + esc(q.scientificName) + "</span>" : "") + "</p>"
        : '<button class="section-link" id="quiz-hint" style="background:none;border:0;padding:0">Need a clue?</button>') +
      '<div class="quiz-opts">' + q.options.map(function (opt) {
        var cls = "quiz-opt";
        if (st.picked) {
          if (opt.slug === q.answer) cls += " correct";
          else if (opt.slug === st.picked) cls += " wrong";
        }
        return '<button class="' + cls + '" data-slug="' + opt.slug + '"' + (st.picked ? " disabled" : "") + ">" + esc(opt.name) + "</button>";
      }).join("") + "</div>" +
      (st.picked ? '<div style="display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap"><b>' + (st.picked === q.answer ? "âœ… Correct!" : "âŒ Not quite.") + '</b><a class="section-link" href="#/species/' + q.answer + '">Read the profile</a><button class="btn btn-primary btn-sm" id="quiz-next" style="margin-left:auto">' + (st.i + 1 === qs.length ? "See results" : "Next â†’") + "</button></div>" : "") +
    "</div></div></div>";

  var imgWrap = $("#quiz-img");
  if (!st.picked) imgWrap.dataset.mystery = "1";
  attachImage(imgWrap, q.wikiTitle, q.slug, st.picked ? q.emoji : "â“", "Mystery species");

  if (!st.hint && !st.picked) $("#quiz-hint").onclick = function () { st.hint = true; drawQuiz(st); };
  $$(".quiz-opt").forEach(function (btn) {
    btn.onclick = function () {
      st.picked = btn.dataset.slug;
      if (st.picked === q.answer) st.score += 1;
      drawQuiz(st);
    };
  });
  if (st.picked) $("#quiz-next").onclick = function () { st.i += 1; st.picked = null; st.hint = false; drawQuiz(st); };
}

/* ------------------------------------------------------------------ checklist */
function renderChecklist() {
  setTitle("My life list Â· BioSphere");
  api("/species?perPage=200&sort=az").then(function (d) {
    var all = d.items || [];
    var draw = function (query) {
      var listNow = lifeList();
      var seen = all.filter(function (s) { return listNow.indexOf(s.slug) > -1; });
      var qLower = (query || "").toLowerCase();
      var filtered = qLower ? all.filter(function (s) { return s.common_name.toLowerCase().indexOf(qLower) > -1; }).slice(0, 60) : all.slice(0, 60);
      var byCat = {};
      seen.forEach(function (s) { byCat[s.category_slug] = (byCat[s.category_slug] || 0) + 1; });
      var pct = Math.round((seen.length / Math.max(1, all.length)) * 100);
      app.innerHTML = '<div class="container page">' +
        '<p class="eyebrow">Personal tracker</p><h1 class="section-h" style="font-size:clamp(26px,4vw,38px)">My life list</h1>' +
        '<p class="muted">Tick off everything you have seen in the wild. Stored privately in this browser.</p>' +
        '<div class="explore-layout"><div>' +
        '<div class="panel" style="padding:18px;margin-bottom:16px"><div class="life-list-bar"><b>' + seen.length + ' <small style="font-size:14px" class="muted">species logged</small></b><span class="muted">' + pct + "% of the encyclopedia</span></div>" +
        '<div class="progress"><b style="width:' + Math.max(2, pct) + '%"></b></div></div>' +
        '<input class="sort-select" id="life-query" style="width:100%;margin-bottom:14px;border-radius:12px" placeholder="Search the encyclopedia to add a speciesâ€¦" value="' + esc(query || "") + '" />' +
        '<div class="grid grid-2">' + filtered.map(function (s) {
          var checked = listNow.indexOf(s.slug) > -1;
          return '<label class="check-row' + (checked ? " checked" : "") + '"><input type="checkbox" data-slug="' + s.slug + '"' + (checked ? " checked" : "") + " /><span>" + s.emoji + "</span><span style=\"flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">" + esc(s.common_name) + "</span>" + statusBadge(s.conservation, true) + "</label>";
        }).join("") + "</div></div>" +
        '<aside><div class="panel sidebar-card"><p class="sc-title">Your list by kingdom</p><ul class="sidebar-facts">' +
        (draw.cats || []).map(function (c) { return '<li><span class="k">' + c.emoji + " " + esc(c.name) + '</span><span class="v">' + (byCat[c.slug] || 0) + "</span></li>"; }).join("") +
        "</ul></div></aside></div></div>";
      $("#life-query").oninput = debounce(function () { draw(this.value); }, 250);
      $$("#app .check-row input").forEach(function (cb) {
        cb.onchange = function () {
          var list = lifeList();
          var slug = cb.dataset.slug;
          var next = cb.checked ? list.concat([slug]) : list.filter(function (x) { return x !== slug; });
          try { localStorage.setItem("biosphere-lifelist", JSON.stringify(next)); } catch (e) {}
          draw($("#life-query").value);
        };
      });
    };
    apiCached("/categories").then(function (cats) { draw.cats = cats; draw(""); }).catch(function () { draw.cats = []; draw(""); });
  }).catch(function () {
    app.innerHTML = '<div class="container page"><div class="panel empty-state"><div class="es-emoji">âœ…</div><p>Could not load the encyclopedia list.</p></div></div>';
  });
}

/* ------------------------------------------------------------------ contribute */
function renderContribute() {
  setTitle("Contribute a species Â· BioSphere");
  apiCached("/categories").then(function (cats) {
    app.innerHTML = '<div class="container page prose" style="max-width:720px">' +
      '<p class="eyebrow">Community science</p><h1>Contribute to the encyclopedia</h1>' +
      '<p class="muted">Spotted a species we have not covered? Know the Marathi, Hindi, Tamil or Bengali name for something? Found an error? This form lands in the PostgreSQL editorial queue.</p>' +
      '<div class="panel" style="padding:22px;margin-top:20px"><form id="contrib-form" class="form-grid">' +
      '<div class="grid grid-2"><input name="commonName" required placeholder="Common name *" maxlength="120" /><input name="scientificName" placeholder="Scientific name" maxlength="160" /></div>' +
      '<div class="grid grid-2"><select name="categorySlug">' +
        '<option value="">Kingdom / group (optional)</option>' + cats.map(function (c) { return '<option value="' + c.slug + '">' + c.emoji + " " + esc(c.name) + "</option>"; }).join("") + "</select>" +
      '<input name="region" placeholder="Region / where found" maxlength="120" /></div>' +
      '<textarea name="details" rows="6" placeholder="Describe the species, local-language names, or the correction. Include sources if you have them." maxlength="4000"></textarea>' +
      '<div class="grid grid-2"><input name="contributor" placeholder="Your name (optional)" maxlength="80" /><input type="email" name="email" placeholder="Email (optional)" maxlength="160" /></div>' +
      '<button class="btn btn-primary" style="justify-self:start" type="submit">Submit contribution</button>' +
      "</form></div></div>";
    $("#contrib-form").onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var body = {};
      ["commonName", "scientificName", "categorySlug", "region", "details", "contributor", "email"].forEach(function (k) { body[k] = String(fd.get(k) || ""); });
      fetch("/py/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error("bad"); return r.json(); })
        .then(function () {
          app.innerHTML = '<div class="container page"><div class="panel empty-state" style="max-width:640px;margin:0 auto"><div class="es-emoji">ðŸŒ±</div><h2 class="section-h">Submission received</h2><p class="muted">Thank you â€” your contribution is stored in the editorial queue. Submissions with sources are published fastest.</p><a class="btn btn-primary" href="#/contribute">Submit another</a></div></div>';
        })
        .catch(function () { toast("Could not submit", true); });
    };
  });
}

/* ------------------------------------------------------------------ static pages */
var GLOSSARY = [
  ["Classification", [["Binomial nomenclature", "The two-part Latin naming system â€” genus then species, e.g. Panthera tigris."], ["Taxon", "Any named group of organisms at any rank, from kingdom to subspecies."], ["Endemic", "Found naturally in one area and nowhere else, like the Southern Birdwing in the Western Ghats."], ["Subspecies", "A geographically distinct population within a species."], ["Cultivar", "A plant variety produced by selective breeding."]]],
  ["Ecology", [["Keystone species", "A species whose removal would collapse its ecosystem."], ["Apex predator", "A predator with no natural enemies as an adult."], ["Trophic cascade", "A chain reaction through a food web from a top predator."], ["Mutualism", "A relationship where both partners benefit."], ["Biodiversity hotspot", "A region with exceptional endemism under severe threat â€” India has four."]]],
  ["Behaviour", [["Diurnal", "Active mainly by day."], ["Nocturnal", "Active mainly at night."], ["Crepuscular", "Active at dawn and dusk."], ["Aestivation", "Dormancy through hot or dry periods."], ["Aposematism", "Bright colours advertising toxicity."]]],
  ["Anatomy", [["Carapace", "The hard upper shell of a turtle or crustacean."], ["Baleen", "Keratin filter plates some whales use to strain krill."], ["Chromatophore", "A pigment cell enabling colour change."], ["Prehensile", "Capable of grasping â€” as in a seahorse's tail."], ["Epiphyte", "A plant growing on another for support, like most orchids."]]],
  ["Reproduction", [["Gestation", "Development inside the mother before birth."], ["Oviparous", "Egg-laying."], ["Viviparous", "Live-bearing."], ["Metamorphosis", "A radical change of body form during development."], ["Parthenogenesis", "Reproduction from an unfertilised egg."]]],
  ["Conservation", [["Biopiracy", "Patenting traditional knowledge without consent or benefit sharing."], ["CITES", "The treaty regulating cross-border trade in threatened species."], ["Bycatch", "Non-target animals caught in fishing gear."], ["Habitat fragmentation", "Breaking continuous habitat into isolated patches."], ["De-extinction", "Attempting to recreate an extinct species through genomics."]]]
];

function renderGlossary() {
  setTitle("Glossary of scientific terms Â· BioSphere");
  apiCached("/facets").then(function (facets) {
    var legend = facets.legend || LEGEND;
    app.innerHTML = '<div class="container page prose" style="max-width:900px"><h1>Glossary of scientific terms</h1>' +
      '<p class="muted">Every technical term used across BioSphere, in plain English.</p>' +
      '<h2>IUCN Red List categories</h2><div class="glossary-grid">' +
      Object.keys(legend).map(function (code) {
        var l = legend[code];
        return '<div class="panel gloss-item" style="display:flex;gap:10px;align-items:flex-start">' + statusBadge(code, true) + "<div><dt><b>" + esc(l.label) + "</b></dt><dd>" + esc(statusDesc(code)) + "</dd></div></div>";
      }).join("") + "</div>" +
      GLOSSARY.map(function (grp) {
        return "<h2>" + grp[0] + "</h2><div class=\"glossary-grid\">" + grp[1].map(function (pair) {
          return '<dl class="panel gloss-item"><dt>' + esc(pair[0]) + "</dt><dd>" + esc(pair[1]) + "</dd></dl>";
        }).join("") + "</div>";
      }).join("") + "</div>";
  });
}

var FAQS = [
  ["Is BioSphere Encyclopedia free?", "Yes â€” no paywall, no accounts, no advertising trackers. Teachers and students can use every feature freely."],
  ["Where do the photographs come from?", "Images are streamed live from Wikimedia Commons through the Python media proxy, which resizes them and serves them from the same origin to avoid broken or rate-limited images."],
  ["What stack powers the site?", "A hand-written HTML, CSS and JavaScript frontend; a Python (FastAPI) backend; and a PostgreSQL database â€” with Next.js acting as the static host and reverse proxy."],
  ["Why Marathi and Hindi names?", "Local names carry generations of ecological knowledge. Use the language switcher in the header to change display names."],
  ["Can I cite this site in a school project?", "Yes â€” cite the species page URL and access date. For academic work, also follow the GBIF and IUCN links on each profile."],
  ["How do I report an error?", "Use the Contribute page with the species name and the section to fix. Corrections are prioritised over new species."],
  ["Will you cover all two million described species?", "Not all at once â€” we publish the most searched and ecologically significant species first, then work outwards. Depth beats breadth."]
];

function renderFaq() {
  setTitle("FAQ Â· BioSphere");
  app.innerHTML = '<div class="container page prose" style="max-width:760px"><h1>Frequently asked questions</h1>' +
    FAQS.map(function (f) { return '<details class="panel faq-item"><summary>' + esc(f[0]) + "</summary><p>" + esc(f[1]) + "</p></details>"; }).join("") + "</div>";
}

function renderAbout() {
  setTitle("About Â· BioSphere");
  app.innerHTML = '<div class="container page prose" style="max-width:820px">' +
    '<p class="eyebrow">Our mission</p><h1>A digital natural history museum, open to everyone</h1>' +
    '<p class="muted">Around two million species have been formally described by science, and researchers estimate between 8 and 20 million more are waiting. BioSphere Encyclopedia makes that diversity understandable â€” one carefully written, beautifully illustrated profile at a time.</p>' +
    '<h2>The stack behind this page</h2>' +
    '<div class="grid grid-2">' +
    [["ðŸ–¥ï¸", "Frontend", "Hand-written HTML, CSS and JavaScript â€” a single-page app with a hash router, lazy image loading, dark mode and full keyboard accessibility."],
     ["ðŸ", "Backend", "Python with FastAPI serving 18 REST endpoints â€” species search, filters, galleries, quizzes, sightings and contributions."],
     ["ðŸ˜", "Database", "PostgreSQL stores 179 species profiles, 15 kingdoms, 90 sub-groups, sightings and community contributions."],
     ["ðŸ§©", "Reverse proxy", "Next.js serves this static frontend at the root and transparently proxies /py/* to the Python service."]].map(function (c) {
      return '<div class="panel" style="padding:18px"><span style="font-size:30px">' + c[0] + '</span><h3 style="margin:8px 0 4px">' + c[1] + "</h3><p class=\"muted\" style=\"font-size:13.5px;margin:0\">" + c[2] + "</p></div>";
    }).join("") + "</div>" +
    "<h2>Principles</h2><ul><li><strong>Accuracy before volume</strong> â€” every profile is written against published sources (IUCN, GBIF, peer review).</li><li><strong>Local names matter</strong> â€” Marathi and Hindi names sit beside the Latin binomial.</li><li><strong>Living media</strong> â€” photos stream from Wikimedia Commons; illustrated plates cover the gaps.</li><li><strong>Accessible to everyone</strong> â€” keyboard support, text scaling, high contrast, text-to-speech.</li><li><strong>Free forever</strong> â€” no paywall, no tracking walls.</li></ul>" +
    '<div class="hero-cta" style="margin-top:16px"><a class="btn btn-primary" href="#/contribute">Contribute a species</a><a class="btn btn-ghost" href="#/explore">Start exploring</a></div></div>';
}

var PRIVACY = [
  ["What we collect", "Almost nothing. No accounts, no tracking cookies. Sighting and contribution forms store only what you type, in PostgreSQL. Preferences and your life list live in your own browser's local storage."],
  ["Cookies", "None. Preferences use localStorage, which you can clear any time."],
  ["Third-party media", "Species photographs come from Wikimedia Commons through our own server-side proxy, so your browser does not contact third parties for species images. Hero photography is served by Pexels."],
  ["User submissions", "Sightings and contributions are published with the name you supply. Never submit anything you would not want public."],
  ["Accuracy disclaimer", "An educational resource, not a safety manual. Never rely on it alone to judge whether a plant, mushroom or animal is safe to eat or handle."]
];
function renderPrivacy() {
  setTitle("Privacy & terms Â· BioSphere");
  app.innerHTML = '<div class="container page prose" style="max-width:760px"><h1>Privacy &amp; terms</h1><p class="muted">Short version: we do not want your data, only your curiosity.</p>' +
    PRIVACY.map(function (s) { return '<section class="panel" style="padding:18px;margin-bottom:12px"><h2 style="margin-top:0">' + esc(s[0]) + '</h2><p class="muted" style="margin:0">' + esc(s[1]) + "</p></section>"; }).join("") + "</div>";
}

function renderNotFound(what) {
  setTitle("Not found Â· BioSphere");
  app.innerHTML = '<div class="container page"><div class="panel empty-state" style="max-width:620px;margin:30px auto">' +
    '<div class="es-emoji">ðŸ”­</div><h1 class="section-h" style="font-size:30px">Species not found</h1>' +
    (what ? '<p class="muted">Nothing matches <b>' + esc(what) + '</b>.</p>' : "") +
    '<p class="muted">This page may have gone extinct â€” around 80% of the world\'s species are still undescribed.</p>' +
    '<div class="hero-cta" style="justify-content:center"><a class="btn btn-primary" href="#/explore">Explore all species</a><a class="btn btn-ghost" href="#/">Back to home</a></div></div></div>';
}

/* ------------------------------------------------------------------ router */
var app = $("#app");
function setTitle(title) { document.title = title; }

function route() {
  var h = parseHash();
  window.scrollTo(0, 0);
  var seg = h.segs[0] || "";
  switch (seg) {
    case "": renderHome(); break;
    case "explore": renderExplore(h.q); break;
    case "species": renderSpecies(h.segs[1] ? decodeURIComponent(h.segs[1]) : ""); break;
    case "category": renderCategory(decodeURIComponent(h.segs[1] || ""), h.q); break;
    case "map": renderAtlas(h.q); break;
    case "compare": renderCompare(h.q); break;
    case "quiz": renderQuiz(); break;
    case "checklist": renderChecklist(); break;
    case "contribute": renderContribute(); break;
    case "glossary": renderGlossary(); break;
    case "faq": renderFaq(); break;
    case "about": renderAbout(); break;
    case "privacy": renderPrivacy(); break;
    default: renderNotFound(h.segs.join("/"));
  }
}

/* ------------------------------------------------------------------ header */
function initHeader() {
  var input = $("#search-input"), box = $("#suggest-box"), form = $("#search-form");
  var searchDo = debounce(function () {
    var value = input.value.trim();
    if (value.length < 2) { box.hidden = true; return; }
    api("/suggest?q=" + encodeURIComponent(value)).then(function (d) {
      if (!d.items || !d.items.length) { box.hidden = true; return; }
      box.innerHTML = d.items.map(function (it) {
        return '<li><a href="#/species/' + it.slug + '"><span class="s-emoji">' + it.emoji + '</span><span><span class="s-name">' +
          esc(lang() === "mr" && it.name_mr ? it.name_mr : it.common_name) +
          (it.name_mr && lang() !== "mr" ? ' <span class="muted">' + esc(it.name_mr) + "</span>" : "") +
          '</span><span class="s-sci">' + esc(it.scientific_name) + "</span></span></a></li>";
      }).join("");
      box.hidden = false;
      $$("a", box).forEach(function (a) { a.onclick = function () { box.hidden = true; input.value = ""; }; });
    }).catch(function () {});
  }, 200);
  input.addEventListener("input", searchDo);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (v) { box.hidden = true; location.hash = buildExploreUrl({ q: v }); }
  });
  document.addEventListener("click", function (e) {
    if (!box.contains(e.target) && e.target !== input) box.hidden = true;
  });
  $("#search-form-m").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("#search-input-m").value.trim();
    if (v) location.hash = buildExploreUrl({ q: v });
  });

  // voice search
  $("#voice-btn").onclick = function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Voice search not supported here", true); return; }
    var rec = new SR();
    rec.lang = "en-IN";
    this.classList.add("listening");
    var btn = $("#voice-btn");
    rec.onresult = function (ev) {
      input.value = ev.results[0][0].transcript;
      btn.classList.remove("listening");
      searchDo();
    };
    rec.onerror = rec.onend = function () { btn.classList.remove("listening"); };
    try { rec.start(); } catch (e) { btn.classList.remove("listening"); }
  };

  // theme
  var themeBtn = $("#theme-btn");
  var syncTheme = function () {
    var dark = pref("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "");
    themeBtn.textContent = dark ? "â˜€ï¸" : "ðŸŒ™";
  };
  themeBtn.onclick = function () {
    var now = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    setPref("theme", now); syncTheme();
  };
  syncTheme();

  // language
  $$(".lang-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.lang === lang());
    btn.onclick = function () {
      setPref("lang", btn.dataset.lang);
      $$(".lang-btn").forEach(function (b) { b.classList.toggle("active", b === btn); });
      var sInput = $("#search-input");
      sInput.placeholder = t("search");
      route();
    };
  });
  input.placeholder = t("search");

  // accessibility
  var a11yBtn = $("#a11y-btn"), a11yPop = $("#a11y-pop");
  a11yBtn.onclick = function (e) { e.stopPropagation(); a11yPop.hidden = !a11yPop.hidden; };
  document.addEventListener("click", function (e) { if (!a11yPop.contains(e.target) && e.target !== a11yBtn) a11yPop.hidden = true; });
  var scale = pref("fontScale", 1);
  $$(".font-scales button").forEach(function (b) {
    b.classList.toggle("active", Number(b.dataset.scale) === scale);
    b.onclick = function () {
      setPref("fontScale", Number(b.dataset.scale));
      document.documentElement.style.fontSize = (16 * Number(b.dataset.scale)) + "px";
      $$(".font-scales button").forEach(function (x) { x.classList.toggle("active", x === b); });
    };
  });
  var contrast = $("#contrast-toggle");
  contrast.checked = Boolean(pref("contrast", false));
  contrast.onchange = function () {
    setPref("contrast", contrast.checked);
    document.documentElement.classList.toggle("contrast", contrast.checked);
  };

  // mega menu
  var megaBtn = $("#mega-btn"), megaMenu = $("#mega-menu");
  var drawMega = function (cats) {
    megaMenu.innerHTML = '<div class="mega-grid">' + cats.map(function (c) {
      return '<a class="mega-cat" href="#/category/' + c.slug + '"><span class="cat-emoji" style="background:linear-gradient(135deg,' + c.accent_from + "," + c.accent_to + ')">' + c.emoji + "</span><span><span class=\"cat-name\">" + esc(c.name) + '</span><span class="cat-meta">' + esc(c.known_species) + " Â· " + (c.species_count || 0) + " profiles</span></span></a>";
    }).join("") + "</div>";
    $$("a", megaMenu).forEach(function (a) { a.onclick = function () { megaMenu.hidden = true; megaBtn.setAttribute("aria-expanded", "false"); }; });
  };
  apiCached("/categories").then(drawMega).catch(function () {});
  megaBtn.onclick = function () {
    megaMenu.hidden = !megaMenu.hidden;
    megaBtn.setAttribute("aria-expanded", String(!megaMenu.hidden));
  };
  $(".has-mega").addEventListener("mouseenter", function () { megaMenu.hidden = false; });
  $(".has-mega").addEventListener("mouseleave", function () { megaMenu.hidden = true; });

  // mobile menu
  var menuBtn = $("#menu-btn"), mobileMenu = $("#mobile-menu");
  menuBtn.onclick = function () { mobileMenu.hidden = !mobileMenu.hidden; menuBtn.textContent = mobileMenu.hidden ? "â˜°" : "âœ•"; };
  apiCached("/categories").then(function (cats) {
    $("#mobile-cats").innerHTML = cats.map(function (c) { return '<a href="#/category/' + c.slug + '">' + c.emoji + " " + esc(c.name) + "</a>"; }).join("");
  }).catch(function () {});
  mobileMenu.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { mobileMenu.hidden = true; menuBtn.textContent = "â˜°"; }
  });

  // footer
  apiCached("/categories").then(function (cats) {
    var box = $("#footer-cats");
    box.innerHTML = '<p class="footer-title">Kingdoms</p>' + cats.slice(0, 8).map(function (c) {
      return '<a href="#/category/' + c.slug + '">' + c.emoji + " " + esc(c.name) + "</a>";
    }).join("");
  }).catch(function () {});
  $("#footer-copy").textContent = "Â© " + new Date().getFullYear() + " BioSphere Encyclopedia Â· Frontend: HTML + CSS + JS Â· Backend: Python (FastAPI) Â· Database: PostgreSQL Â· Photos: Wikimedia Commons";
}

/* ------------------------------------------------------------------ boot */
window.addEventListener("hashchange", route);
document.addEventListener("DOMContentLoaded", function () {
  app = $("#app");
  initHeader();
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    // Optional PWA hook â€” registration only if a worker exists.
  }
});
})();
