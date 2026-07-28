import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    bookId: Number,
    chapterId: Number,
    debounceMs: { type: Number, default: 30000 }
  }

  connect() {
    this.timeout = null
    this.dirty = false
    this.editorController = null

    this.boundSaveOnBeforeUnload = this.saveOnBeforeUnload.bind(this)
    this.boundSaveOnVisibilityChange = this.saveOnVisibilityChange.bind(this)
    this.boundMarkDirty = this.markDirty.bind(this)

    window.addEventListener("beforeunload", this.boundSaveOnBeforeUnload)
    document.addEventListener("visibilitychange", this.boundSaveOnVisibilityChange)
    this.element.addEventListener("editor:contentChanged", this.boundMarkDirty)

    setTimeout(() => {
      this.editorController = this.application.getControllerForElementAndIdentifier(
        this.element,
        "editor"
      )
    }, 0)
  }

  disconnect() {
    this.clearDebounce()
    window.removeEventListener("beforeunload", this.boundSaveOnBeforeUnload)
    document.removeEventListener("visibilitychange", this.boundSaveOnVisibilityChange)
    this.element.removeEventListener("editor:contentChanged", this.boundMarkDirty)
  }

  async save() {
    if (!this.chapterIdValue) return false

    const editorData = this.getEditorData()
    if (!editorData) return false

    this.dirty = false
    this.clearDebounce()

    try {
      const response = await fetch(
        `/books/${this.bookIdValue}/chapters/${this.chapterIdValue}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": this.csrfToken,
            "Accept": "application/json"
          },
          body: JSON.stringify({
            chapter: {
              content: editorData.content,
              word_count: editorData.wordCount
            }
          })
        }
      )

      if (response.ok) {
        this.showSaveStatus("saved")
        return true
      } else {
        this.showSaveStatus("error")
        return false
      }
    } catch (_error) {
      this.showSaveStatus("error")
      this.dirty = true
      return false
    }
  }

  markDirty() {
    this.dirty = true
    this.showSaveStatus("saving")
    this.scheduleAutoSave()
  }

  updateChapterId(chapterId) {
    this.chapterIdValue = chapterId
  }

  saveOnVisibilityChange() {
    if (document.hidden && this.dirty) {
      this.save()
    }
  }

  saveOnBeforeUnload(event) {
    if (this.dirty && this.chapterIdValue) {
      this.saveViaBeacon()
      event.preventDefault()
    }
  }

  saveViaBeacon() {
    const editorData = this.getEditorData()
    if (!editorData) return

    navigator.sendBeacon(
      `/books/${this.bookIdValue}/chapters/${this.chapterIdValue}`,
      new URLSearchParams({
        "_method": "patch",
        "chapter[content]": editorData.content,
        "chapter[word_count]": editorData.wordCount,
        "authenticity_token": this.csrfToken
      })
    )

    this.dirty = false
  }

  scheduleAutoSave() {
    this.clearDebounce()

    this.timeout = setTimeout(() => {
      if (this.dirty) {
        this.save()
      }
    }, this.debounceMsValue)
  }

  clearDebounce() {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  getEditorData() {
    if (!this.editorController?.editor) return null

    const content = this.editorController.editor.getHTML()
    const text = this.editorController.editor.getText()
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

    return { content, wordCount }
  }

  showSaveStatus(status) {
    if (this.editorController) {
      if (status === "saved") {
        this.editorController.showSavedStatus()
      } else if (status === "error") {
        this.editorController.showErrorStatus()
      } else {
        this.editorController.showSavingStatus()
      }
    }
  }

  get csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ""
  }
}
