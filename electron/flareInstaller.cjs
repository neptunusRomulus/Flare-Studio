/**
 * One-click Flare install for Flare Studio.
 *
 * Nothing is bundled with Studio. The official flare-game release is downloaded
 * on demand and unpacked into the user's data directory:
 *
 *   Linux:   $XDG_DATA_HOME/flare-studio/engines/<tag>/   (default ~/.local/share/...)
 *   Windows: %LOCALAPPDATA%\flare-studio\engines\<tag>\   (not wired up yet)
 *
 * The data directory is used instead of app.getPath('userData') (~/.config/...),
 * because the content is hundreds of MB and is data, not configuration.
 *
 * Linux ships engine + content as one AppImage. `--appimage-extract` unpacks it
 * without FUSE into squashfs-root/: AppRun is the launcher, the mods live in
 * squashfs-root/usr/share/flare/mods. Each tag is a separate folder, so Modern
 * and Classic can be installed side by side.
 *
 * Everything here is free of Electron so it can be unit tested and run from a
 * plain node script.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { execFile } = require("child_process");

const RELEASE_BASE = "https://github.com/flareteam/flare-game/releases/download";

const VARIANTS = {
  // 1.15: full HD era content, 192x96 isometric tiles.
  modern: { tag: "v1.15", version: "1.15", tile: { width: 192, height: 96 } },
  // 1.14: the older engine with 64x32 content.
  classic: { tag: "v1.14", version: "1.14", tile: { width: 64, height: 32 } },
};

const EXTRACT_DIR = "squashfs-root";

function variantInfo(variant) {
  return Object.prototype.hasOwnProperty.call(VARIANTS, variant) ? VARIANTS[variant] : null;
}

/**
 * Release asset for a variant on a platform.
 * Windows is described here so adding it later only needs the zip extractor.
 */
function releaseAsset(variant, platform) {
  const info = variantInfo(variant);
  if (!info) return { error: `Unknown Flare variant: ${variant}` };
  let file;
  let kind;
  if (platform === "linux") {
    file = `flare-linux64-${info.tag}.AppImage`;
    kind = "appimage";
  } else if (platform === "win32") {
    file = `flare-win-${info.tag}.zip`;
    kind = "zip";
  } else {
    return { error: "Installing Flare is not supported on this platform yet." };
  }
  return { tag: info.tag, version: info.version, file, kind, url: `${RELEASE_BASE}/${info.tag}/${file}` };
}

/** Platforms the installer can finish today. */
function isInstallSupported(platform) {
  return platform === "linux";
}

function installRoot({ platform = process.platform, env = process.env, homedir = os.homedir() } = {}) {
  if (platform === "win32") {
    const base = env.LOCALAPPDATA || path.win32.join(homedir, "AppData", "Local");
    return path.win32.join(base, "flare-studio", "engines");
  }
  const base = env.XDG_DATA_HOME || path.posix.join(homedir, ".local", "share");
  return path.posix.join(base, "flare-studio", "engines");
}

function installDirFor(variant, options = {}) {
  const info = variantInfo(variant);
  if (!info) return "";
  const p = options.platform === "win32" ? path.win32 : path.posix;
  return p.join(installRoot(options), info.tag);
}

/** Paths inside an extracted AppImage install. */
function extractedLayout(installDir) {
  const root = path.posix.join(installDir, EXTRACT_DIR);
  return {
    root,
    exePath: path.posix.join(root, "AppRun"),
    dataPath: path.posix.join(root, "usr", "share", "flare"),
  };
}

