import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "eyeOn", "eyeOff"]

  toggle() {
    const input = this.inputTarget
    const isPassword = input.type === "password"

    input.type = isPassword ? "text" : "password"
    this.eyeOffTarget.classList.toggle("hidden", isPassword)
    this.eyeOnTarget.classList.toggle("hidden", !isPassword)
  }
}
