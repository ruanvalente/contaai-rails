import { Controller } from "@hotwired/stimulus"
import { calculateWordCount, calculateCharacterCount } from "../helpers/word_count"

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
    const wordCount = event.detail?.wordCount
    const text = event.detail?.text

    if (wordCount !== undefined) {
      this.updateDisplay(wordCount, calculateCharacterCount(text))
    } else {
      this.updateFromEditor()
    }
  }

  updateFromEditor() {
    const editor = this.element.editorController?.editor
    if (!editor) return

    const text = editor.getText()
    this.updateDisplay(calculateWordCount(text), calculateCharacterCount(text))
  }

  updateDisplay(wordCount, charCount) {
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

  getActiveChapterElement() {
    const list = document.querySelector("[data-chapter-panel-target='list']")
    if (!list) return null

    const activeId = this.element.editorController?.chapterIdValue
    if (!activeId) return null

    return list.querySelector(`li[data-chapter-id='${activeId}']`)
  }
}
