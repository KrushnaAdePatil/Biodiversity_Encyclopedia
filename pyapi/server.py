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
