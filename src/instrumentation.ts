/**
 * Launches the Python (FastAPI) backend alongside the Next.js server.
 * The Next server proxies /py/* to http://127.0.0.1:8000/*.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    const globalState = globalThis as typeof globalThis & { __biospherePy?: boolean };
    if (globalState.__biospherePy) return;
    globalState.__biospherePy = true;

    // Reuse a backend that is already listening (survives server restarts).
    try {
        const res = await fetch("http://127.0.0.1:8000/ping", {
            signal: AbortSignal.timeout(1500),
        });
        if (res.ok) return;
    } catch {
        /* backend not up yet */
    }

    try {
        const { spawn } = await import("node:child_process");
        const { createWriteStream } = await import("node:fs");
        const path = await import("node:path");
        const pyDir = path.join(process.cwd(), "pyapi");
        const log = createWriteStream("/tmp/pyt-backend.log", { flags: "a" });
        const child = spawn(
            process.env.PYTHON_BIN ?? "python3",
            ["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8000"],
            {
                cwd: pyDir,
                env: {
                    ...process.env,
                    PYTHONPATH: path.join(pyDir, "vendor"),
                },
                detached: true,
                stdio: ["ignore", log, log],
            },
        );
        child.unref();
    } catch (error) {
        console.error("[instrumentation] failed to start python backend", error);
    }
}
