"""BioSphere Encyclopedia — Python backend (FastAPI + PostgreSQL).

Serves every API used by the vanilla HTML/CSS/JS frontend.
"""
from __future__ import annotations

import json
import os
import random
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import psycopg
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/app_db"
)
UA = "BioSphereEncyclopedia/2.0 (python backend; educational project)"

app = FastAPI(title="BioSphere Encyclopedia API", version="2.0")

CONSERVATION = {
    "EX": ("Extinct", "#000000"),
    "EW": ("Extinct in the Wild", "#3f3f46"),
    "CR": ("Critically Endangered", "#dc2626"),
    "EN": ("Endangered", "#ea580c"),
    "VU": ("Vulnerable", "#d97706"),
    "NT": ("Near Threatened", "#65a30d"),
    "LC": ("Least Concern", "#16a34a"),
    "DD": ("Data Deficient", "#64748b"),
    "NE": ("Not Evaluated", "#94a3b8"),
    "DOM": ("Domesticated", "#0ea5e9"),
}

CARD_COLUMNS = (
    "slug, common_name, name_mr, name_hi, scientific_name, category_slug,"
    " subcategory_slug, emoji, summary, conservation, diet_type, habitats,"
    " continents, length_cm, weight_kg, lifespan_wild, wiki_title, popularity, tags"
)

_media_cache: dict[str, tuple[float, Any]] = {}
MEDIA_TTL = 60 * 60 * 12


# ----------------------------------------------------------------------------- db
def db() -> Any:
    return psycopg.connect(DATABASE_URL, autocommit=True)


def _clean(value: Any) -> Any:
    import datetime as _dt
    import decimal as _dec

    if isinstance(value, (_dt.datetime, _dt.date)):
        return value.isoformat()
    if isinstance(value, _dec.Decimal):
        return float(value)
    return value


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    with db() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        cols = [d.name for d in cur.description]
        return [{k: _clean(v) for k, v in zip(cols, row)} for row in cur.fetchall()]


def fetch_one(query: str, params: tuple = ()) -> dict | None:
    rows = fetch_all(query, params)
    return rows[0] if rows else None


# ----------------------------------------------------------------------------- helpers
def _csv(value: str | None) -> list[str]:
    return [v for v in (value or "").split(",") if v]


def json_response(payload: Any, seconds: int = 300) -> JSONResponse:
    resp = JSONResponse(payload)
    resp.headers["Cache-Control"] = f"public, max-age={seconds}, stale-while-revalidate=3600"
    return resp


# ----------------------------------------------------------------------------- health
@app.get("/ping")
def ping() -> dict:
    return {"ok": True, "backend": "python", "framework": "fastapi"}


# ----------------------------------------------------------------------------- stats
@app.get("/stats")
def stats() -> Any:
    row = fetch_all(
        """
        select count(*) as total,
          count(*) filter (where conservation in ('CR','EN','VU')) as threatened,
          count(*) filter (where conservation = 'EX') as extinct,
          (select count(*) from categories) as categories,
          (select count(distinct c) from species, unnest(countries) as c) as countries,
          (select count(*) from sightings) as sightings
        from species"""
    )
    return json_response(row[0] if row else {}, 600)


# ----------------------------------------------------------------------------- taxonomy
@app.get("/categories")
def categories() -> Any:
    cats = fetch_all("select * from categories order by sort_order")
    counts = fetch_all(
        "select category_slug as slug, count(*) as n from species group by category_slug"
    )
    mapping = {c["slug"]: c["n"] for c in counts}
    for cat in cats:
        cat["species_count"] = mapping.get(cat["slug"], 0)
    return json_response(cats, 3600)


