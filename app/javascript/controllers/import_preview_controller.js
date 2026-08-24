import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["rows", "template", "row", "count"]

  connect() {
    this.renumber()
  }

  add(event) {
    event.preventDefault()
    const fragment = this.templateTarget.content.cloneNode(true)
    this.rowsTarget.appendChild(fragment)
    this.renumber()

    const lastTitle = this.lastRow?.querySelector("input[name$='[title]']")
    if (lastTitle) lastTitle.focus()
  }

  remove(event) {
    event.preventDefault()
    const row = this.rowFor(event)
    if (!row) return

    if (this.rowTargets.length === 1) {
      const title = row.querySelector("input[name$='[title]']")
      const content = row.querySelector("textarea")
      if (title) title.value = ""
      if (content) content.value = ""
    } else {
      row.remove()
    }

    this.renumber()
  }

  moveUp(event) {
    event.preventDefault()
    const row = this.rowFor(event)
    const previous = row?.previousElementSibling
    if (!row || !previous) return

    previous.before(row)
    this.renumber()
    row.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }

  moveDown(event) {
    event.preventDefault()
    const row = this.rowFor(event)
    const next = row?.nextElementSibling
    if (!row || !next) return

    next.after(row)
    this.renumber()
    row.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }

  renumber() {
    this.rowTargets.forEach((row, index) => {
      const number = row.querySelector(".row-number")
      if (number) number.textContent = `${index + 1}.`
    })

    if (this.hasCountTarget) {
      const total = this.rowTargets.length
      this.countTarget.textContent =
        total === 1 ? "1 capítulo" : `${total} capítulos`
    }
  }

  rowFor(event) {
    return event.target.closest("[data-import-preview-target~='row']")
  }

  get lastRow() {
    return this.rowTargets[this.rowTargets.length - 1]
  }
}
