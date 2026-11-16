// Tiny debug logger for the Electron main process.
//
// Off by default. Set FLARE_STUDIO_DEBUG=1 (or "true") before `npm run
// electron-dev` / `electron .` to see the diagnostic output again. Real
// problems must keep using console.warn / console.error; those are never gated.

let enabled = /^(1|true|yes|on)$/i.test(String(process.env.FLARE_STUDIO_DEBUG || ""));

function setDebugLogEnabled(next) {
  enabled = Boolean(next);
}

function isDebugLogEnabled() {
  return enabled;
}

function debugLog(...args) {
  if (!enabled) return;
  console.log(...args);
}

module.exports = { debugLog, setDebugLogEnabled, isDebugLogEnabled };