/** Which installed variant a saved Flare path belongs to, from engines/<tag>/. */
function variantForFlarePath(flarePath) {
  const normalized = String(flarePath || "").replace(/\\/g, "/");
  const match = normalized.match(/\/flare-studio\/engines\/(v[\d.]+)\//);
  if (!match) return null;
  for (const [name, info] of Object.entries(VARIANTS)) {
    if (info.tag === match[1]) return name;
  }
  return null;
}

/** Tile size new projects should start with for the active Flare path. */
function tileForFlarePath(flarePath) {
  const variant = variantForFlarePath(flarePath);
  const info = variant ? VARIANTS[variant] : VARIANTS.modern;
  return { ...info.tile };
}

/** "INFO: Flare 1.14 (Linux)" -> "1.14" */
function parseFlareVersion(output) {
  const match = String(output || "").match(/Flare\s+v?(\d+(?:\.\d+)+)/i);
  return match ? match[1] : "";
}

/**
 * Stream url to dest, following redirects. Writes dest + ".part" and renames
 * on success; the .part file is removed on failure.
 */
function downloadFile(url, dest, { onProgress, maxRedirects = 8, get = https.get } = {}) {
  const partPath = `${dest}.part`;
  return new Promise((resolve, reject) => {
    let finished = false;
    const fail = (err) => {
      if (finished) return;
      finished = true;
      try {
        fs.rmSync(partPath, { force: true });
      } catch {
        /* ignore */
      }
      reject(err);
    };

    const request = (target, redirectsLeft) => {
      const req = get(target, { headers: { "User-Agent": "Flare-Studio" } }, (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            fail(new Error("Too many redirects while downloading Flare."));
            return;
          }
          request(new URL(res.headers.location, target).toString(), redirectsLeft - 1);
          return;
        }
        if (status !== 200) {
          res.resume();
          fail(new Error(`Download failed (HTTP ${status}).`));
          return;
        }
        const total = parseInt(res.headers["content-length"] || "0", 10) || 0;
        let received = 0;
        let lastEmit = 0;
        const out = fs.createWriteStream(partPath);
        res.on("data", (chunk) => {
          received += chunk.length;
          const now = Date.now();
          if (onProgress && now - lastEmit > 250) {
            lastEmit = now;
            onProgress({ received, total });
          }
        });
        res.on("error", fail);
        out.on("error", fail);
        out.on("finish", () => {
          if (finished) return;
          if (total && received !== total) {
            fail(new Error(`Download was cut off (${received} of ${total} bytes).`));
            return;
          }
          try {
            fs.renameSync(partPath, dest);
          } catch (err) {
            fail(err);
            return;
          }
          finished = true;
          if (onProgress) onProgress({ received, total: total || received });
          resolve({ path: dest, size: received });
        });
        res.pipe(out);
      });
      req.on("error", fail);
      req.setTimeout(60000, () => req.destroy(new Error("Download timed out.")));
    };

    request(url, maxRedirects);
  });
}

