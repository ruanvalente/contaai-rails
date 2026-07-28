import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["wordCount", "charCount"]

  connect() {
    this.updateFromEditor()
    this.boundUpdate = this.updateFromEvent.bind(this)
    this.element.addEventListener("editor:contentChanged", this.boundUpdate)
    this.element.addEventListener("editor:chapterChanged", this.boundUpdate)
  }

  disconnect() {
    this.element.removeEventListener("editor:contentChanged", this.boundUpdate)
    this.element.removeEventListener("editor:chapterChanged", this.boundUpdate)
  }

  updateFromEvent(event) {
    if (event.detail?.wordCount !== undefined) {
      this.updateDisplay(event.detail.wordCount)
    } else {
      this.updateFromEditor()
    }
  }

  updateFromEditor() {
    const editorEl = this.element.querySelector("[data-controller*='editor']")
    const editorController = editorEl?.editorController

    if (editorController?.editor) {
      const text = editorController.editor.getText()
      const wordCount = this.calculateWordCount(text)
      const charCount = text.length
      this.updateDisplay(wordCount, charCount)
    } else {
      this.updateFromDOM()
    }
  }

  updateDisplay(wordCount, charCount) {
    if (charCount === undefined) {
      const editorEl = this.element.querySelector("[data-controller*='editor']")
      const editorController = editorEl?.editorController
      if (editorController?.editor) {
        charCount = editorController.editor.getText().length
      } else {
        charCount = 0
      }
    }

    if (this.hasWordCountTarget) {
      this.wordCountTarget.textContent = `${wordCount.toLocaleString("pt-BR")} palavras`
    }

    if (this.hasCharCountTarget) {
      this.charCountTarget.textContent = `${charCount.toLocaleString("pt-BR")} caracteres`
    }

    this.updateSidebarWordCount(wordCount)
  }

  updateSidebarWordCount(wordCount) {
    const activeChapter = this.getActiveChapterElement()
    if (!activeChapter) return

    const countEl = activeChapter.querySelector(".chapter-word-count")
    if (countEl) {
      countEl.textContent = `${wordCount.toLocaleString("pt-BR")} pal.`
    }
  }

  calculateWordCount(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0
  }

  getActiveChapterElement() {
    const list = document.querySelector("[data-chapter-panel-target='list']")
    if (!list) return null

    const activeId = document.querySelector("[data-controller*='editor']")?.editorController?.chapterIdValue
    if (!activeId) return null

    return list.querySelector(`li[data-chapter-id='${activeId}']`)
  }

  updateFromDOM() {
    if (this.hasWordCountTarget) {
      const currentText = this.wordCountTarget.textContent
      const match = currentText.match(/([\d.]+)/)
      if (match) {
        const wordCount = parseInt(match[1].replace(".", ""), 10)
        this.updateDisplay(wordCount, 0)
      }
    }
  }
}
