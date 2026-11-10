const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const MIN = 75;
const MAX = 200;
const STEP = 10;
const DEFAULTS = { interfaceScale: 100, textScale: 100 };

function settingsPath() {
  return path.join(app.getPath("userData"), "display-settings.json");
}

function clamp(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const snapped = Math.round(n / STEP) * STEP;
  return Math.min(MAX, Math.max(MIN, snapped));
}

function normalize(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    interfaceScale: clamp(src.interfaceScale, DEFAULTS.interfaceScale),
    textScale: clamp(src.textScale, DEFAULTS.textScale),
  };
}

function readDisplaySettings() {
  try {
    const text = fs.readFileSync(settingsPath(), "utf8");
    return normalize(JSON.parse(text));
  } catch {
    return { ...DEFAULTS };
  }
}

function writeDisplaySettings(settings) {
  const next = normalize(settings);
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(settingsPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error("writeDisplaySettings failed:", error);
  }
  return next;
}

function applyInterfaceZoom(contents, percent) {
  if (!contents || typeof contents.setZoomFactor !== "function") return;
  const factor = clamp(percent, DEFAULTS.interfaceScale) / 100;
  try {
    contents.setZoomFactor(factor);
  } catch (error) {
    console.error("setZoomFactor failed:", error);
  }
}

module.exports = {
  readDisplaySettings,
  writeDisplaySettings,
  applyInterfaceZoom,
  DEFAULTS,
};