function run(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000, ...options }, (err, stdout, stderr) => {
      if (err) {
        err.message = `${err.message}\n${String(stderr || "").slice(-500)}`;
        reject(err);
        return;
      }
      resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

/**
 * The 1.15 AppImage bundles an old libpipewire. On systems with pipewire-jack
 * (e.g. Arch), the system libjack.so then loads against that old copy and fails
 * with "undefined symbol: pw_log_topic_register". When the system has its own
 * libpipewire, set the bundled one aside so the matching system copy is used.
 */
const SYSTEM_LIB_DIRS = ["/usr/lib", "/usr/lib64", "/usr/lib/x86_64-linux-gnu", "/lib/x86_64-linux-gnu"];
const SYSTEM_PREFERRED_LIBS = ["libpipewire-0.3.so.0"];

function preferSystemLibs(root, { exists = fs.existsSync, rename = fs.renameSync, libDirs = SYSTEM_LIB_DIRS } = {}) {
  const moved = [];
  for (const lib of SYSTEM_PREFERRED_LIBS) {
    if (!libDirs.some((dir) => exists(path.join(dir, lib)))) continue;
    for (const dir of [path.join(root, "lib", "x86_64-linux-gnu"), path.join(root, "usr", "lib"), path.join(root, "usr", "lib", "x86_64-linux-gnu")]) {
      const bundled = path.join(dir, lib);
      if (exists(bundled)) {
        rename(bundled, `${bundled}.bundled`);
        moved.push(bundled);
      }
    }
  }
  return moved;
}

async function readInstalledVersion(exePath, cwd) {
  const { stdout, stderr } = await run(exePath, ["--version"], { cwd, timeout: 30000 });
  return parseFlareVersion(`${stdout}\n${stderr}`);
}

function isExtracted(layout) {
  return fs.existsSync(layout.exePath) && fs.existsSync(path.join(layout.dataPath, "mods", "default"));
}

const inFlight = new Map();

/**
 * Download, unpack and verify one variant. Resolves to
 * { ok: true, variant, version, exePath, dataPath, installDir, alreadyInstalled }
 * or { ok: false, error }. Never throws.
 */
function installFlare(variant, options = {}) {
  if (inFlight.has(variant)) return inFlight.get(variant);
  const job = doInstall(variant, options).finally(() => inFlight.delete(variant));
  inFlight.set(variant, job);
  return job;
}

async function doInstall(variant, options) {
  const platform = options.platform || process.platform;
  const log = options.log || (() => {});
  const asset = releaseAsset(variant, platform);
  if (asset.error) return { ok: false, error: asset.error };
  if (!isInstallSupported(platform)) {
    return { ok: false, error: "Installing Flare is only supported on Linux for now. Windows is coming next." };
  }

  const installDir = installDirFor(variant, { ...options, platform });
  const layout = extractedLayout(installDir);
  const downloadPath = path.join(installDir, asset.file);
  const tmpExtract = path.join(installDir, ".extracting");

  try {
    fs.mkdirSync(installDir, { recursive: true });

    if (isExtracted(layout)) {
      preferSystemLibs(layout.root);
      const version = await readInstalledVersion(layout.exePath, layout.root);
      if (version) {
        log(`[FlareInstall] ${asset.tag} already installed (${version})`);
        return { ok: true, variant, version, exePath: layout.exePath, dataPath: layout.dataPath, installDir, alreadyInstalled: true };
      }
      log(`[FlareInstall] ${asset.tag} install looks broken, reinstalling`);
      fs.rmSync(layout.root, { recursive: true, force: true });
    }

    if (!fs.existsSync(downloadPath)) {
      log(`[FlareInstall] Downloading ${asset.url}`);
      await downloadFile(asset.url, downloadPath, { onProgress: options.onProgress, get: options.get });
    }

    fs.chmodSync(downloadPath, 0o755);
    fs.rmSync(tmpExtract, { recursive: true, force: true });
    fs.mkdirSync(tmpExtract, { recursive: true });
    log(`[FlareInstall] Extracting ${asset.file}`);
    await run(downloadPath, ["--appimage-extract"], { cwd: tmpExtract });
    const extracted = path.join(tmpExtract, EXTRACT_DIR);
    if (!fs.existsSync(path.join(extracted, "AppRun"))) {
      throw new Error("The downloaded file did not unpack into a Flare install.");
    }
    fs.rmSync(layout.root, { recursive: true, force: true });
    fs.renameSync(extracted, layout.root);
    fs.rmSync(tmpExtract, { recursive: true, force: true });

    if (!isExtracted(layout)) throw new Error("Flare data (mods/default) is missing after unpacking.");
    for (const lib of preferSystemLibs(layout.root)) log(`[FlareInstall] Using the system copy of ${path.basename(lib)}`);
    const version = await readInstalledVersion(layout.exePath, layout.root);
    if (!version) throw new Error("Flare was unpacked but `--version` did not report a version.");
    fs.rmSync(downloadPath, { force: true });
    log(`[FlareInstall] Installed Flare ${version} at ${layout.root}`);
    return { ok: true, variant, version, exePath: layout.exePath, dataPath: layout.dataPath, installDir, alreadyInstalled: false };
  } catch (err) {
    try {
      fs.rmSync(`${downloadPath}.part`, { force: true });
      // A finished download that failed to unpack is likely corrupt; fetch it again next time.
      fs.rmSync(downloadPath, { force: true });
      fs.rmSync(tmpExtract, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    log(`[FlareInstall] ${asset.tag} failed: ${err.message}`);
    const lines = String(err.message || err).split("\n").map((l) => l.trim()).filter(Boolean);
    const detail = lines.length > 1 ? ` (${lines[lines.length - 1].slice(0, 200)})` : "";
    return { ok: false, error: `${lines[0] || "Install failed"}${detail}` };
  }
}

module.exports = {
  RELEASE_BASE,
  VARIANTS,
  variantInfo,
  releaseAsset,
  isInstallSupported,
  installRoot,
  installDirFor,
  extractedLayout,
  variantForFlarePath,
  tileForFlarePath,
  parseFlareVersion,
  preferSystemLibs,
  downloadFile,
  installFlare,
};
