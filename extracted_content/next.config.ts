import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // Vanilla HTML/CSS/JS frontend served at the root
        { source: "/", destination: "/index.html" },
        // Python (FastAPI) backend proxied from the same origin
        { source: "/py/:path*", destination: "http://127.0.0.1:8000/:path*" },
      ],
    };
  },
};

export default nextConfig;
