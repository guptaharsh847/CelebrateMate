/// <reference types="vitest" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('.', import.meta.url));

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Emits dist/sw.js from pwa/service-worker.js with the exact list of built
 * files to precache and a build ID (content hash) so every deploy updates the
 * worker and purges the old cache.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'celebratemate-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicDir = join(root, 'public');
      const publicFiles = listFiles(publicDir)
        .map((f) => relative(publicDir, f).split('\\').join('/'))
        .filter((f) => !f.endsWith('.md'));
      // index.html is emitted by Vite's HTML plugin after this hook, so add it explicitly.
      const precache = [...new Set(['index.html', ...built, ...publicFiles])].sort();

      const hash = createHash('sha256');
      for (const name of built) {
        const item = bundle[name];
        hash.update(name);
        if (item) hash.update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const f of publicFiles) hash.update(f).update(readFileSync(join(publicDir, f)));
      const buildId = hash.digest('hex').slice(0, 16);

      const source = readFileSync(join(root, 'pwa/service-worker.js'), 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace('__PRECACHE_URLS__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// VITE_BASE_PATH controls the public base path. For GitHub Pages project sites
// this must be "/<repo-name>/" (e.g. "/CelebrateMate/"). Defaults to "/" locally.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let base = env.VITE_BASE_PATH || '/';
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  if (/[:\\\s]/.test(base)) {
    // e.g. Git Bash on Windows rewrites "/CelebrateMate/" to "C:/Program Files/Git/CelebrateMate/".
    throw new Error(`VITE_BASE_PATH looks like a filesystem path ("${base}"). Use "/<repo>/". In Git Bash, prefix the command with MSYS_NO_PATHCONV=1.`);
  }

  return {
    base,
    plugins: [react(), serviceWorkerPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
