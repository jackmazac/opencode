# Scoped npm CLI (`@mazac-fox/opencode`)

Upstream publishes the meta package as **`opencode-ai`** with unscoped platform packages (`opencode-darwin-arm64`, …). For a fork under **`@mazac-fox`**, use **`script/publish-scoped.ts`** after a normal **`script/build.ts`** run.

## Install (end users)

```bash
npm install -g @mazac-fox/opencode
# or
bun add -g @mazac-fox/opencode
```

The **`bin/opencode`** shim and **`postinstall.mjs`** resolve **`@mazac-fox/opencode-<platform>-<arch>`** optional dependencies when the meta package name is scoped.

## Maintainer flow

1. From repo root / CI artifacts: ensure **`packages/opencode/dist/`** contains per-platform folders (see **`script/build.ts`** / release workflow).
2. In **`packages/opencode`**:

   ```bash
   bun run publish:scoped
   ```

3. Optional environment variables:
   - **`OPENCODE_NPM_SCOPE`** — default `@mazac-fox`
   - **`OPENCODE_NPM_META_NAME`** — default `<scope>/opencode`

Re-run publish only from a **fresh `dist/`** from build; the script rewrites each platform `package.json` **`name`** to the scoped form.

## Upstream alignment

This does **not** replace the full **`script/publish.ts`** pipeline (Docker, AUR, Homebrew, GitHub releases). Use **`publish-scoped.ts`** when you only need npm registry artifacts under your scope.
