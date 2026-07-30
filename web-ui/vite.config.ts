import { defineConfig, Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve, dirname } from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))

const ENGINE_ROOT = resolve(HERE, "../web")

/**
 * The vendored engine (../web) is plain TypeScript written for tsc with
 * NodeNext-style `./module.js` specifiers pointing at compiled output. Map
 * those onto the .ts sources so Vite can consume the engine directly.
 *
 * `./config.js` is special: the Rust server serves it dynamically
 * (path_prefix injection). We virtualize it — this deployment doesn't use a
 * path prefix.
 */
function engineResolver(): Plugin {
    const VIRTUAL_CONFIG = "\0engine-config-js"
    const VIRTUAL_WASM_STUB = "\0engine-wasm-stub"
    return {
        name: "engine-resolver",
        enforce: "pre",
        resolveId(source, importer) {
            if (!importer || !importer.startsWith(ENGINE_ROOT)) {
                return null
            }
            if (source.endsWith("/config.js") || source === "./config.js") {
                return VIRTUAL_CONFIG
            }
            if (source.startsWith(".") && source.endsWith(".js")) {
                const tsPath = resolve(dirname(importer), source.slice(0, -3) + ".ts")
                if (existsSync(tsPath)) {
                    return tsPath
                }
                if (existsSync(resolve(dirname(importer), source))) {
                    // A real .js file (e.g. libopus/libopus.js); default resolution handles it.
                    return null
                }
                if (/libopenh264|libopus/.test(source)) {
                    // Optional prebuilt wasm decoder files, not in the repo
                    // (fetched at release-build time). The engine probes them
                    // with `await import(...)` inside try/catch; a module that
                    // throws on evaluation makes the probe fail cleanly.
                    return VIRTUAL_WASM_STUB
                }
            }
            return null
        },
        load(id) {
            if (id === "\0engine-config-js") {
                return "export default { path_prefix: \"\" }"
            }
            if (id === "\0engine-wasm-stub") {
                return "throw new Error(\"wasm decoder not bundled\")"
            }
            return null
        },
    }
}

export default defineConfig({
    plugins: [engineResolver(), react(), tailwindcss()],
    // The engine's worker pipeline resolves pipes by class name at runtime;
    // minification must not rename them.
    esbuild: {
        keepNames: true,
    },
    worker: {
        format: "es",
        plugins: () => [engineResolver()],
    },
    resolve: {
        alias: {
            "@engine": ENGINE_ROOT,
        },
    },
    server: {
        port: 5180,
        fs: {
            // The vendored engine lives in the parent repo (../web)
            allow: [".."],
        },
        proxy: {
            "/api": {
                target: "http://127.0.0.1:8081",
                ws: true,
                configure(proxy) {
                    proxy.on("proxyReqWs", (_proxyReq, req) => {
                        console.log("[ws-upgrade]", req.url, "cookie:", req.headers.cookie ? "present" : "MISSING")
                    })
                    proxy.on("error", (err) => {
                        console.log("[proxy-error]", err.message)
                    })
                },
            },
        },
    },
    build: {
        outDir: "../dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: resolve(HERE, "index.html"),
                stream: resolve(HERE, "stream.html"),
            },
        },
    },
})
