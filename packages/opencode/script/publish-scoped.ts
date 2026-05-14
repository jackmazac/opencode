#!/usr/bin/env bun
/**
 * Publish a scoped npm CLI (`@mazac-fox/opencode` by default) plus scoped platform
 * packages (`@mazac-fox/opencode-darwin-arm64`, …). Does not run Docker/AUR/Homebrew.
 *
 * Prerequisites: `./script/build.ts` has populated `./dist/<platform>/` with package.json + bin.
 *
 * Env:
 *   OPENCODE_NPM_SCOPE — default `@mazac-fox`
 *   OPENCODE_NPM_META_NAME — default `<scope>/opencode`
 */
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@opencode-ai/script"
import { fileURLToPath } from "url"

const root = fileURLToPath(new URL("..", import.meta.url))
process.chdir(root)

const scopeRaw = process.env.OPENCODE_NPM_SCOPE ?? "@mazac-fox"
const scope = scopeRaw.startsWith("@") ? scopeRaw : `@${scopeRaw}`
const metaName = process.env.OPENCODE_NPM_META_NAME ?? `${scope}/opencode`

function scopedPlatformPackage(folderName: string): string {
  if (folderName.startsWith("@")) return folderName
  return `${scope}/${folderName}`
}

async function published(name: string, version: string): Promise<boolean> {
  return (await $`npm view ${name}@${version} version`.nothrow()).exitCode === 0
}

async function publishDir(dir: string, npmName: string, version: string): Promise<void> {
  if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(dir)
  if (await published(npmName, version)) {
    console.log(`already published ${npmName}@${version}`)
    return
  }
  await $`bun pm pack`.cwd(dir)
  await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(dir)
}

const binaries: Record<string, string> = {}
const platformDirs: string[] = []

for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const dirName = filepath.split("/")[0] ?? ""
  if (dirName === "" || dirName === "npm-scoped-meta") continue
  if (dirName === pkg.name && !dirName.includes("-")) continue
  if (!dirName.startsWith(`${pkg.name}-`)) continue

  const jpath = `./dist/${filepath}`
  const j = (await Bun.file(jpath).json()) as { name?: string; version?: string }
  if (typeof j.name !== "string" || typeof j.version !== "string") continue

  const scopedN = j.name.startsWith(`${scope}/`) ? j.name : scopedPlatformPackage(j.name)
  await Bun.write(jpath, JSON.stringify({ ...j, name: scopedN }, null, 2) + "\n")
  binaries[scopedN] = j.version
  platformDirs.push(dirName)
}

if (platformDirs.length === 0) {
  console.error("publish-scoped: no platform packages under dist/ — run ./script/build.ts first")
  process.exit(1)
}

const version = Object.values(binaries)[0]
if (!version) {
  console.error("publish-scoped: could not resolve version")
  process.exit(1)
}

const staging = "./dist/npm-scoped-meta"
await $`rm -rf ./dist/npm-scoped-meta`
await $`mkdir -p ${staging}`
await $`cp -r ./bin ${staging}/bin`
await $`cp ./script/postinstall.mjs ${staging}/postinstall.mjs`
await Bun.file(`${staging}/LICENSE`).write(await Bun.file("../../LICENSE").text())

await Bun.file(`${staging}/package.json`).write(
  JSON.stringify(
    {
      name: metaName,
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version,
      license: pkg.license,
      optionalDependencies: binaries,
    },
    null,
    2,
  ) + "\n",
)

console.log("publish-scoped: platform packages", binaries)

await Promise.all(
  platformDirs.map(async (folder) => {
    const npmN = scopedPlatformPackage(folder)
    await publishDir(`./dist/${folder}`, npmN, binaries[npmN] ?? version)
  }),
)
await publishDir(staging, metaName, version)

console.log(`publish-scoped: published meta ${metaName}@${version}`)
