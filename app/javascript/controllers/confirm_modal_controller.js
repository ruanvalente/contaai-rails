import { Controller } from "@hotwired/stimulus"
import { Modal } from "flowbite"
import { Turbo } from "@hotwired/turbo-rails"

let currentController = null

export function getConfirmModalController() {
  return currentController
}

export default class extends Controller {
  static targets = ["title", "message", "cancelButton", "confirmButton"]

  handleKeydown = (event) => {
    if (event.key !== "Tab") return

    const focusables = this.focusableElements()
    if (focusables.length === 0) return

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const activeElement = document.activeElement

    if (!this.element.contains(activeElement)) {
      event.preventDefault()
      first.focus()
      return
    }

    if (event.shiftKey && activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  connect() {
    currentController = this
    this.previouslyFocusedElement = null
    this.pendingResolve = null

    this.modal = new Modal(this.element, {
      backdropClasses: "bg-black/50 backdrop-blur-sm fixed inset-0 z-40",
      onHide: () => this.handleHide()
    })

    this.installTurboConfirm()
  }

  disconnect() {
    if (currentController === this) currentController = null
    this.removeKeydownListener()
    if (this.modal?.isVisible()) this.modal.hide()
    this.modal?.destroy()
    this.resolvePending(false)
  }

  confirm(options = {}) {
    const {
      title = "Confirmar ação",
      message = "",
      confirmText = "Confirmar",
      cancelText = "Cancelar",
      variant = "primary"
    } = options

    if (this.pendingResolve) return Promise.resolve(false)

    return new Promise((resolve) => {
      this.pendingResolve = resolve
      this.titleTarget.textContent = title
      this.messageTarget.textContent = message
      this.confirmButtonTarget.textContent = confirmText
      this.cancelButtonTarget.textContent = cancelText
      this.setVariant(variant)
      this.previouslyFocusedElement = document.activeElement
      this.modal.show()
      document.addEventListener("keydown", this.handleKeydown, true)
      this.confirmButtonTarget.focus()
    })
  }

  accept() {
    const resolve = this.takePendingResolve()
    this.modal.hide()
    if (resolve) resolve(true)
  }

  cancel() {
    const resolve = this.takePendingResolve()
    this.modal.hide()
    if (resolve) resolve(false)
  }

  resolvePending(value) {
    const resolve = this.takePendingResolve()
    if (resolve) resolve(value)
  }

  takePendingResolve() {
    const resolve = this.pendingResolve
    this.pendingResolve = null
    return resolve
  }

  handleHide() {
    this.removeKeydownListener()
    this.restoreFocus()
    this.resolvePending(false)
  }

  restoreFocus() {
    const element = this.previouslyFocusedElement
    this.previouslyFocusedElement = null
    if (element && element.isConnected && typeof element.focus === "function") {
      element.focus()
    }
  }

  focusableElements() {
    return Array.from(
      this.element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null)
  }

  removeKeydownListener() {
    document.removeEventListener("keydown", this.handleKeydown, true)
  }

  setVariant(variant) {
    const isDanger = variant === "danger"
    this.confirmButtonTarget.classList.toggle("bg-error", isDanger)
    this.confirmButtonTarget.classList.toggle("hover:bg-error", isDanger)
    this.confirmButtonTarget.classList.toggle("focus:ring-error/40", isDanger)
    this.confirmButtonTarget.classList.toggle("bg-primary", !isDanger)
    this.confirmButtonTarget.classList.toggle("hover:bg-primary-dark", !isDanger)
    this.confirmButtonTarget.classList.toggle("focus:ring-primary/40", !isDanger)
  }

  installTurboConfirm() {
    Turbo.config.forms.confirm = (message, _form, submitter) => {
      const controller = getConfirmModalController()
      if (!controller) return Promise.resolve(window.confirm(message))
      return controller.confirm({
        title: submitter?.dataset.confirmTitle,
        message,
        confirmText: submitter?.dataset.confirmAccept,
        cancelText: submitter?.dataset.confirmCancel,
        variant: submitter?.dataset.confirmVariant
      })
    }
  }
}
