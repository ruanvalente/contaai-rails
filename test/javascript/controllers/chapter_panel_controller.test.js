import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Application } from "@hotwired/stimulus";
import ChapterPanelController from "../../../app/javascript/controllers/chapter_panel_controller";

const application = Application.start();
application.register("chapter-panel", ChapterPanelController);

describe("chapter_panel_controller", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <div
        data-controller="chapter-panel"
        data-chapter-panel-book-id-value="1"
      >
        <ul data-chapter-panel-target="list">
          <li data-chapter-id="1" data-position="0" draggable="true"></li>
          <li data-chapter-id="2" data-position="1" draggable="true"></li>
        </ul>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function controller() {
    return container.querySelector("[data-controller=chapter-panel]").__controller__;
  }

  function setupController() {
    const el = container.querySelector("[data-controller=chapter-panel]");
    el.__controller__ = application.getControllerForElementAndIdentifier(el, "chapter-panel");
    return el.__controller__;
  }

  test("refetches the canonical order from the server when reorder fails", async () => {
    const ctrl = setupController();
    const list = ctrl.listTarget;
    const dragged = list.querySelector("[data-chapter-id='2']");
    const target = list.querySelector("[data-chapter-id='1']");
    ctrl.draggedElement = dragged;

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 2, position: 0 },
          { id: 1, position: 1 },
        ],
      });
    vi.stubGlobal("fetch", fetchMock);

    await ctrl.handleDrop({ preventDefault: () => {} }, target);

    expect(fetchMock).toHaveBeenCalledWith("/books/1/chapters/reorder", expect.anything());
    expect(fetchMock).toHaveBeenCalledWith("/books/1/chapters", expect.anything());
    expect(Array.from(list.querySelectorAll("li")).map((li) => li.dataset.chapterId)).toEqual(["2", "1"]);
  });

  test("falls back to the previous DOM order if the refetch also fails", async () => {
    const ctrl = setupController();
    const list = ctrl.listTarget;
    const dragged = list.querySelector("[data-chapter-id='2']");
    const target = list.querySelector("[data-chapter-id='1']");
    ctrl.draggedElement = dragged;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await ctrl.handleDrop({ preventDefault: () => {} }, target);

    expect(Array.from(list.querySelectorAll("li")).map((li) => li.dataset.chapterId)).toEqual(["1", "2"]);
  });
});
