/**
 * Interaction tests for the riskiest Studio UI: dialogue line edit/delete
 * without shifting later lines, InlineConfirm actually confirming, NPC role
 * switches writing the engine keys, and quest step add/reorder/delete.
 *
 * Requires Testing Library + jsdom. Those are not in package.json (no
 * dependency change on this branch). The file is skipped when they are
 * missing. Install with:
 *
 *   npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
 */
import { createRequire } from "node:module";
import React, { useEffect, useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { QuestStep } from "@/editor/questSteps";
import type { DialogueTree } from "@/types";
import type { MapObject } from "@/types";
import type { RoleMoment } from "@/editor/roleMoments";

const require = createRequire(import.meta.url);

export const UI_TEST_INSTALL =
  "npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom";

const UI_DEPS = [
  "@testing-library/react",
  "@testing-library/user-event",
  "@testing-library/jest-dom",
  "jsdom",
];

function missingUiDeps(): string[] {
  return UI_DEPS.filter((name) => {
    try {
      require.resolve(name);
      return false;
    } catch {
      return true;
    }
  });
}

const missing = missingUiDeps();

function bootJsdom() {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    try {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value: (window as unknown as Record<string, unknown>)[key],
      });
    } catch {
      /* some window properties are not definable */
    }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: window });
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: window.document });
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: window.navigator });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    window.matchMedia = () =>
      ({
        matches: false,
        media: "",
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      }) as unknown as MediaQueryList;
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

function emptyStep(id: string, quest_text: string, extra: Partial<QuestStep> = {}): QuestStep {
  return {
    id,
    quest_text,
    requires_status: "",
    requires_not_status: "",
    requires_level: "",
    requires_not_level: "",
    requires_currency: "",
    requires_not_currency: "",
    requires_item: "",
    requires_not_item: "",
    requires_class: "",
    requires_not_class: "",
    show_status: "",
    ...extra,
  };
}

type TreeWithComponents = DialogueTree & { components?: Array<{ key?: string; value?: string }> };

function lineTree(lines: { id: string; speaker: "npc" | "player"; text: string }[]): TreeWithComponents {
  return {
    id: "dlg_a",
    dialogueId: "dlg_a",
    topic: "Greeting",
    responses: [],
    requirements: [],
    dialogues: lines,
    rewards: [{ id: "reward-1", type: "gold", value: "50" }],
    worldEffects: [],
    components: [
      { key: "him", value: lines[0]?.text },
      { key: "you", value: lines[1]?.text },
      { key: "him", value: lines[2]?.text },
      { key: "reward_currency", value: "50" },
    ],
  };
}

const alwaysMoment: RoleMoment = {
  id: "default",
  title: "Always",
  key: "",
  requiresStatus: [],
  requiresNotStatus: [],
  source: "other",
};

function npcObject(properties: Record<string, string>): MapObject {
  return {
    id: 1,
    name: "Guard",
    type: "npc",
    x: 1,
    y: 2,
    width: 1,
    height: 1,
    properties,
  };
}

