import { describe, expect, it } from "vitest";
import { ChatScrollController, captureScrollPosition, chatScrollStorageKey, findFirstVisibleArticle, type ChatScrollElement, type ChatScrollScheduler, type ChatScrollStorage, type ChatScrollViewport } from "./chatScrollPosition";

class MemoryScrollStorage implements ChatScrollStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class ManualScheduler implements ChatScrollScheduler {
  private nextId = 1;
  private readonly callbacks = new Map<number, () => void>();

  setTimeout(callback: () => void): number {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  }

  clearTimeout(id: number): void {
    this.callbacks.delete(id);
  }

  run(id: number): void {
    const callback = this.callbacks.get(id);
    if (callback === undefined) return;
    this.callbacks.delete(id);
    callback();
  }

  runAll(): void {
    const ids = [...this.callbacks.keys()];
    for (const id of ids) this.run(id);
  }
}

class FakeScroller implements ChatScrollViewport {
  constructor(
    public scrollTop: number,
    public scrollHeight: number,
    public clientHeight: number,
    private readonly top: number,
    private readonly bottom: number,
  ) {}

  getBoundingClientRect(): Pick<DOMRectReadOnly, "top" | "bottom"> {
    return { top: this.top, bottom: this.bottom };
  }
}

class FakeArticle implements ChatScrollElement {
  readonly dataset: { readonly anchorKey?: string | undefined; readonly index?: string | undefined; readonly endIndex?: string | undefined };

  constructor(
    private readonly top: number,
    private readonly bottom: number,
    index: number,
    key?: string,
    endIndex?: number,
  ) {
    this.dataset = {
      ...(key === undefined ? {} : { anchorKey: key }),
      index: String(index),
      ...(endIndex === undefined ? {} : { endIndex: String(endIndex) }),
    };
  }

  getBoundingClientRect(): Pick<DOMRectReadOnly, "top" | "bottom"> {
    return { top: this.top, bottom: this.bottom };
  }
}

describe("ChatScrollController", () => {
  it("skips saving while the scroll viewport is hidden", () => {
    const storage = new MemoryScrollStorage();
    const controller = new ChatScrollController(storage, new ManualScheduler());
    const key = chatScrollStorageKey("s1");
    storage.setItem(key, "old");

    const result = controller.savePosition("s1", new FakeScroller(0, 0, 0, 0, 0), [new FakeArticle(0, 10, 0, "m:0")]);

    expect(result).toBe("skipped");
    expect(storage.getItem(key)).toBe("old");
  });

  it("saves and restores the first visible article", () => {
    const storage = new MemoryScrollStorage();
    const controller = new ChatScrollController(storage, new ManualScheduler());
    const scroller = new FakeScroller(200, 1000, 300, 100, 400);
    const articles = [new FakeArticle(40, 90, 0, "m:0"), new FakeArticle(140, 180, 1, "m:1")];

    expect(controller.savePosition("s1", scroller, articles)).toBe("saved");

    scroller.scrollTop = 500;
    const rerenderedArticles = [new FakeArticle(120, 160, 0, "m:0"), new FakeArticle(220, 260, 1, "m:1")];

    expect(controller.restorePosition("s1", scroller, rerenderedArticles)).toEqual({ status: "restored" });
    expect(scroller.scrollTop).toBe(580);
  });

  it("reports missing stored anchors instead of forcing bottom when requested", () => {
    const storage = new MemoryScrollStorage();
    const controller = new ChatScrollController(storage, new ManualScheduler());
    const position = { key: "m:4", index: 4, offset: 20 };
    storage.setItem(chatScrollStorageKey("s1"), JSON.stringify(position));
    const scroller = new FakeScroller(100, 900, 300, 0, 300);

    expect(controller.restorePosition("s1", scroller, [new FakeArticle(10, 40, 9, "m:9")], { fallbackToBottom: false })).toEqual({ status: "missing", position });
    expect(scroller.scrollTop).toBe(100);
  });

  it("can restore by end index when a group's primary key and start index changed", () => {
    const storage = new MemoryScrollStorage();
    const controller = new ChatScrollController(storage, new ManualScheduler());
    storage.setItem(chatScrollStorageKey("s1"), JSON.stringify({ key: "g:10", index: 10, endIndex: 20, offset: 40 }));
    const scroller = new FakeScroller(100, 900, 300, 0, 300);

    expect(controller.restorePosition("s1", scroller, [new FakeArticle(90, 180, 8, "g:8", 20)])).toEqual({ status: "restored" });
    expect(scroller.scrollTop).toBe(150);
  });

  it("removes stored scroll when the user is near the bottom", () => {
    const storage = new MemoryScrollStorage();
    const controller = new ChatScrollController(storage, new ManualScheduler());
    const key = chatScrollStorageKey("s1");
    storage.setItem(key, "old");

    expect(controller.savePosition("s1", new FakeScroller(660, 1000, 300, 0, 300), [new FakeArticle(0, 30, 0, "m:0")])).toBe("removed");
    expect(storage.getItem(key)).toBeNull();
  });

  it("captures the session id when scheduling a delayed save", () => {
    const scheduler = new ManualScheduler();
    const controller = new ChatScrollController(new MemoryScrollStorage(), scheduler);
    const saved: string[] = [];

    controller.scheduleSave("s1", (sessionId) => { saved.push(sessionId); });
    controller.scheduleSave("s2", (sessionId) => { saved.push(sessionId); });
    scheduler.runAll();

    expect(saved).toEqual(["s2"]);
  });
});

describe("chat scroll helpers", () => {
  it("finds the first article intersecting the viewport", () => {
    const scroller = new FakeScroller(0, 1000, 100, 100, 200);
    const first = new FakeArticle(20, 80, 0, "m:0");
    const second = new FakeArticle(150, 180, 1, "m:1");

    expect(findFirstVisibleArticle(scroller, [first, second])).toBe(second);
  });

  it("captures an article-relative scroll position", () => {
    expect(captureScrollPosition(new FakeScroller(0, 1000, 100, 100, 200), new FakeArticle(140, 180, 3, "m:3"))).toEqual({ key: "m:3", index: 3, offset: 40 });
  });
});