@app.get("/subcategories")
def subcategories(category: str | None = None) -> Any:
    if category:
        rows = fetch_all(
            "select * from subcategories where category_slug = %s order by sort_order",
            (category,),
        )
        counts = fetch_all(
            "select subcategory_slug as slug, count(*) as n from species where category_slug = %s group by subcategory_slug",
            (category,),
        )
    else:
        rows = fetch_all("select * from subcategories order by sort_order")
        counts = fetch_all(
            "select subcategory_slug as slug, count(*) as n from species group by subcategory_slug"
        )
    mapping = {c["slug"]: c["n"] for c in counts}
    for row in rows:
        row["species_count"] = mapping.get(row["slug"], 0)
    return json_response(rows, 3600)


@app.get("/facets")
def facets() -> Any:
    return json_response(
        {
            "habitats": fetch_all(
                "select h as value, count(*) as count from species, unnest(habitats) h group by h order by count desc"
            ),
            "diets": fetch_all(
                "select diet_type as value, count(*) as count from species group by diet_type order by count desc"
            ),
            "conservation": [
                {**row, "label": CONSERVATION.get(row["value"], (row["value"], ""))[0]}
                for row in fetch_all(
                    "select conservation as value, count(*) as count from species group by conservation order by count desc"
                )
            ],
            "continents": fetch_all(
                "select c as value, count(*) as count from species, unnest(continents) c group by c order by count desc"
            ),
            "legend": {k: {"label": v[0], "color": v[1]} for k, v in CONSERVATION.items()},
        },
        3600,
    )


# ----------------------------------------------------------------------------- species list
def _where(filters: dict) -> tuple[str, list]:
    clauses: list[str] = []
    params: list[Any] = []
    if filters.get("q"):
        params.append(f"%{filters['q'].lower()}%")
        t = filters["q"]
        clauses.append(
            "(lower(common_name) like %s or lower(scientific_name) like %s or name_mr like %s"
            " or name_hi like %s or lower(summary) like %s or lower(array_to_string(tags,' ')) like %s)"
        )
        params.extend([f"%{t.lower()}%"] * 5)
    if filters.get("category"):
        clauses.append("category_slug = %s")
        params.append(filters["category"])
    if filters.get("sub"):
        clauses.append("subcategory_slug = %s")
        params.append(filters["sub"])
    if filters.get("conservation"):
        clauses.append("conservation = any(%s)")
        params.append(_csv(filters["conservation"]))
    if filters.get("diet"):
        clauses.append("diet_type = any(%s)")
        params.append(_csv(filters["diet"]))
    if filters.get("habitat"):
        clauses.append("habitats && %s")
        params.append(_csv(filters["habitat"]))
    if filters.get("continent"):
        clauses.append("continents && %s")
        params.append(_csv(filters["continent"]))
    if filters.get("tag"):
        clauses.append("tags && %s")
        params.append([filters["tag"]])
    if filters.get("letter"):
        clauses.append("upper(left(common_name,1)) = %s")
        params.append(filters["letter"].upper())
    return (" where " + " and ".join(clauses), params) if clauses else ("", params)


_ORDER = {
    "az": "common_name asc",
    "za": "common_name desc",
    "largest": "length_cm desc",
    "smallest": "length_cm asc",
    "longest-lived": "lifespan_wild desc",
    "rarest": (
        "case conservation when 'EX' then 0 when 'EW' then 1 when 'CR' then 2 when 'EN' then 3"
        " when 'VU' then 4 when 'NT' then 5 when 'LC' then 6 else 7 end asc"
    ),
    "popular": "popularity desc",
}


@app.get("/species")
def species_list(request: Request) -> Any:
    q = dict(request.query_params)
    page = max(1, int(q.get("page", 1) or 1))
    per_page = min(200, max(6, int(q.get("perPage", 24) or 24)))
    where, params = _where(q)
    order = _ORDER.get(q.get("sort") or "popular", "popularity desc")
    params.extend([per_page, (page - 1) * per_page])
    items = fetch_all(
        f"select {CARD_COLUMNS} from species{where} order by {order}, common_name asc limit %s offset %s",
        tuple(params),
    )
    total = fetch_one(f"select count(*) as n from species{where}", tuple(params[:-2])) or {"n": 0}
    return json_response({"items": items, "total": total["n"], "page": page, "perPage": per_page})


