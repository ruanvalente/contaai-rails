import { Controller } from "@hotwired/stimulus"
import { trapFocus } from "../helpers/focus_trap"

export default class extends Controller {
  static targets = ["sidebar", "overlay", "toggle", "addButton"]

  connect() {
    this.handleResize = this.handleResize.bind(this)
    this.handleKeydown = this.handleKeydown.bind(this)
    window.addEventListener("resize", this.handleResize)
    document.addEventListener("keydown", this.handleKeydown, true)
    this.handleResize()
  }

  disconnect() {
    window.removeEventListener("resize", this.handleResize)
    document.removeEventListener("keydown", this.handleKeydown, true)
  }

  toggle() {
    if (!this.isMobile()) return

    if (this.isOpen()) {
      this.closeMobile()
    } else {
      this.openMobile()
    }
  }

  openMobile() {
    this.sidebarTarget.classList.remove("-translate-x-full", "invisible")
    this.sidebarTarget.setAttribute("aria-hidden", "false")
    this.overlayTarget.classList.remove("hidden")
    this.toggleTarget.setAttribute("aria-expanded", "true")
    document.body.style.overflow = "hidden"
    if (this.hasAddButtonTarget) {
      this.addButtonTarget.focus()
    }
  }

  closeMobile() {
    this.setClosedState()
    this.toggleTarget.focus()
  }

  close() {
    if (this.isMobile()) {
      this.setClosedState()
    }
  }

  setClosedState() {
    this.sidebarTarget.classList.add("-translate-x-full", "invisible")
    this.sidebarTarget.setAttribute("aria-hidden", "true")
    this.overlayTarget.classList.add("hidden")
    this.toggleTarget.setAttribute("aria-expanded", "false")
    document.body.style.overflow = ""
  }

  handleKeydown(event) {
    if (!this.isMobile()) return

    if (event.key === "Escape" && this.isOpen()) {
      this.closeMobile()
      return
    }

    if (event.key === "Tab" && this.isOpen()) {
      trapFocus(this.sidebarTarget, event)
    }
  }

  handleResize() {
    if (this.isMobile()) {
      if (this.isOpen()) {
        this.setClosedState()
      }
    } else {
      this.sidebarTarget.classList.remove("-translate-x-full", "invisible")
      this.sidebarTarget.setAttribute("aria-hidden", "false")
      this.overlayTarget.classList.add("hidden")
      this.toggleTarget.setAttribute("aria-expanded", "false")
      document.body.style.overflow = ""
    }
  }

  isOpen() {
    return !this.sidebarTarget.classList.contains("-translate-x-full")
  }

  isMobile() {
    return window.innerWidth < 1024
  }
}
