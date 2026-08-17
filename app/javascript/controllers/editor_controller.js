import { Controller } from "@hotwired/stimulus";
import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { calculateWordCount } from "../helpers/word_count";

const EditorShortcuts = Extension.create({
  name: "editorShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-u": () => this.editor.chain().focus().toggleUnderline().run(),
      "Mod-k": () => {
        this.editor.view.dom.dispatchEvent(
          new CustomEvent("editor:linkShortcut", { bubbles: true }),
        );
        return true;
      },
    };
  },
});

const Indentation = Extension.create({
  name: "indentation",
  addOptions() {
    return { types: ["paragraph", "heading"], minLevel: 0, maxLevel: 6 };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const level = parseInt(element.style.marginLeft, 10) / 40 || 0;
              return Math.min(Math.max(level, 0), 6);
            },
            renderHTML: (attributes) => {
              if (!attributes.indent || attributes.indent <= 0) return {};
              return { style: `margin-left: ${attributes.indent * 40}px` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      indent: () => ({ tr, state, dispatch }) => {
        const { selection } = state;
        const pos = selection.$from;
        const node = pos.node(pos.depth === 0 ? 0 : pos.depth);
        if (!node || !this.options.types.includes(node.type.name)) return false;
        const currentIndent = node.attrs.indent || 0;
        if (currentIndent >= this.options.maxLevel) return false;
        if (dispatch) {
          tr.setNodeMarkup(pos.before(pos.depth === 0 ? 1 : pos.depth), undefined, {
            ...node.attrs,
            indent: currentIndent + 1,
          });
          dispatch(tr);
        }
        return true;
      },
      outdent: () => ({ tr, state, dispatch }) => {
        const { selection } = state;
        const pos = selection.$from;
        const node = pos.node(pos.depth === 0 ? 0 : pos.depth);
        if (!node || !this.options.types.includes(node.type.name)) return false;
        const currentIndent = node.attrs.indent || 0;
        if (currentIndent <= this.options.minLevel) return false;
        if (dispatch) {
          tr.setNodeMarkup(pos.before(pos.depth === 0 ? 1 : pos.depth), undefined, {
            ...node.attrs,
            indent: currentIndent - 1,
          });
          dispatch(tr);
        }
        return true;
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("codeBlock")) return false;
        return this.editor.commands.indent();
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("codeBlock")) return false;
        return this.editor.commands.outdent();
      },
    };
  },
});

export default class extends Controller {
  static targets = ["toolbar", "content", "statusBar"];
  static values = {
    bookId: Number,
    chapterId: Number,
    chapterTitle: String,
    content: { type: String, default: "" },
  };

