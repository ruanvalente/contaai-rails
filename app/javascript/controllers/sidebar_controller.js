import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["sidebar", "overlay", "toggle"]

  connect() {
    this.handleResize = this.handleResize.bind(this)
    this.handleKeydown = this.handleKeydown.bind(this)
    window.addEventListener("resize", this.handleResize)
    document.addEventListener("keydown", this.handleKeydown)
    this.handleResize()
  }

  disconnect() {
    window.removeEventListener("resize", this.handleResize)
    document.removeEventListener("keydown", this.handleKeydown)
  }

  toggle(event) {
    if (!this.isMobile()) return
    this.lastToggle = event.currentTarget
    if (this.isOpen()) {
      this.closeMobile()
    } else {
      this.openMobile()
    }
  }

  close() {
    if (this.isMobile() && this.isOpen()) {
      this.closeMobile()
    }
  }

  openMobile() {
    this.sidebarTarget.classList.remove("-translate-x-full")
    this.sidebarTarget.setAttribute("aria-hidden", "false")
    this.overlayTarget.classList.remove("hidden")
    this.setExpanded(true)
    document.body.style.overflow = "hidden"
    const firstLink = this.sidebarTarget.querySelector("a")
    if (firstLink) firstLink.focus()
  }

  closeMobile() {
    this.setClosedState()
    const toggle = this.lastToggle && this.lastToggle.isConnected ? this.lastToggle : this.toggleTargets[0]
    if (toggle) toggle.focus()
  }

  setClosedState() {
    this.sidebarTarget.classList.add("-translate-x-full")
    this.sidebarTarget.setAttribute("aria-hidden", "true")
    this.overlayTarget.classList.add("hidden")
    this.setExpanded(false)
    document.body.style.overflow = ""
  }

  setExpanded(expanded) {
    this.toggleTargets.forEach((el) => el.setAttribute("aria-expanded", String(expanded)))
  }

  handleKeydown(event) {
    if (event.key !== "Escape" || !this.isMobile()) return
    if (this.isOpen()) {
      this.closeMobile()
    }
  }

  handleResize() {
    if (this.isMobile()) {
      if (this.isOpen()) {
        this.setClosedState()
      }
    } else {
      this.sidebarTarget.classList.remove("-translate-x-full")
      this.sidebarTarget.setAttribute("aria-hidden", "false")
      this.overlayTarget.classList.add("hidden")
      this.setExpanded(false)
      document.body.style.overflow = ""
    }
  }

  isOpen() {
    return !this.sidebarTarget.classList.contains("-translate-x-full")
  }

  isMobile() {
    return window.innerWidth < 640
  }
}
