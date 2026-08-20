import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["content", "chapterTitle", "chapterNumber", "progressBar", "progressText", "previousButton", "nextButton"]
  static values = {
    bookId: Number,
    chapterId: Number,
    currentIndex: Number,
    totalChapters: Number,
    hasPrevious: Boolean,
    hasNext: Boolean,
    csrfToken: String
  }

  connect() {
    this.setupKeyboardShortcuts()
  }

  disconnect() {
    this.removeKeyboardShortcuts()
  }

  setupKeyboardShortcuts() {
    this.boundKeydown = this.handleKeydown.bind(this)
    document.addEventListener("keydown", this.boundKeydown)
  }

  removeKeyboardShortcuts() {
    document.removeEventListener("keydown", this.boundKeydown)
  }

  handleKeydown(event) {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.isContentEditable) {
      return
    }

    switch (event.key) {
      case "ArrowLeft":
        if (this.hasPreviousValue) {
          event.preventDefault()
          this.goToPreviousChapter()
        }
        break
      case "ArrowRight":
        if (this.hasNextValue) {
          event.preventDefault()
          this.goToNextChapter()
        }
        break
      case "i":
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault()
          this.toggleChapterIndex()
        }
        break
    }
  }

  goToPreviousChapter() {
    if (!this.hasPreviousValue) return
    const url = this.buildChapterUrl(this.currentIndexValue - 1)
    Turbo.visit(url)
  }

  goToNextChapter() {
    if (!this.hasNextValue) return
    const url = this.buildChapterUrl(this.currentIndexValue + 1)
    Turbo.visit(url)
  }

  goToChapter(event) {
    const chapterId = event.currentTarget.dataset.chapterId
    if (chapterId) {
      const url = this.buildChapterUrlWithId(chapterId)
      Turbo.visit(url)
    }
  }

  toggleChapterIndex() {
    const event = new CustomEvent("chapter-index:toggle", { bubbles: true })
    this.element.dispatchEvent(event)
  }

  buildChapterUrl(index) {
    return `/books/${this.bookIdValue}/read?chapter_index=${index}`
  }

  buildChapterUrlWithId(chapterId) {
    return `/books/${this.bookIdValue}/read?chapter_id=${chapterId}`
  }
}
