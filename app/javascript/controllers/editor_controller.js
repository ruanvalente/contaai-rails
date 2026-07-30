import { Controller } from "@hotwired/stimulus"
import { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"

export default class extends Controller {
  static targets = ["toolbar", "content", "statusBar"]
  static values = {
    bookId: Number,
    chapterId: Number,
    chapterTitle: String,
    content: { type: String, default: "" }
  }

  connect() {
    this.editor = new Editor({
      element: this.contentTarget,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] }
        })
      ],
      content: this.contentValue,
      editorProps: {
        attributes: {
          class: "prose prose-lg max-w-none focus:outline-none min-h-[60vh] px-8 py-6 font-reading text-[18px] leading-relaxed text-text-primary",
          "data-placeholder": "Comece a escrever sua história..."
        }
      },
      onUpdate: ({ editor }) => {
        this.dispatchContentChanged(editor)
      }
    })

    this.element.editorController = this

    setTimeout(() => {
      this.dispatchContentChanged(this.editor)
    }, 0)
  }

  disconnect() {
    if (this.editor) {
      this.editor.destroy()
    }
  }

  dispatchContentChanged(editor) {
    const text = editor.getText()
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

    this.element.dispatchEvent(
      new CustomEvent("editor:contentChanged", {
        detail: { wordCount, text },
        bubbles: true
      })
    )
  }

  bold() {
    this.editor.chain().focus().toggleBold().run()
  }

  italic() {
    this.editor.chain().focus().toggleItalic().run()
  }

  underline() {
    this.editor.chain().focus().toggleUnderline().run()
  }

  heading1() {
    this.editor.chain().focus().toggleHeading({ level: 1 }).run()
  }

  heading2() {
    this.editor.chain().focus().toggleHeading({ level: 2 }).run()
  }

  heading3() {
    this.editor.chain().focus().toggleHeading({ level: 3 }).run()
  }

  bulletList() {
    this.editor.chain().focus().toggleBulletList().run()
  }

  orderedList() {
    this.editor.chain().focus().toggleOrderedList().run()
  }

  blockquote() {
    this.editor.chain().focus().toggleBlockquote().run()
  }

  horizontalRule() {
    this.editor.chain().focus().setHorizontalRule().run()
  }

  undo() {
    this.editor.chain().focus().undo().run()
  }

  redo() {
    this.editor.chain().focus().redo().run()
  }

  isActive(name, attrs) {
    return this.editor.isActive(name, attrs)
  }

  showSavingStatus() {
    const statusEl = this.statusBarTarget?.querySelector("[data-save-status]")
    if (statusEl) {
      statusEl.textContent = "Salvando..."
      statusEl.classList.remove("text-success")
      statusEl.classList.add("text-text-muted")
    }
  }

  showSavedStatus() {
    const statusEl = this.statusBarTarget?.querySelector("[data-save-status]")
    if (statusEl) {
      const now = new Date()
      const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      statusEl.textContent = `Salvo automaticamente às ${time}`
      statusEl.classList.remove("text-text-muted")
      statusEl.classList.add("text-success")
    }
  }

  showErrorStatus() {
    const statusEl = this.statusBarTarget?.querySelector("[data-save-status]")
    if (statusEl) {
      statusEl.textContent = "Erro ao salvar"
      statusEl.classList.remove("text-success")
      statusEl.classList.add("text-error")
    }
  }

  async loadChapter(event) {
    const { chapterId } = event.detail
    if (chapterId === this.chapterIdValue) return

    const autoSaveCtrl = this.application.getControllerForElementAndIdentifier(
      this.element,
      "auto-save"
    )

    if (autoSaveCtrl) {
      if (autoSaveCtrl.chapterIdValue) {
        const saved = await autoSaveCtrl.save()
        if (!saved) return
      }
      autoSaveCtrl.updateChapterId(chapterId)
    }

    try {
      const response = await fetch(`/books/${this.bookIdValue}/chapters/${chapterId}`, {
        headers: { "Accept": "application/json" }
      })

      if (response.ok) {
        const chapter = await response.json()
        this.chapterIdValue = chapter.id
        this.chapterTitleValue = chapter.title
        this.editor.commands.setContent(chapter.content || "")

        this.element.dispatchEvent(
          new CustomEvent("editor:chapterChanged", {
            detail: { chapterId: chapter.id },
            bubbles: true
          })
        )
      }
    } catch (error) {
      console.error("Erro ao carregar capítulo:", error)
    }
  }

  getChapterData() {
    if (!this.editor) return null

    const content = this.editor.getHTML()
    const text = this.editor.getText()
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

    return { content, wordCount }
  }
}
