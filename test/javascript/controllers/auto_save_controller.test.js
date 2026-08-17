import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Application } from "@hotwired/stimulus";
import AutoSaveController from "../../../app/javascript/controllers/auto_save_controller";

describe("auto_save_controller", () => {
  let container;
  let fetchMock;
  let mockEditorController;
  let app;

  beforeEach(() => {
    vi.useFakeTimers();

    container = document.createElement("div");
    container.innerHTML = `
      <div data-controller="auto-save"
           data-auto-save-book-id-value="1"
           data-auto-save-chapter-id-value="10"
           data-auto-save-debounce-ms-value="5000"
           data-auto-save-max-retries-value="2">
      </div>
    `;
    document.body.appendChild(container);

    const meta = document.createElement("meta");
    meta.name = "csrf-token";
    meta.content = "test-csrf-token";
    document.head.appendChild(meta);

    mockEditorController = {
      editor: { getHTML: () => "<p>test</p>", getText: () => "test" },
      showSavingStatus: vi.fn(),
      showSavedStatus: vi.fn(),
      showErrorStatus: vi.fn(),
    };

    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    app = Application.start();
    app.register("auto-save", AutoSaveController);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.head.querySelectorAll('meta[name="csrf-token"]').forEach((m) => m.remove());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function getCtrl() {
    const el = container.querySelector("[data-controller=auto-save]");
    const c = app.getControllerForElementAndIdentifier(el, "auto-save");
    vi.spyOn(app, "getControllerForElementAndIdentifier").mockImplementation((_el, id) => {
      if (id === "editor") return mockEditorController;
      if (id === "auto-save") return c;
      return null;
    });
    return c;
  }

  test("save returns noop when no chapterId", async () => {
    const c = getCtrl();
    c.chapterIdValue = 0;
    const result = await c.save();
    expect(result).toBe("noop");
  });

  test("save returns saved when not dirty", async () => {
    const c = getCtrl();
    c.dirty = false;
    const result = await c.save();
    expect(result).toBe("saved");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("save sends PATCH request with chapter content", async () => {
    const c = getCtrl();
    c.dirty = true;

    await c.save();

    expect(fetchMock).toHaveBeenCalledWith(
      "/books/1/chapters/10",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  test("save shows saved status on success", async () => {
    const c = getCtrl();
    c.dirty = true;

    await c.save();

    expect(mockEditorController.showSavedStatus).toHaveBeenCalled();
  });

  test("markDirty triggers save schedule and shows saving status", () => {
    const c = getCtrl();

    c.markDirty();

    expect(c.dirty).toBe(true);
    expect(mockEditorController.showSavingStatus).toHaveBeenCalled();
  });

  test("save deduplicates when already saving", async () => {
    const c = getCtrl();
    c.dirty = true;

    let resolveFetch;
    fetchMock.mockImplementation(() => new Promise((r) => { resolveFetch = r; }));

    const firstSave = c.save();

    await vi.advanceTimersByTimeAsync(0);
    expect(c.saving).toBe(true);

    c.dirty = true;
    const secondSave = c.save();

    resolveFetch({ ok: true });

    const [first, second] = await Promise.all([firstSave, secondSave]);
    expect(first).toBe("saved");
    expect(second).toBe("saved");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("performSave retries on 500 errors", async () => {
    const c = getCtrl();

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });

    c.dirty = true;
    const savePromise = c.save();

    await vi.advanceTimersByTimeAsync(2000);
    await savePromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("performSave stops retrying after maxRetries", async () => {
    const c = getCtrl();

    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    c.dirty = true;

    const savePromise = c.save();

    await vi.advanceTimersByTimeAsync(4000);
    await savePromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("saveViaBeacon sends data as URLSearchParams", () => {
    const c = getCtrl();
    const beaconMock = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon: beaconMock });

    c.saveViaBeacon();

    expect(beaconMock).toHaveBeenCalledWith(
      "/books/1/chapters/10",
      expect.any(URLSearchParams),
    );
  });

  test("saveOnBeforeUnload calls saveViaBeacon when dirty", () => {
    const c = getCtrl();
    c.dirty = true;
    const beaconSpy = vi.spyOn(c, "saveViaBeacon");

    c.saveOnBeforeUnload();

    expect(beaconSpy).toHaveBeenCalled();
  });

  test("saveOnBeforeUnload does nothing when not dirty", () => {
    const c = getCtrl();
    c.dirty = false;
    const beaconSpy = vi.spyOn(c, "saveViaBeacon");

    c.saveOnBeforeUnload();

    expect(beaconSpy).not.toHaveBeenCalled();
  });

  test("scheduleAutoSave triggers save after debounce", async () => {
    const c = getCtrl();
    c.dirty = true;

    c.scheduleAutoSave();
    vi.advanceTimersByTime(5000);

    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalled();
  });

  test("clearDebounce cancels pending save", () => {
    const c = getCtrl();
    c.timeout = setTimeout(() => {}, 10000);

    c.clearDebounce();

    expect(c.timeout).toBeNull();
  });

  test("backoffDelay increases exponentially", () => {
    const c = getCtrl();
    expect(c.backoffDelay(0)).toBe(1000);
    expect(c.backoffDelay(1)).toBe(2000);
    expect(c.backoffDelay(2)).toBe(4000);
  });

  test("updateChapterId updates the chapterIdValue", () => {
    const c = getCtrl();
    c.updateChapterId(42);
    expect(c.chapterIdValue).toBe(42);
  });

  test("getEditorData returns null without editor", () => {
    const c = getCtrl();
    app.getControllerForElementAndIdentifier.mockReturnValue(null);
    expect(c.getEditorData()).toBeNull();
  });

  test("getEditorData returns content from editor", () => {
    const c = getCtrl();
    mockEditorController.editor.getHTML = () => "<p>content</p>";
    const data = c.getEditorData();
    expect(data).toEqual({ content: "<p>content</p>" });
  });
});
