/**
 * Main-process save / IPC write path, exercised against a temp directory.
 *
 * Loads electron/main.cjs with a stubbed `electron` module so handlers can
 * run in Vitest without launching a window. Writes go only under os.tmpdir().
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(__dirname, "../..");
const fixtures = path.join(repoRoot, "tests/fixtures/export");

const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>();

let userDataDir = "";
let documentsDir = "";

const electronMock = {
  app: {
    isPackaged: true,
    whenReady: () => new Promise(() => {}),
    on: () => electronMock.app,
    quit: () => {},
    getPath: (name: string) => {
      if (name === "documents") return documentsDir;
      return userDataDir;
    },
  },
  BrowserWindow: class BrowserWindow {
    static getAllWindows() {
      return [];
    }
  },
  Menu: {
    buildFromTemplate: () => ({}),
    setApplicationMenu: () => {},
  },
  dialog: { showMessageBox: async () => ({ response: 1 }) },
  shell: { openExternal: async () => {} },
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }),
  },
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, fn);
    },
    on: () => {},
  },
};

const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;

function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const fn = ipcHandlers.get(channel);
  if (!fn) throw new Error(`No ipcMain handler registered for "${channel}"`);
  return Promise.resolve(fn({}, ...args) as T);
}

function makeProject(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return dir;
}

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

beforeAll(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-userdata-"));
  documentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-docs-"));
  (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(
    request: unknown,
    parent: unknown,
    isMain: unknown,
  ) {
    if (request === "electron") return electronMock;
    return originalLoad.call(this, request, parent, isMain);
  };
  require(path.join(repoRoot, "electron/main.cjs"));
});

afterAll(() => {
  (Module as unknown as { _load: (...args: unknown[]) => unknown })._load = originalLoad;
  for (const dir of [userDataDir, documentsDir]) {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("displaySettings write path", () => {
  it("clamps and persists interface/text scale under userData", async () => {
    // clamp: snap to 10, then keep inside 75..200 (MIN is 75, not 0).
    const written = await invoke<{ interfaceScale: number; textScale: number }>(
      "set-display-settings",
      { interfaceScale: 86, textScale: 201 },
    );
    expect(written).toEqual({ interfaceScale: 90, textScale: 200 });

    const file = path.join(userDataDir, "display-settings.json");
    expect(fs.existsSync(file)).toBe(true);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({
      interfaceScale: 90,
      textScale: 200,
    });

    const readBack = await invoke("get-display-settings");
    expect(readBack).toEqual({ interfaceScale: 90, textScale: 200 });

    const belowMin = await invoke<{ interfaceScale: number; textScale: number }>(
      "set-display-settings",
      { interfaceScale: 74, textScale: 70 },
    );
    expect(belowMin).toEqual({ interfaceScale: 75, textScale: 75 });

    const again = await invoke<{ interfaceScale: number; textScale: number }>(
      "set-display-settings",
      { interfaceScale: "nope", textScale: 76 },
    );
    expect(again).toEqual({ interfaceScale: 100, textScale: 80 });
  });
});

describe("main-process save handlers write into a temp project", () => {
  it("save-map-project writes a lean map JSON and extracts tileset images", async () => {
    const project = makeProject("fs-save-map-");
    try {
      const ok = await invoke<boolean>("save-map-project", project, {
        name: "Harbor Town",
        width: 8,
        height: 6,
        tileSize: 64,
        layers: [{ name: "background", data: [1, 0, 0, 1] }],
        tilesets: [{ name: "ground" }],
        tilesetImages: { "ground.png": PNG_1X1 },
      });
      expect(ok).toBe(true);

      const jsonPath = path.join(project, "harbor_town.json");
      expect(fs.existsSync(jsonPath)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      expect(saved.name).toBe("Harbor Town");
      expect(saved.width).toBe(8);
      expect(saved.height).toBe(6);
      expect(saved.tilesetImages).toEqual({});
      expect(saved.layers).toHaveLength(1);

      const imagePath = path.join(project, "images", "tilesets", "ground.png");
      expect(fs.existsSync(imagePath)).toBe(true);
      expect(fs.statSync(imagePath).size).toBeGreaterThan(0);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it("write-file is confined to a remembered project root", async () => {
    const project = makeProject("fs-save-write-");
    const outsider = makeProject("fs-save-out-");
    try {
      expect(await invoke<boolean>("write-file", path.join(project, "notes.txt"), "secret")).toBe(
        false,
      );
      expect(fs.existsSync(path.join(project, "notes.txt"))).toBe(false);

      // save-map-project remembers the project root
      await invoke("save-map-project", project, { name: "Gate" });

      const inside = path.join(project, "engine", "misc.txt");
      expect(await invoke<boolean>("write-file", inside, "save_prefix=gate\n")).toBe(true);
      expect(fs.readFileSync(inside, "utf8")).toBe("save_prefix=gate\n");

      const escapePath = path.join(outsider, "pwn.txt");
      expect(await invoke<boolean>("write-file", escapePath, "nope")).toBe(false);
      expect(fs.existsSync(escapePath)).toBe(false);

      const readInside = await invoke<string | null>("read-file", inside);
      expect(readInside).toBe("save_prefix=gate\n");
      expect(await invoke<string | null>("read-file", escapePath)).toBeNull();
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
      fs.rmSync(outsider, { recursive: true, force: true });
    }
  });

  it("save-export-files writes map, tileset, npc, spawn, and engine files", async () => {
    const project = makeProject("fs-save-export-");
    try {
      const mapTxt = fs.readFileSync(path.join(fixtures, "village.map.txt"), "utf8");
      const tilesetDef = fs.readFileSync(path.join(fixtures, "tileset.txt"), "utf8");
      const npcTxt = fs.readFileSync(path.join(fixtures, "merchant.npc.txt"), "utf8");

      const result = (await invoke("save-export-files", project, "Village", mapTxt, tilesetDef, {
        spawn: {
          enabled: true,
          filename: "spawn.txt",
          content: "[header]\ntitle=Spawn\nwidth=1\nheight=1\n",
        },
        npcFiles: [{ filename: "merchant.txt", content: npcTxt }],
      })) as { success: boolean; message?: string };

      expect(result.success, result.message ?? "export failed").toBe(true);

      const mapPath = path.join(project, "maps", "village.txt");
      expect(fs.readFileSync(mapPath, "utf8")).toBe(mapTxt);
      expect(fs.existsSync(path.join(project, "tilesetdefs", "tileset_village.txt"))).toBe(true);
      expect(fs.readFileSync(path.join(project, "npcs", "merchant.txt"), "utf8")).toBe(npcTxt);
      expect(fs.existsSync(path.join(project, "maps", "spawn.txt"))).toBe(true);
      expect(fs.existsSync(path.join(project, "settings.txt"))).toBe(true);
      expect(fs.existsSync(path.join(project, "engine", "gameplay.txt"))).toBe(true);
      expect(fs.existsSync(path.join(project, "engine", "misc.txt"))).toBe(true);
      expect(fs.existsSync(path.join(project, "project.json"))).toBe(true);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it("refuses to export a map the adapter rejects as invalid", async () => {
    const project = makeProject("fs-save-bad-");
    try {
      // validateText only errors on bad layer geometry or unknown keys —
      // a bare string is accepted, so use a layer whose rows != header height.
      const badMap = [
        "[header]",
        "width=2",
        "height=2",
        "",
        "[layer]",
        "type=background",
        "data=",
        "1,1",
        "",
      ].join("\n");
      const result = (await invoke(
        "save-export-files",
        project,
        "Broken",
        badMap,
        "[tileset]\nimg=x.png\n",
        {},
      )) as { success: boolean; message?: string };
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Export refused|Layer data/i);
      expect(fs.existsSync(path.join(project, "maps", "broken.txt"))).toBe(false);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it("create-npc-file only returns a path; write-item-file merges into the category file", async () => {
    const project = makeProject("fs-save-item-");
    try {
      const created = (await invoke("create-npc-file", project, { name: "Old Guard" })) as {
        success: boolean;
        filename: string;
        filePath: string;
      };
      expect(created.success).toBe(true);
      expect(created.filename).toBe("old_guard.txt");
      expect(created.filePath).toBe(path.join(project, "npcs", "old_guard.txt"));
      // The handler must not write a skeleton file (export owns the content).
      expect(fs.existsSync(created.filePath)).toBe(false);

      const categoryDir = path.join(project, "items", "categories");
      fs.mkdirSync(categoryDir, { recursive: true });
      const categoryPath = path.join(categoryDir, "weapons.txt");
      fs.copyFileSync(path.join(fixtures, "sword.item.txt"), categoryPath);

      const written = (await invoke("write-item-file", `${categoryPath}#item_12`, {
        id: 12,
        name: "Iron Sword",
        item_type: "main",
        dmg: "melee,3,6",
        power: 12,
      })) as { success: boolean; error?: string };
      expect(written.success, written.error).toBe(true);

      const text = fs.readFileSync(categoryPath, "utf8");
      expect(text).toMatch(/name=Iron Sword/);
      expect(text).toMatch(/id=12/);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it("delete-map removes the map json and maps txt without throwing", async () => {
    const project = makeProject("fs-delete-map-");
    const outsider = makeProject("fs-delete-out-");
    try {
      expect(await invoke<boolean>("save-map-project", project, { name: "Harbor Town", width: 2, height: 2 })).toBe(
        true,
      );
      const jsonPath = path.join(project, "harbor_town.json");
      expect(fs.existsSync(jsonPath)).toBe(true);

      const mapsDir = path.join(project, "maps");
      fs.mkdirSync(mapsDir, { recursive: true });
      // Different case than the slug so the handler must match case-insensitively.
      const mapTxtPath = path.join(mapsDir, "Harbor_Town.txt");
      fs.writeFileSync(mapTxtPath, "[header]\nwidth=1\nheight=1\n");
      const keepPath = path.join(mapsDir, "other.txt");
      fs.writeFileSync(keepPath, "keep\n");
      const outsiderPath = path.join(outsider, "harbor_town.json");
      fs.writeFileSync(outsiderPath, "leave-me\n");

      const result = (await invoke("delete-map", project, "Harbor Town")) as {
        success: boolean;
        message?: string;
      };
      expect(result.success, result.message ?? "delete-map failed").toBe(true);
      expect(result.message ?? "").not.toMatch(/deleteMatchingFile is not defined/);
      expect(fs.existsSync(jsonPath)).toBe(false);
      expect(fs.existsSync(mapTxtPath)).toBe(false);
      expect(fs.existsSync(keepPath)).toBe(true);
      expect(fs.readFileSync(outsiderPath, "utf8")).toBe("leave-me\n");

      const again = (await invoke("delete-map", project, "Harbor Town")) as {
        success: boolean;
        message?: string;
      };
      expect(again.success, again.message ?? "delete-map of a missing map failed").toBe(true);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
      fs.rmSync(outsider, { recursive: true, force: true });
    }
  });

});
