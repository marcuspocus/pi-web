export interface ChatScrollPosition {
  index?: number;
  endIndex?: number;
  key?: string;
  offset: number;
}

export interface ChatScrollViewport {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  getBoundingClientRect(): Pick<DOMRectReadOnly, "top" | "bottom">;
}

export interface ChatScrollElement {
  readonly dataset: { readonly anchorKey?: string | undefined; readonly index?: string | undefined; readonly endIndex?: string | undefined };
  getBoundingClientRect(): Pick<DOMRectReadOnly, "top" | "bottom">;
}

export interface ChatScrollStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ChatScrollScheduler {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(id: number): void;
}

export type ChatScrollSaveResult = "saved" | "removed" | "skipped";
export type ChatScrollRestoreResult =
  | { status: "bottom" | "restored" | "skipped" }
  | { status: "missing"; position: ChatScrollPosition };

const SCROLL_STORAGE_PREFIX = "pi-web:chat-scroll:";
const DEFAULT_SAVE_DELAY_MS = 180;
const DEFAULT_NEAR_BOTTOM_THRESHOLD = 48;

const browserScrollStorage: ChatScrollStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  },
};

const browserScrollScheduler: ChatScrollScheduler = {
  setTimeout(callback: () => void, delayMs: number): number {
    return window.setTimeout(callback, delayMs);
  },
  clearTimeout(id: number): void {
    window.clearTimeout(id);
  },
};

export class ChatScrollController {
  private saveTimer: number | undefined;

  constructor(
    private readonly storage: ChatScrollStorage = browserScrollStorage,
    private readonly scheduler: ChatScrollScheduler = browserScrollScheduler,
  ) {}

  dispose(): void {
    this.clearScheduledSave();
  }

  clearScheduledSave(): void {
    if (this.saveTimer === undefined) return;
    this.scheduler.clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
  }

  scheduleSave(sessionId: string, save: (sessionId: string) => void, delayMs = DEFAULT_SAVE_DELAY_MS): void {
    this.clearScheduledSave();
    this.saveTimer = this.scheduler.setTimeout(() => {
      this.saveTimer = undefined;
      save(sessionId);
    }, delayMs);
  }

  savePosition(sessionId: string, scroller: ChatScrollViewport | undefined, articles: ChatScrollElement[], nearBottomThreshold = DEFAULT_NEAR_BOTTOM_THRESHOLD): ChatScrollSaveResult {
    if (sessionId === "" || scroller === undefined || !hasUsableScrollViewport(scroller)) return "skipped";
    try {
      if (isNearScrollBottom(scroller, nearBottomThreshold)) {
        this.storage.removeItem(chatScrollStorageKey(sessionId));
        return "removed";
      }

      const firstVisible = findFirstVisibleArticle(scroller, articles);
      if (firstVisible === undefined) {
        this.storage.removeItem(chatScrollStorageKey(sessionId));
        return "removed";
      }

      const position = captureScrollPosition(scroller, firstVisible);
      this.storage.setItem(chatScrollStorageKey(sessionId), JSON.stringify(position));
      return "saved";
    } catch {
      return "skipped";
    }
  }

  restorePosition(sessionId: string, scroller: ChatScrollViewport | undefined, articles: ChatScrollElement[], options?: { fallbackToBottom?: boolean | undefined }): ChatScrollRestoreResult {
    const stored = this.readPosition(sessionId);
    if (stored === undefined) return this.scrollToBottom(scroller);
    return this.restoreExplicitPosition(stored, scroller, articles, options);
  }

