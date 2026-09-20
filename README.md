# BioSphere Encyclopedia

A visually stunning, full-stack biodiversity encyclopedia documenting species across the globe. Features 179 hand-curated species profiles, beautiful glassmorphism designs, multi-language support (English, Marathi, Hindi), interactive mapping, and a dynamic quiz system.

## 🚀 Architecture
- **Frontend Engine**: Next.js 15 (React 19) serving a blazing fast Vanilla JS/HTML/CSS SPA skeleton.
- **Styling**: TailwindCSS v4 + native CSS animation keyframes.
- **Backend API**: Python FastAPI (proxied gracefully via Next.js rewrites) running on Uvicorn.
- **Database**: PostgreSQL with Drizzle ORM managing taxonomy, relations, species arrays, and JSONB schemas.
- **Media**: Real-time Wikipedia fetching and proxy-caching mechanism for dynamic image galleries.

## 📦 Running Locally
Make sure you have Node > 20 and Python 3 installed. You'll need PostgreSQL running locally or in Docker.

```bash
# 1. Install frontend and backend packages
npm run preinstall

# 2. Setup your Database variables
# Create a .env.local file with your DATABASE_URL

# 3. Apply schema migrations
npm run db:push

# 4. Start the Application! 
npm run dev
# The Node instrumentation script will automatically spin up the Python server!
```

## ✨ Highlights
- Beautiful **D3-inspired SVG** and CSS rendering
- Integrated **Drizzle ORM** for seamless schema synchronization
- Interactive **Geo-Atlas** mapping of animal populations
- Caching Wikimedia queries and **on-the-fly Image optimization**
- Handcrafted database structure seeded via automated FastAPI `startup()` lifecycle hooks!