@app.get("/species/{slug}")
def species_one(slug: str) -> Any:
    row = fetch_one("select * from species where slug = %s", (slug,))
    if not row:
        raise HTTPException(status_code=404, detail="species not found")
    related_slugs = row.get("related_slugs") or []
    related = fetch_all(
        f"select {CARD_COLUMNS} from species where slug = any(%s)", (related_slugs,)
    ) if related_slugs else []
    if not related:
        related = fetch_all(
            f"select {CARD_COLUMNS} from species where category_slug = %s and slug != %s order by popularity desc limit 4",
            (row["category_slug"], slug),
        )
    sightings = fetch_all(
        "select * from sightings where species_slug = %s order by created_at desc limit 30",
        (slug,),
    )
    return json_response({"species": row, "related": related, "sightings": sightings})


@app.get("/suggest")
def suggest(q: str = Query("")) -> Any:
    term = q.strip().lower()
    if len(term) < 2:
        return json_response({"items": []})
    rows = fetch_all(
        "select slug, common_name, scientific_name, name_mr, name_hi, emoji, category_slug"
        " from species where lower(common_name) like %s or lower(scientific_name) like %s"
        " or name_mr like %s or name_hi like %s or lower(array_to_string(tags,' ')) like %s"
        " order by popularity desc limit 8",
        (f"%{term}%",) * 5,
    )
    return json_response({"items": rows})


# ----------------------------------------------------------------------------- featured
@app.get("/day")
def day() -> Any:
    total = fetch_one("select count(*) as n from species") or {"n": 0}
    if not total["n"]:
        return json_response({})
    offset = int(time.time() // 86400) % total["n"]
    row = fetch_one("select * from species order by slug asc limit 1 offset %s", (offset,))
    return json_response({"species": row}, 300)


@app.get("/trending")
def trending() -> Any:
    return json_response(
        {"items": fetch_all(f"select {CARD_COLUMNS} from species order by popularity desc limit 8")},
        600,
    )


@app.get("/facts")
def facts() -> Any:
    rows = fetch_all(
        "select slug, common_name, emoji, facts from species where array_length(facts, 1) > 0 order by random() limit 6"
    )
    for row in rows:
        row_facts = row.pop("facts") or [""]
        row["fact"] = random.choice(row_facts)
    return json_response({"items": rows})


@app.get("/quiz")
def quiz(count: int = Query(8, ge=3, le=15)) -> Any:
    pool = fetch_all(
        "select slug, common_name, scientific_name, emoji, summary, wiki_title, category_slug, facts"
        " from species order by random() limit %s",
        (max(40, count * 6),),
    )
    questions = []
    used: set[str] = set()
    for item in pool:
        if len(questions) >= count:
            break
        distractors = [p for p in pool if p["slug"] not in used and p["slug"] != item["slug"]][:3]
        if len(distractors) < 3:
            continue
        used.add(item["slug"])
        options = [{"slug": item["slug"], "name": item["common_name"]}] + [
            {"slug": d["slug"], "name": d["common_name"]} for d in distractors
        ]
        random.shuffle(options)
        questions.append(
            {
                "slug": item["slug"],
                "wikiTitle": item["wiki_title"],
                "emoji": item["emoji"],
                "hint": (item["facts"] or [item["summary"]])[0],
                "scientificName": item["scientific_name"],
                "answer": item["slug"],
                "options": options,
            }
        )
    return json_response({"questions": questions})


@app.get("/atlas")
def atlas(region: str = Query("Asia")) -> Any:
    items = fetch_all(
        f"select {CARD_COLUMNS} from species where continents && %s order by popularity desc limit 24",
        ([region],),
    )
    counts = fetch_all(
        "select c as value, count(*) as count from species, unnest(continents) c group by c"
    )
    return json_response({"items": items, "counts": counts})