describe.skipIf(missing.length > 0)("critical UI interactions", () => {
  let render: any, screen: any, cleanup: any, fireEvent: any, waitFor: any, userEventSetup: any;
  let MomentChatView: any, InlineConfirm: any, QuestStepCards: any, NpcEditDialog: any;

  beforeAll(async () => {
    bootJsdom();
    const load = (name: string) => require(name);
    const rtl = load("@testing-library/react");
    render = rtl.render;
    screen = rtl.screen;
    cleanup = rtl.cleanup;
    fireEvent = rtl.fireEvent;
    waitFor = rtl.waitFor;
    const userEvent = load("@testing-library/user-event");
    userEventSetup = (userEvent.default || userEvent).setup;
    try { load("@testing-library/jest-dom/vitest"); } catch { /* optional matchers */ }
    MomentChatView = (await import("./dialogue/MomentChatView")).default;
    InlineConfirm = (await import("./ui/inline-confirm")).InlineConfirm;
    QuestStepCards = (await import("./QuestStepCards")).default;
    NpcEditDialog = (await import("./NpcEditDialog")).default;
  });

  afterEach(() => {
    cleanup();
  });

  it("does not delete until InlineConfirm is confirmed, and Escape cancels", async () => {
    const user = userEventSetup();
    function Harness() {
      const [open, setOpen] = useState(false);
      const [deleted, setDeleted] = useState(false);
      return (
        <>
          <InlineConfirm
            open={open}
            onCancel={() => setOpen(false)}
            onConfirm={() => {
              setDeleted(true);
              setOpen(false);
            }}
            message="Delete this?"
          >
            <button type="button" onClick={() => setOpen(true)}>
              Delete
            </button>
          </InlineConfirm>
          <span>{deleted ? "gone" : "kept"}</span>
        </>
      );
    }

    const { rerender } = render(<Harness />);
    expect(screen.getByText("kept")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    rerender(<Harness />);
    expect(await screen.findByRole("alertdialog", { name: "Delete this?" })).toBeTruthy();
    expect(screen.getByText("kept")).toBeTruthy();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: "Delete this?" })).toBeNull();
    });
    expect(screen.getByText("kept")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alertdialog", { name: "Delete this?" });
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.getByText("gone")).toBeTruthy());
  });

  it("edits a dialogue line and deletes the middle one without shifting later text or rewards", async () => {
    const user = userEventSetup();
    const initial = lineTree([
      { id: "l1", speaker: "npc", text: "Hello" },
      { id: "l2", speaker: "player", text: "Hi" },
      { id: "l3", speaker: "npc", text: "Welcome" },
    ]);
    const latest: { current: TreeWithComponents[] } = { current: [initial] };

    function Harness() {
      const [trees, setTrees] = useState<TreeWithComponents[]>([initial]);
      useEffect(() => { latest.current = trees; }, [trees]);
      return (
        <MomentChatView
          trees={trees}
          visibleTrees={trees}
          setTrees={setTrees}
          moment={alwaysMoment}
        />
      );
    }

    render(<Harness />);
    const welcome = screen.getByDisplayValue("Welcome");
    const hello = screen.getByDisplayValue("Hello");
    await user.clear(hello);
    await user.type(hello, "Good day");

    const removeButtons = screen.getAllByRole("button", { name: "Remove line" });
    expect(removeButtons).toHaveLength(3);
    await user.click(removeButtons[1]);
    expect(screen.getByRole("alertdialog", { name: "Remove this line?" })).toBeTruthy();
    expect(screen.getByDisplayValue("Hi")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(screen.queryByDisplayValue("Hi")).toBeNull();
    });
    expect(screen.getByDisplayValue("Good day")).toBeTruthy();
    expect(welcome).toBeTruthy();
    expect(screen.getByDisplayValue("Welcome")).toBeTruthy();
    expect(latest.current[0].dialogues.map((l) => l.text)).toEqual(["Good day", "Welcome"]);
    // reward component after the spoken lines must stay put
    expect(latest.current[0].components?.some((c) => c.key === "reward_currency" && c.value === "50")).toBe(true);
    expect(latest.current[0].rewards).toEqual([{ id: "reward-1", type: "gold", value: "50" }]);
  });

  it("toggles NPC roles by writing or removing talker/vendor/questGiver, keeping other keys", async () => {
    const user = userEventSetup();
    const latest = { current: npcObject({
      vendor: "true",
      vendor_requires_status: "shop_open",
      talker: "true",
      him: "Hello",
    }) };

    function Harness() {
      const [obj, setObj] = useState(latest.current);
      useEffect(() => { latest.current = obj; }, [obj]);
      const get = (key: string, fallback = "") => {
        const value = obj.properties?.[key];
        return typeof value === "string" ? value : fallback;
      };
      return (
        <NpcEditDialog
          editingObject={obj}
          setEditingObject={setObj}
          updateEditingObjectProperty={(key: string, value: string | null) => {
            setObj((prev) => {
              const properties = { ...(prev.properties || {}) };
              if (value === null) delete properties[key];
              else properties[key] = value;
              return { ...prev, properties };
            });
          }}
          updateEditingObjectBoolean={() => {}}
          getEditingObjectProperty={get}
          editor={null}
          canUseTilesetDialog={false}
          handleEditingTilesetBrowse={() => {}}
          handleEditingPortraitBrowse={() => {}}
          handleAutoDetectAnim={() => {}}
          onOpenRoleCenter={() => {}}
          itemsList={[]}
        />
      );
    }

    render(<Harness />);
    const vendor = screen.getByRole("switch", { name: "Vendor" });
    const quest = screen.getByRole("switch", { name: "Quest" });
    expect(vendor.getAttribute("data-state") || vendor.getAttribute("aria-checked")).toMatch(/checked|true/);

    await user.click(vendor);
    await waitFor(() => {
      expect(latest.current.properties.vendor).toBeUndefined();
    });
    expect(latest.current.properties.vendor_requires_status).toBe("shop_open");
    expect(latest.current.properties.talker).toBe("true");
    expect(latest.current.properties.him).toBe("Hello");

    await user.click(quest);
    await waitFor(() => {
      expect(latest.current.properties.questGiver).toBe("true");
    });
    expect(latest.current.properties.vendor).toBeUndefined();
  });

  it("adds, reorders, and confirm-deletes quest steps without dropping the others", async () => {
    const user = userEventSetup();
    const latest: { current: QuestStep[] } = { current: [
      emptyStep("s1", "Find the key", { requires_status: "quest_accepted" }),
      emptyStep("s2", "Return the key"),
    ] };

    function Harness() {
      const [steps, setSteps] = useState(latest.current);
      useEffect(() => { latest.current = steps; }, [steps]);
      return <QuestStepCards steps={steps} onChange={setSteps} ctx={{ questId: "find_key" }} />;
    }

    const { container } = render(<Harness />);
    expect(screen.getByDisplayValue("Find the key")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Step/ }));
    await waitFor(() => expect(latest.current).toHaveLength(3));

    const handles = screen.getAllByRole("button", { name: "Reorder step" });
    const cards = container.querySelectorAll("[class*='rounded-lg']");
    const dt = {
      types: ["text/plain"],
      effectAllowed: "move",
      dropEffect: "move",
      store: { "text/plain": "0" } as Record<string, string>,
      setData(type: string, value: string) {
        this.store[type] = value;
        if (!this.types.includes(type)) this.types.push(type);
      },
      getData(type: string) {
        return this.store[type] || "";
      },
    };
    fireEvent.dragStart(handles[0], { dataTransfer: dt });
    fireEvent.dragEnter(cards[1], { dataTransfer: dt });
    fireEvent.dragOver(cards[1], { dataTransfer: dt, clientY: 500 });
    fireEvent.drop(cards[1], { dataTransfer: dt });
    await waitFor(() => {
      expect(latest.current.map((s) => s.id)).toEqual(["s2", "s1", latest.current[2]?.id]);
    });
    expect(latest.current.find((s) => s.id === "s1")?.requires_status).toBe("quest_accepted");

    const remove = screen.getAllByRole("button", { name: "Remove step" });
    await user.click(remove[0]);
    expect(screen.getByRole("alertdialog", { name: "Remove this step?" })).toBeTruthy();
    expect(latest.current).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(latest.current).toHaveLength(2));
    expect(latest.current.map((s) => s.quest_text)).toEqual(["Find the key", ""]);
  });
});

describe("critical UI interaction harness", () => {
  it("records the install line when Testing Library or jsdom is missing", () => {
    if (missing.length > 0) {
      expect(UI_TEST_INSTALL).toMatch(/@testing-library\/react/);
      expect(missing.length).toBeGreaterThan(0);
    } else {
      expect(missing).toEqual([]);
    }
  });
});
