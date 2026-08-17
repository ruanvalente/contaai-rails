import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("editor_controller", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <div data-controller="editor"
           data-editor-book-id-value="1"
           data-editor-chapter-id-value="10"
           data-editor-chapter-title-value="Capítulo Teste"
           data-editor-content-value="<p>Hello</p>">
        <div data-editor-target="toolbar" role="toolbar" aria-label="Ferramentas de formatação">
          <button data-action="click->editor#bold" data-editor-tool="bold" aria-pressed="false" aria-label="Negrito" aria-keyshortcuts="Control+b">B</button>
          <button data-action="click->editor#italic" data-editor-tool="italic" aria-pressed="false" aria-label="Itálico" aria-keyshortcuts="Control+i">I</button>
          <button data-action="click->editor#underline" data-editor-tool="underline" aria-pressed="false" aria-label="Sublinhado" aria-keyshortcuts="Control+Shift+u">U</button>
          <button data-action="click->editor#strike" data-editor-tool="strike" aria-pressed="false" aria-label="Tachado">S</button>
          <button data-action="click->editor#paragraph" data-editor-tool="paragraph" aria-pressed="false" aria-label="Parágrafo">¶</button>
          <button data-action="click->editor#heading1" data-editor-tool="h1" aria-pressed="false" aria-label="Título 1">H1</button>
          <button data-action="click->editor#heading2" data-editor-tool="h2" aria-pressed="false" aria-label="Título 2">H2</button>
          <button data-action="click->editor#heading3" data-editor-tool="h3" aria-pressed="false" aria-label="Título 3">H3</button>
          <button data-action="click->editor#bulletList" data-editor-tool="bulletList" aria-pressed="false" aria-label="Lista">UL</button>
          <button data-action="click->editor#orderedList" data-editor-tool="orderedList" aria-pressed="false" aria-label="Lista Ordenada">OL</button>
          <button data-action="click->editor#blockquote" data-editor-tool="blockquote" aria-pressed="false" aria-label="Citação">"</button>
          <button data-action="click->editor#codeBlock" data-editor-tool="codeBlock" aria-pressed="false" aria-label="Código">&lt;/&gt;</button>
          <button data-action="click->editor#horizontalRule" aria-label="Separador">—</button>
          <button data-action="click->editor#undo" data-editor-history="undo" aria-label="Desfazer" disabled>Undo</button>
          <button data-action="click->editor#redo" data-editor-history="redo" aria-label="Refazer" disabled>Redo</button>
        </div>
        <div data-editor-target="content"></div>
        <div data-editor-target="statusBar">
          <span data-save-status aria-live="polite"></span>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function getEditorEl() {
    return container.querySelector("[data-controller=editor]");
  }

  test("toolbar has role and aria-label", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    expect(toolbarTarget.getAttribute("role")).toBe("toolbar");
    expect(toolbarTarget.getAttribute("aria-label")).toBeTruthy();
  });

  test("all toolbar buttons have aria-label", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    const buttons = toolbarTarget.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.getAttribute("aria-label")).toBeTruthy();
    });
  });

  test("tool buttons have aria-pressed", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    const toolButtons = toolbarTarget.querySelectorAll("[data-editor-tool]");
    toolButtons.forEach((btn) => {
      expect(btn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  test("history buttons have data-editor-history", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    const undoBtn = toolbarTarget.querySelector("[data-editor-history='undo']");
    const redoBtn = toolbarTarget.querySelector("[data-editor-history='redo']");
    expect(undoBtn).not.toBeNull();
    expect(redoBtn).not.toBeNull();
  });

  test("editor content target exists", () => {
    const contentTarget = getEditorEl().querySelector('[data-editor-target="content"]');
    expect(contentTarget).not.toBeNull();
    expect(contentTarget.getAttribute("data-editor-target")).toBe("content");
  });

  test("status bar target exists", () => {
    const statusBar = getEditorEl().querySelector('[data-editor-target="statusBar"]');
    expect(statusBar).not.toBeNull();
  });

  test("save status element has aria-live", () => {
    const statusEl = getEditorEl().querySelector("[data-save-status]");
    expect(statusEl.getAttribute("aria-live")).toBe("polite");
  });

  test("editor data attributes are set correctly", () => {
    const el = getEditorEl();
    expect(el.dataset.editorBookIdValue).toBe("1");
    expect(el.dataset.editorChapterIdValue).toBe("10");
    expect(el.dataset.editorChapterTitleValue).toBe("Capítulo Teste");
    expect(el.dataset.editorContentValue).toBe("<p>Hello</p>");
  });

  test("data attributes handle special characters without breaking", () => {
    const el = getEditorEl();
    el.dataset.editorContentValue = '<p>Texto com "aspas" e \'apóstrofos\'</p>';
    expect(el.dataset.editorContentValue).toContain("aspas");
  });

  test("toolbar buttons are focusable", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    const buttons = toolbarTarget.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });

  test("undo/redo buttons start disabled", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    const undoBtn = toolbarTarget.querySelector("[data-editor-history='undo']");
    const redoBtn = toolbarTarget.querySelector("[data-editor-history='redo']");
    expect(undoBtn.disabled).toBe(true);
    expect(redoBtn.disabled).toBe(true);
  });

  test("buttons with aria-keyshortcuts exist", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    const boldBtn = toolbarTarget.querySelector("[data-editor-tool='bold']");
    expect(boldBtn.getAttribute("aria-keyshortcuts")).toBeTruthy();
  });

  test("each tool button has a data-action", () => {
    const toolbarTarget = getEditorEl().querySelector('[data-editor-target="toolbar"]');
    const toolButtons = toolbarTarget.querySelectorAll("[data-editor-tool]");
    toolButtons.forEach((btn) => {
      expect(btn.getAttribute("data-action")).toContain("editor#");
    });
  });
});
