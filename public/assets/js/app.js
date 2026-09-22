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
