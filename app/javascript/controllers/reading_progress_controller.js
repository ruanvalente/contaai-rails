import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    bookId: Number,
    chapterId: Number,
    csrfToken: String
  }

  connect() {
    this.trackProgress()
  }

  trackProgress() {
    if (!this.bookIdValue || !this.chapterIdValue) return

    this.updateProgress()
  }

  updateProgress() {
    const url = `/books/${this.bookIdValue}/reading_progress`
    const data = {
      chapter_id: this.chapterIdValue
    }

    fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": this.csrfTokenValue || document.querySelector("meta[name='csrf-token']")?.content
      },
      body: JSON.stringify(data)
    }).then(response => {
      if (response.ok) {
        return response.json()
      }
      throw new Error("Failed to update progress")
    }).then(data => {
      this.dispatch("updated", { detail: data })
    }).catch(error => {
      console.error("Error updating reading progress:", error)
    })
  }
}
