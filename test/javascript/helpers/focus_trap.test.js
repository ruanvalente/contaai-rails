import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { focusableElements, trapFocus } from "../../../app/javascript/helpers/focus_trap";

function stubGetClientRects() {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 1, height: 1, top: 0, left: 0, bottom: 1, right: 1, x: 0, y: 0 },
  ]);
}

describe("focusableElements", () => {
  beforeEach(() => {
    stubGetClientRects();
    document.body.innerHTML = `
      <div id="root">
        <a href="/x">link</a>
        <button>botão</button>
        <button disabled>desabilitado</button>
        <input type="text">
        <input type="text" disabled>
        <span tabindex="0">tab</span>
        <span tabindex="-1">ignorado</span>
        <button hidden>oculto</button>
        <button style="display:none">display none</button>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  test("returns only visible and focusable elements", () => {
    const root = document.getElementById("root");
    const focusables = focusableElements(root);
    expect(focusables).toEqual([
      root.querySelector("a"),
      root.querySelector("button"),
      root.querySelector('input:not([disabled])'),
      root.querySelector('span[tabindex="0"]'),
    ]);
  });

  test("returns an empty list for a container without focusable elements", () => {
    const div = document.createElement("div");
    expect(focusableElements(div)).toEqual([]);
  });
});

describe("trapFocus", () => {
  beforeEach(() => {
    stubGetClientRects();
    document.body.innerHTML = `
      <div id="root">
        <button id="first">primeiro</button>
        <input type="text">
        <a href="/x" id="last">último</a>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  test("ignores keys other than Tab", () => {
    const preventDefault = vi.fn();
    trapFocus(document.getElementById("root"), { key: "Enter", preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  test("moves focus to the first element when focus is outside", () => {
    const first = document.getElementById("first");
    const event = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    document.activeElement.blur();
    trapFocus(document.getElementById("root"), event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(first);
  });

  test("on the last element with Tab, wraps to the first", () => {
    const first = document.getElementById("first");
    const last = document.getElementById("last");
    last.focus();
    trapFocus(document.getElementById("root"), {
      key: "Tab",
      shiftKey: false,
      preventDefault: vi.fn(),
    });
    expect(document.activeElement).toBe(first);
  });

  test("on the first element with Shift+Tab, goes to the last", () => {
    const first = document.getElementById("first");
    const last = document.getElementById("last");
    first.focus();
    trapFocus(document.getElementById("root"), {
      key: "Tab",
      shiftKey: true,
      preventDefault: vi.fn(),
    });
    expect(document.activeElement).toBe(last);
  });
});
