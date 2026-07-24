import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "results"]
  static values = { url: String }

  connect() {
    this.timeout = null
  }

  search() {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      const query = this.inputTarget.value.trim()
      if (query.length >= 2) {
        this.performSearch(query)
      } else {
        this.clearResults()
      }
    }, 300)
  }

  async performSearch(query) {
    try {
      const url = new URL(this.urlValue || "/search", window.location.origin)
      url.searchParams.set("q", query)

      const response = await fetch(url, {
        headers: {
          "Accept": "text/html",
          "X-Requested-With": "XMLHttpRequest"
        }
      })

      if (response.ok) {
        const html = await response.text()
        this.showResults(html)
      }
    } catch (error) {
      console.error("Search error:", error)
    }
  }

  showResults(html) {
    if (this.hasResultsTarget) {
      this.resultsTarget.innerHTML = html
      this.resultsTarget.classList.remove("hidden")
    }
  }

  clearResults() {
    if (this.hasResultsTarget) {
      this.resultsTarget.innerHTML = ""
      this.resultsTarget.classList.add("hidden")
    }
  }

  hideResults(event) {
    if (this.hasResultsTarget && !this.element.contains(event.target)) {
      this.clearResults()
    }
  }
}