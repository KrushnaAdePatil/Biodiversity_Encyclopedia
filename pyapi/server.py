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
