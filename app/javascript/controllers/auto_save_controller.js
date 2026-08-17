import { Controller } from "@hotwired/stimulus"
import { Turbo } from "@hotwired/turbo-rails"

export default class extends Controller {
  static values = {
    bookId: Number,
    chapterId: Number,
    debounceMs: { type: Number, default: 30000 },
    maxRetries: { type: Number, default: 3 }
  }

  connect() {
    this.timeout = null
    this.dirty = false
    this.saving = false
    this.savePromise = null
    this.pendingNavigation = false

    this.boundSaveOnBeforeUnload = this.saveOnBeforeUnload.bind(this)
    this.boundSaveOnVisibilityChange = this.saveOnVisibilityChange.bind(this)
    this.boundSaveOnTurboVisit = this.saveOnTurboVisit.bind(this)
    this.boundMarkDirty = this.markDirty.bind(this)

    window.addEventListener("beforeunload", this.boundSaveOnBeforeUnload)
    document.addEventListener("visibilitychange", this.boundSaveOnVisibilityChange)
    document.addEventListener("turbo:before-visit", this.boundSaveOnTurboVisit)
    this.element.addEventListener("editor:contentChanged", this.boundMarkDirty)
  }

  disconnect() {
    this.clearDebounce()
    window.removeEventListener("beforeunload", this.boundSaveOnBeforeUnload)
    document.removeEventListener("visibilitychange", this.boundSaveOnVisibilityChange)
    document.removeEventListener("turbo:before-visit", this.boundSaveOnTurboVisit)
    this.element.removeEventListener("editor:contentChanged", this.boundMarkDirty)
  }

  get editorController() {
    return this.application.getControllerForElementAndIdentifier(this.element, "editor")
  }

  async save({ flush = false } = {}) {
    if (!this.chapterIdValue) return "noop"

    let iterations = 0

    while (true) {
      iterations += 1
      let status

      if (this.saving) {
        this.dirty = true
        status = await this.savePromise
      } else {
        const editorData = this.getEditorData()
        if (!editorData) return "terminal"

        if (!this.dirty) return "saved"

        this.clearDebounce()
        this.saving = true
        this.savePromise = this.performSave(editorData, 0)
        status = await this.savePromise
        this.saving = false
        this.savePromise = null
      }

      if (status === "saved" && !this.dirty) return "saved"
      if (status === "terminal") return "terminal"

      if (status === "retry" || !flush || iterations >= 3) {
        this.scheduleAutoSave()
        return status === "retry" ? "retry" : "saved"
      }
    }
  }

  async performSave(editorData, attempt) {
    let response
    try {
      response = await fetch(
        `/books/${this.bookIdValue}/chapters/${this.chapterIdValue}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": this.csrfToken,
            "Accept": "application/json"
          },
          body: JSON.stringify({
            chapter: { content: editorData.content }
          })
        }
      )
    } catch (_error) {
      return this.retrySave(editorData, attempt)
    }

    if (response.ok) {
      this.markCleanIfCurrent(editorData)
      this.showSaveStatus("saved")
      return "saved"
    }

    if (response.status >= 500) {
      return this.retrySave(editorData, attempt)
    }

    this.showSaveStatus("error")
    this.dirty = true
    return "terminal"
  }

  async retrySave(editorData, attempt) {
    if (attempt >= this.maxRetriesValue) {
      this.showSaveStatus("error")
      this.dirty = true
      return "retry"
    }

    this.showSaveStatus("saving")
    await this.delay(this.backoffDelay(attempt))
    return this.performSave(editorData, attempt + 1)
  }

  markCleanIfCurrent(editorData) {
    const current = this.getEditorData()
    if (current?.content === editorData.content) {
      this.dirty = false
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

  saveOnBeforeUnload() {
    if (this.dirty && this.chapterIdValue) {
      this.saveViaBeacon()
    }
  }

  saveOnTurboVisit(event) {
    if (this.dirty && this.chapterIdValue && !this.pendingNavigation) {
      event.preventDefault()
      this.pendingNavigation = true
      const { url, action } = event.detail
      this.save({ flush: true }).then((status) => {
        this.pendingNavigation = false
        if (status === "saved" || status === "terminal") {
          Turbo.visit(url, { action })
        } else {
          this.dirty = true
        }
      })
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

    return { content: this.editorController.editor.getHTML() }
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

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  backoffDelay(attempt) {
    return 1000 * 2 ** attempt
  }

  get csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ""
  }
}