  restoreExplicitPosition(position: ChatScrollPosition, scroller: ChatScrollViewport | undefined, articles: ChatScrollElement[], options?: { fallbackToBottom?: boolean | undefined }): ChatScrollRestoreResult {
    if (scroller === undefined || !hasUsableScrollViewport(scroller)) return { status: "skipped" };
    const article = findArticleAt(articles, position);
    if (article === undefined) {
      if (options?.fallbackToBottom === false) return { status: "missing", position };
      return this.scrollToBottom(scroller);
    }
    const scrollerTop = scroller.getBoundingClientRect().top;
    const currentOffset = article.getBoundingClientRect().top - scrollerTop;
    scroller.scrollTop += currentOffset - position.offset;
    return { status: "restored" };
  }

  readPosition(sessionId: string): ChatScrollPosition | undefined {
    if (sessionId === "") return undefined;
    try {
      const raw = this.storage.getItem(chatScrollStorageKey(sessionId));
      if (raw === null || raw === "") return undefined;
      const value: unknown = JSON.parse(raw);
      if (!isScrollPosition(value)) return undefined;
      return value;
    } catch {
      return undefined;
    }
  }

  scrollToBottom(scroller: ChatScrollViewport | undefined): ChatScrollRestoreResult {
    if (scroller === undefined || !hasUsableScrollViewport(scroller)) return { status: "skipped" };
    scroller.scrollTop = scroller.scrollHeight;
    return { status: "bottom" };
  }
}

export function chatScrollStorageKey(sessionId: string): string {
  return `${SCROLL_STORAGE_PREFIX}${sessionId}`;
}

export function isScrollPosition(value: unknown): value is ChatScrollPosition {
  return typeof value === "object"
    && value !== null
    && "offset" in value
    && typeof value.offset === "number"
    && (("key" in value && typeof value.key === "string") || ("index" in value && typeof value.index === "number") || ("endIndex" in value && typeof value.endIndex === "number"));
}

export function hasUsableScrollViewport(scroller: Pick<ChatScrollViewport, "clientHeight" | "scrollHeight">): boolean {
  return scroller.clientHeight > 0 && scroller.scrollHeight > 0;
}

export function distanceFromScrollBottom(scroller: Pick<ChatScrollViewport, "scrollHeight" | "scrollTop" | "clientHeight">): number {
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
}

export function isNearScrollBottom(scroller: Pick<ChatScrollViewport, "scrollHeight" | "scrollTop" | "clientHeight">, threshold = DEFAULT_NEAR_BOTTOM_THRESHOLD): boolean {
  return distanceFromScrollBottom(scroller) < threshold;
}

export function captureScrollPosition(scroller: ChatScrollViewport, article: ChatScrollElement): ChatScrollPosition {
  const chatTop = scroller.getBoundingClientRect().top;
  const key = article.dataset.anchorKey;
  const index = numericDatasetValue(article.dataset.index);
  const endIndex = numericDatasetValue(article.dataset.endIndex);
  return {
    ...(key === undefined ? {} : { key }),
    ...(index === undefined ? {} : { index }),
    ...(endIndex === undefined ? {} : { endIndex }),
    offset: article.getBoundingClientRect().top - chatTop,
  };
}

export function findFirstVisibleArticle<T extends ChatScrollElement>(scroller: ChatScrollViewport, articles: T[]): T | undefined {
  const scrollerRect = scroller.getBoundingClientRect();
  return articles.find((article) => {
    const rect = article.getBoundingClientRect();
    return rect.bottom >= scrollerRect.top && rect.top <= scrollerRect.bottom;
  });
}

export function findArticleAt<T extends ChatScrollElement>(articles: T[], position: { index?: number | undefined; endIndex?: number | undefined; key?: string | undefined }): T | undefined {
  const keyed = position.key === undefined ? undefined : articles.find((article) => article.dataset.anchorKey === position.key);
  if (keyed !== undefined) return keyed;
  const startMatched = position.index === undefined ? undefined : articles.find((article) => numericDatasetValue(article.dataset.index) === position.index);
  if (startMatched !== undefined) return startMatched;
  return position.endIndex === undefined ? undefined : articles.find((article) => numericDatasetValue(article.dataset.endIndex) === position.endIndex);
}

function numericDatasetValue(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