  connect() {
    this.editor = new Editor({
      element: this.contentTarget,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: {
            openOnClick: false,
            autolink: true,
            defaultProtocol: "https",
            HTMLAttributes: {
              rel: "noopener noreferrer nofollow",
              target: "_blank",
            },
          },
        }),
        Underline,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Indentation,
        Placeholder.configure({
          placeholder: "Comece a escrever sua história...",
          emptyEditorClass: "is-editor-empty",
          emptyNodeClass: "is-empty",
        }),
        EditorShortcuts,
      ],
      content: this.contentValue,
      editorProps: {
        attributes: {
          class:
            "prose prose-lg max-w-none focus:outline-none min-h-[60vh] px-8 py-6 font-reading text-[18px] leading-relaxed text-text-primary",
          "aria-label": "Editor de conteúdo",
        },
      },
      onUpdate: ({ editor }) => {
        this.dispatchContentChanged(editor);
      },
      onSelectionUpdate: () => {
        this.updateToolbarState();
      },
      onTransaction: ({ transaction }) => {
        if (transaction.docChanged || transaction.selectionSet) {
          this.updateToolbarState();
        }
      },
    });

    this.element.editorController = this;
    this.handleToolbarKeydown = this.handleToolbarKeydown.bind(this);
    if (this.hasToolbarTarget) {
      this.toolbarTarget.addEventListener("keydown", this.handleToolbarKeydown);
      this.updateShortcutLabels();
      this.setupToolbarScroll();
    }
    this.updateToolbarState();
  }

  disconnect() {
    if (this.hasToolbarTarget) {
      this.toolbarTarget.removeEventListener(
        "keydown",
        this.handleToolbarKeydown,
      );
    }
    if (this._toolbarResizeObserver) {
      this._toolbarResizeObserver.disconnect();
    }
    if (this.editor) {
      this.editor.destroy();
    }
  }

  handleToolbarKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      this.toolbarTarget.querySelectorAll("button:not([disabled])"),
    );
    if (buttons.length === 0) return;

    const currentIndex = buttons.indexOf(document.activeElement);
    let newIndex;

    if (event.key === "Home") {
      newIndex = 0;
    } else if (event.key === "End") {
      newIndex = buttons.length - 1;
    } else if (event.key === "ArrowRight") {
      newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % buttons.length;
    } else {
      newIndex =
        currentIndex === -1
          ? buttons.length - 1
          : (currentIndex - 1 + buttons.length) % buttons.length;
    }

    event.preventDefault();
    buttons[newIndex].focus();
  }

  updateShortcutLabels() {
    if (!this.hasToolbarTarget) return;
    if (!/Mac|iPhone|iPad|iPod/.test(navigator.platform)) return;

    this.toolbarTarget
      .querySelectorAll("[aria-keyshortcuts]")
      .forEach((el) => {
        const shortcuts = el.getAttribute("aria-keyshortcuts");
        if (shortcuts) {
          el.setAttribute("aria-keyshortcuts", shortcuts.replace(/Control/g, "Meta"));
        }
      });
  }

  setupToolbarScroll() {
    if (!this.hasToolbarTarget) return;
    const toolbar = this.toolbarTarget;

    const checkScroll = () => {
      const isScrollable = toolbar.scrollWidth > toolbar.clientWidth;
      toolbar.classList.toggle("scrollable", isScrollable);
    };

    checkScroll();
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(toolbar);
    this._toolbarResizeObserver = resizeObserver;
  }

  dispatchContentChanged(editor) {
    const text = editor.getText();

    this.element.dispatchEvent(
      new CustomEvent("editor:contentChanged", {
        detail: { wordCount: calculateWordCount(text), text },
        bubbles: true,
      }),
    );
  }

  bold() {
    this.editor.chain().focus().toggleBold().run();
  }

  italic() {
    this.editor.chain().focus().toggleItalic().run();
  }

  underline() {
    this.editor.chain().focus().toggleUnderline().run();
  }

  strike() {
    this.editor.chain().focus().toggleStrike().run();
  }

  paragraph() {
    this.editor.chain().focus().setParagraph().run();
  }

  heading1() {
    this.editor.chain().focus().toggleHeading({ level: 1 }).run();
  }

  heading2() {
    this.editor.chain().focus().toggleHeading({ level: 2 }).run();
  }

  heading3() {
    this.editor.chain().focus().toggleHeading({ level: 3 }).run();
  }

  bulletList() {
    this.editor.chain().focus().toggleBulletList().run();
  }

  orderedList() {
    this.editor.chain().focus().toggleOrderedList().run();
  }

  blockquote() {
    this.editor.chain().focus().toggleBlockquote().run();
  }

  codeBlock() {
    this.editor.chain().focus().toggleCodeBlock().run();
  }

  alignLeft() {
    this.editor.chain().focus().setTextAlign("left").run();
  }

  alignCenter() {
    this.editor.chain().focus().setTextAlign("center").run();
  }

  alignRight() {
    this.editor.chain().focus().setTextAlign("right").run();
  }

  indent() {
    this.editor.chain().focus().indent().run();
  }

  outdent() {
    this.editor.chain().focus().outdent().run();
  }

  horizontalRule() {
    this.editor.chain().focus().setHorizontalRule().run();
  }

  undo() {
    this.editor.chain().focus().undo().run();
  }

  redo() {
    this.editor.chain().focus().redo().run();
  }

  isActive(name, attrs) {
    return this.editor.isActive(name, attrs);
  }

  updateToolbarState() {
    if (!this.hasToolbarTarget) return;

    this.toolbarTarget
      .querySelectorAll("[data-editor-tool]")
      .forEach((button) => {
        const tool = button.dataset.editorTool;
        const isActive = this.isToolActive(tool);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
        button.classList.toggle("is-active", isActive);
      });

    this.toolbarTarget
      .querySelectorAll("[data-editor-history]")
      .forEach((button) => {
        const action = button.dataset.editorHistory;
        const enabled =
          action === "undo"
            ? this.editor.can().undo()
            : this.editor.can().redo();
        button.disabled = !enabled;
      });
  }

  isToolActive(tool) {
    switch (tool) {
      case "bold":
        return this.editor.isActive("bold");
      case "italic":
        return this.editor.isActive("italic");
      case "underline":
        return this.editor.isActive("underline");
      case "strike":
        return this.editor.isActive("strike");
      case "paragraph":
        return this.editor.isActive("paragraph");
      case "h1":
        return this.editor.isActive("heading", { level: 1 });
      case "h2":
        return this.editor.isActive("heading", { level: 2 });
      case "h3":
        return this.editor.isActive("heading", { level: 3 });
      case "bulletList":
        return this.editor.isActive("bulletList");
      case "orderedList":
        return this.editor.isActive("orderedList");
      case "blockquote":
        return this.editor.isActive("blockquote");
      case "codeBlock":
        return this.editor.isActive("codeBlock");
      case "link":
        return this.editor.isActive("link");
      case "alignLeft":
        return this.editor.isActive({ textAlign: "left" });
      case "alignCenter":
        return this.editor.isActive({ textAlign: "center" });
      case "alignRight":
        return this.editor.isActive({ textAlign: "right" });
      default:
        return false;
    }
  }

  showSavingStatus() {
    const statusEl = this.statusBarTarget?.querySelector("[data-save-status]");
    if (statusEl) {
      statusEl.textContent = "Salvando...";
      statusEl.classList.remove("text-success");
      statusEl.classList.add("text-text-muted");
    }
  }

  showSavedStatus() {
    const statusEl = this.statusBarTarget?.querySelector("[data-save-status]");
    if (statusEl) {
      const now = new Date();
      const time = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      statusEl.textContent = `Salvo automaticamente às ${time}`;
      statusEl.classList.remove("text-text-muted");
      statusEl.classList.add("text-success");
    }
  }

  showErrorStatus() {
    const statusEl = this.statusBarTarget?.querySelector("[data-save-status]");
    if (statusEl) {
      statusEl.textContent = "Erro ao salvar";
      statusEl.classList.remove("text-success");
      statusEl.classList.add("text-error");
    }
  }

  async loadChapter(event) {
    const { chapterId } = event.detail;
    if (chapterId === this.chapterIdValue) return;

    const autoSaveCtrl = this.application.getControllerForElementAndIdentifier(
      this.element,
      "auto-save",
    );

    if (autoSaveCtrl) {
      if (autoSaveCtrl.chapterIdValue) {
        const status = await autoSaveCtrl.save({ flush: true });
        if (status !== "saved") return;
      }
      autoSaveCtrl.updateChapterId(chapterId);
    }

    try {
      const response = await fetch(
        `/books/${this.bookIdValue}/chapters/${chapterId}`,
        {
          headers: { Accept: "application/json" },
        },
      );

      if (response.ok) {
        const chapter = await response.json();
        this.chapterIdValue = chapter.id;
        this.chapterTitleValue = chapter.title;
        this.contentValue = chapter.content || "";
        this.editor.commands.setContent(this.contentValue);

        this.element.dispatchEvent(
          new CustomEvent("editor:chapterChanged", {
            detail: { chapterId: chapter.id },
            bubbles: true,
          }),
        );
      }
    } catch (error) {
      console.error("Erro ao carregar capítulo:", error);
    }
  }
}
