import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    setTimeout(() => {
      this.element.classList.add("opacity-0", "translate-x-full")
      setTimeout(() => this.element.remove(), 300)
    }, 5000)
  }
}
