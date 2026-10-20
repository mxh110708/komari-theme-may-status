# Repository Guidelines

## Project Structure & Module Organization

May Status is a Vue 3/Vite theme for Komari, not a standalone administration app. Application code is in `src/`; read `src/AGENTS.md` before editing it. Components use reka-ui and Tailwind CSS v4. Static resources are in `public/`, including flags, logos, and network-only PWA overrides. `komari-theme.json` defines theme identity and managed settings; `docs/preview.png` is a required packaging input. Maintenance scripts live in `scripts/`.

## Build, Test, and Development Commands

Run from the repository root with Bun 1.3.14:

```sh
bun install --frozen-lockfile
bun run dev
bun run lint
bun run build
bun run check:package
bun run test:package
```

`dev` starts Vite. `lint` fixes files and writes its cache; review the resulting diff. `build` runs Vue/TypeScript checking, builds `dist/`, checks PWA resources, and creates `komari-theme-may-status-build-<sha>.zip`. `check:package` rechecks packaging inputs and built resources; it is not a full application test suite. Use `bun run preview` for production preview.

## Coding Style & Naming Conventions

Follow ESLint's Antfu configuration: two-space indentation and existing TypeScript/Vue conventions. Use Composition API and `<script setup lang="ts">`, `@/` source imports, and shared helpers. Keep ordinary display text in professional Chinese; preserve protocol names and user-defined node names. Do not introduce Naive UI, UnoCSS, SCSS, or a second icon pipeline.

## Testing & Release Guidelines

There is no general application test framework or coverage threshold. Node's built-in test runner checks packaging failure cases with `test:package`. Run lint, build, package checks, and relevant browser checks. `build-ci.yml` validates pushes and pull requests; `release-on-version-bump.yml` publishes version changes on `main`. Keep package/manifest versions equal. Preserve ZIP contents: `dist/`, `komari-theme.json`, and `preview.png`. Never omit the two PWA overrides or silently replace release attachments.

## Commit, Pull Request & Security Guidelines

History uses concise `feat:`, `fix:`, and `refine:` subjects. Keep commits focused. PRs should describe behavior, compatibility, verification, and include screenshots for UI changes. Preserve `short=GlassmorphismEnhanced` and saved settings. Never commit credentials, databases, private VPS archives, or tokens. Production installation and browser/cache operations require explicit authorization.
