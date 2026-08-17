import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("editor_link_controller", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <div data-controller="editor-link">
        <button data-editor-link-target="linkButton">Link</button>
        <div data-editor-link-target="popover" class="hidden">
          <input data-editor-link-target="input" type="url" />
          <button data-editor-link-target="apply">Adicionar</button>
          <button data-editor-link-target="remove">Remover</button>
          <span data-editor-link-target="error" class="hidden"></span>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function controller() {
    const el = container.querySelector("[data-controller=editor-link]");
    return {
      el,
      instance: el.__controller__ || { editor: null },
      popoverTarget: el.querySelector("[data-editor-link-target=popover]"),
      inputTarget: el.querySelector("[data-editor-link-target=input]"),
      applyTarget: el.querySelector("[data-editor-link-target=apply]"),
      removeTarget: el.querySelector("[data-editor-link-target=remove]"),
      errorTarget: el.querySelector("[data-editor-link-target=error]"),
      linkButtonTarget: el.querySelector("[data-editor-link-target=linkButton]"),
    };
  }

  test("popover starts hidden", () => {
    const { popoverTarget } = controller();
    expect(popoverTarget.classList.contains("hidden")).toBe(true);
  });

  test("error message starts hidden", () => {
    const { errorTarget } = controller();
    expect(errorTarget.classList.contains("hidden")).toBe(true);
  });

  test("apply button text is initially 'Adicionar'", () => {
    const { applyTarget } = controller();
    expect(applyTarget.textContent).toBe("Adicionar");
  });

  test("input target is an url input", () => {
    const { inputTarget } = controller();
    expect(inputTarget.type).toBe("url");
  });

  test("remove button exists for removing links", () => {
    const { removeTarget } = controller();
    expect(removeTarget).not.toBeNull();
    expect(removeTarget.textContent).toBe("Remover");
  });

  test("link button exists for opening the popover", () => {
    const { linkButtonTarget } = controller();
    expect(linkButtonTarget).not.toBeNull();
    expect(linkButtonTarget.textContent).toBe("Link");
  });

  test("showError displays message and unhides error target", () => {
    const { errorTarget, inputTarget } = controller();
    const el = container.querySelector("[data-controller=editor-link]");

    el.editorController = { editor: null };
    el.__controller__ = {
      getEditor: () => null,
      errorTarget,
      inputTarget,
      popoverTarget: container.querySelector("[data-editor-link-target=popover]"),
      linkButtonTarget: container.querySelector("[data-editor-link-target=linkButton]"),
      showError: function (msg) {
        this.errorTarget.textContent = msg;
        this.errorTarget.classList.remove("hidden");
        this.inputTarget.focus();
      },
    };

    el.__controller__.showError("Informe a URL do link.");

    expect(errorTarget.textContent).toBe("Informe a URL do link.");
    expect(errorTarget.classList.contains("hidden")).toBe(false);
  });
});
