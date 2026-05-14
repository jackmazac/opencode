#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function detectPlatformAndArch() {
  // Map platform names
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
      break
  }

  // Map architecture names
  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    case "arm":
      arch = "arm"
      break
    default:
      arch = os.arch()
      break
  }

  return { platform, arch }
}

function metaPlatformScope() {
  try {
    const metaPath = path.join(__dirname, "package.json")
    const parsed = JSON.parse(fs.readFileSync(metaPath, "utf8"))
    if (typeof parsed.name === "string" && parsed.name.startsWith("@")) {
      const slash = parsed.name.lastIndexOf("/")
      if (slash !== -1) return parsed.name.slice(0, slash)
    }
  } catch {
    // ignore
  }
  return ""
}

function platformPkgNames(platform, arch) {
  const base = `opencode-${platform}-${arch}`
  const scope = metaPlatformScope()
  if (scope) return [`${scope}/${base}`, base]
  return [base]
}

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const binaryName = platform === "windows" ? "opencode.exe" : "opencode"
  const names = platformPkgNames(platform, arch)
  let lastError = null
  for (const packageName of names) {
    try {
      const packageJsonPath = require.resolve(`${packageName}/package.json`)
      const packageDir = path.dirname(packageJsonPath)
      const binaryPath = path.join(packageDir, "bin", binaryName)

      if (!fs.existsSync(binaryPath)) {
        throw new Error(`Binary not found at ${binaryPath}`)
      }

      return { binaryPath, binaryName }
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Could not find platform package (tried ${names.join(", ")}): ${lastError?.message ?? ""}`, {
    cause: lastError,
  })
}

async function main() {
  try {
    if (os.platform() === "win32") {
      // On Windows, the .exe is already included in the package and bin field points to it
      // No postinstall setup needed
      console.log("Windows detected: binary setup not needed (using packaged .exe)")
      return
    }

    // On non-Windows platforms, just verify the binary package exists
    // Don't replace the wrapper script - it handles binary execution
    const { binaryPath } = findBinary()
    const target = path.join(__dirname, "bin", ".opencode")
    if (fs.existsSync(target)) fs.unlinkSync(target)
    try {
      fs.linkSync(binaryPath, target)
    } catch {
      fs.copyFileSync(binaryPath, target)
    }
    fs.chmodSync(target, 0o755)
  } catch (error) {
    console.error("Failed to setup opencode binary:", error.message)
    process.exit(1)
  }
}

try {
  void main()
} catch (error) {
  console.error("Postinstall script error:", error.message)
  process.exit(0)
}
