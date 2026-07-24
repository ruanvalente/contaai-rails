import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["sidebar", "overlay"]

  connect() {
    this.handleResize = this.handleResize.bind(this)
    window.addEventListener("resize", this.handleResize)
    this.handleResize()
  }

  disconnect() {
    window.removeEventListener("resize", this.handleResize)
  }

  toggle() {
    if (this.isMobile()) {
      this.toggleMobile()
    }
  }

  close() {
    if (this.isMobile()) {
      this.closeMobile()
    }
  }

  toggleMobile() {
    const isOpen = !this.sidebarTarget.classList.contains("-translate-x-full")

    if (isOpen) {
      this.closeMobile()
    } else {
      this.openMobile()
    }
  }

  openMobile() {
    this.sidebarTarget.classList.remove("-translate-x-full")
    this.overlayTarget.classList.remove("hidden")
    document.body.style.overflow = "hidden"
  }

  closeMobile() {
    this.sidebarTarget.classList.add("-translate-x-full")
    this.overlayTarget.classList.add("hidden")
    document.body.style.overflow = ""
  }

  handleResize() {
    if (!this.isMobile()) {
      this.sidebarTarget.classList.remove("-translate-x-full")
      this.overlayTarget.classList.add("hidden")
      document.body.style.overflow = ""
    } else {
      this.sidebarTarget.classList.add("-translate-x-full")
    }
  }

  isMobile() {
    return window.innerWidth < 640
  }
}
