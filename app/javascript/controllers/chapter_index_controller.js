import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "overlay", "list", "listContainer", "collapseButton", "collapsedList"]
  static values = {
    open: Boolean,
    collapsed: Boolean
  }

  connect() {
    this.boundToggle = this.toggle.bind(this)
    this.element.addEventListener("chapter-index:toggle", this.boundToggle)

    // Initialize collapsed state on desktop
    if (window.innerWidth >= 1024) {
      this.collapsedValue = true
      this.collapse(false)
    }
  }

  disconnect() {
    this.element.removeEventListener("chapter-index:toggle", this.boundToggle)
    this.close()
  }

  toggle() {
    if (this.openValue) {
      this.close()
    } else {
      this.open()
    }
  }

  open() {
    this.openValue = true
    this.panelTarget.classList.remove("-translate-x-full")
    this.panelTarget.classList.add("translate-x-0")
    this.panelTarget.setAttribute("aria-hidden", "false")
    this.overlayTarget.classList.remove("hidden")
    document.body.style.overflow = "hidden"
    this.panelTarget.focus()
  }

  close() {
    this.openValue = false
    this.panelTarget.classList.add("-translate-x-full")
    this.panelTarget.classList.remove("translate-x-0")
    this.panelTarget.setAttribute("aria-hidden", "true")
    this.overlayTarget.classList.add("hidden")
    document.body.style.overflow = ""
  }

  toggleCollapse() {
    if (this.collapsedValue) {
      this.expand()
    } else {
      this.collapse()
    }
  }

  collapse(animate = true) {
    this.collapsedValue = true

    // Hide full list with animation
    const container = this.listContainerTarget
    if (animate) {
      container.style.maxHeight = container.scrollHeight + "px"
      container.offsetHeight // Force reflow
      container.style.maxHeight = "0"
      container.style.opacity = "0"
    } else {
      container.style.maxHeight = "0"
      container.style.opacity = "0"
    }

    // Show collapsed view with fade in
    this.collapsedListTarget.style.opacity = "0"
    this.collapsedListTarget.classList.remove("hidden")
    setTimeout(() => {
      this.collapsedListTarget.style.opacity = "1"
    }, animate ? 150 : 0)

    this.updateCollapseButtonIcon()
  }

  expand() {
    this.collapsedValue = false

    // Hide collapsed view with fade out
    this.collapsedListTarget.style.opacity = "0"
    setTimeout(() => {
      this.collapsedListTarget.classList.add("hidden")
    }, 150)

    // Show full list with animation
    const container = this.listContainerTarget
    container.style.maxHeight = "0"
    container.style.opacity = "0"
    container.offsetHeight // Force reflow

    const scrollHeight = container.scrollHeight
    container.style.maxHeight = scrollHeight + "px"
    container.style.opacity = "1"

    // Reset max-height after animation to allow scrolling
    setTimeout(() => {
      container.style.maxHeight = "none"
    }, 300)

    this.updateCollapseButtonIcon()
  }

  updateCollapseButtonIcon() {
    if (!this.hasCollapseButtonTarget) return

    const svg = this.collapseButtonTarget.querySelector("svg")
    if (!svg) return

    if (this.collapsedValue) {
      svg.innerHTML = '<path d="m6 9 6 6 6-6"/>'
      this.collapseButtonTarget.setAttribute("aria-expanded", "false")
      this.collapseButtonTarget.setAttribute("aria-label", "Expandir lista de capítulos")
    } else {
      svg.innerHTML = '<path d="m18 15-6-6-6 6"/>'
      this.collapseButtonTarget.setAttribute("aria-expanded", "true")
      this.collapseButtonTarget.setAttribute("aria-label", "Recolher lista de capítulos")
    }
  }

  closeOnOverlay() {
    this.close()
  }

  closeOnKeydown(event) {
    if (event.key === "Escape") {
      this.close()
    }
  }

  onBackdropClick(event) {
    if (event.target === this.overlayTarget) {
      this.close()
    }
  }
}
