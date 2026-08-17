import { Controller } from "@hotwired/stimulus"
import { Dismiss } from "flowbite"
import { focusableElements, trapFocus } from "../helpers/focus_trap"

export default class extends Controller {
  static targets = [
    "modal", "confirmButton", "confirmText", "confirmLoading",
    "deleteModal", "deleteConfirmInput", "deleteConfirmButton",
    "deleteError", "titleCheck", "chapterCheck", "categoryCheck"
  ]

  static values = {
    bookId: Number,
    bookTitle: String,
    publishable: Boolean,
    publishUrl: String,
    deleteUrl: String
  }

  connect() {
    this.previouslyFocusedElement = null
    this.boundKeydown = this.handleKeydown.bind(this)
  }

  disconnect() {
    document.removeEventListener("keydown", this.boundKeydown, true)
    if (document.body.style.overflow === "hidden") {
      document.body.style.overflow = ""
    }
  }

  handleKeydown(event) {
    if (!this.modalTarget.classList.contains("hidden")) {
      trapFocus(this.modalTarget, event)
    } else if (!this.deleteModalTarget.classList.contains("hidden")) {
      trapFocus(this.deleteModalTarget, event)
    }
  }

  async open() {
    const autoSaveCtrl = this.application.getControllerForElementAndIdentifier(
      this.element,
      "auto-save"
    )
    if (autoSaveCtrl) {
      await autoSaveCtrl.save({ flush: true })
    }

    const editorCtrl = this.application.getControllerForElementAndIdentifier(
      this.element,
      "editor"
    )
    const hasContent = editorCtrl?.editor?.getText()?.trim()?.length > 0
    const titleOk = this.titleCheckTarget.querySelector(".text-success") !== null
    const categoryOk = this.categoryCheckTarget.querySelector(".text-success") !== null

    if (hasContent) {
      this.chapterCheckTarget.innerHTML = `
        <span class="flex items-center justify-center w-5 h-5 rounded-full bg-success/10 text-success">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </span>
        <span class="text-text-primary">Pelo menos um capítulo com conteúdo</span>`
    } else {
      this.chapterCheckTarget.innerHTML = `
        <span class="flex items-center justify-center w-5 h-5 rounded-full bg-error/10 text-error">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </span>
        <span class="text-error">Adicione conteúdo aos capítulos</span>`
    }

    this.publishableValue = titleOk && categoryOk && hasContent
    this.confirmButtonTarget.disabled = !this.publishableValue

    this.previouslyFocusedElement = document.activeElement
    this.modalTarget.classList.remove("hidden")
    this.modalTarget.classList.add("flex")
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", this.boundKeydown, true)
    this.focusFirstFocusable(this.modalTarget)
  }

  close() {
    this.modalTarget.classList.add("hidden")
    this.modalTarget.classList.remove("flex")
    document.body.style.overflow = ""
    document.removeEventListener("keydown", this.boundKeydown, true)
    this.restoreFocus()
  }

  onModalClick(event) {
    event.stopPropagation()
  }

  onBackdropClick(event) {
    if (event.target === this.modalTarget) {
      this.close()
    }
  }

  async confirm() {
    if (!this.publishableValue) return

    const autoSaveCtrl = this.application.getControllerForElementAndIdentifier(
      this.element,
      "auto-save"
    )
    if (autoSaveCtrl) {
      await autoSaveCtrl.save({ flush: true })
    }

    this.setLoading(true)

    try {
      const response = await fetch(this.publishUrlValue, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken,
          "Accept": "application/json"
        }
      })

      if (response.ok) {
        this.close()
        window.location.reload()
      } else {
        const data = await response.json()
        this.showToast(data.error || "Erro ao publicar.", "error")
      }
    } catch (_error) {
      this.showToast("Erro de conexão. Tente novamente.", "error")
    } finally {
      this.setLoading(false)
    }
  }

  openDeleteModal() {
    this.close()
    this.previouslyFocusedElement = document.activeElement
    this.deleteModalTarget.classList.remove("hidden")
    this.deleteModalTarget.classList.add("flex")
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", this.boundKeydown, true)
    this.deleteConfirmInputTarget.focus()
  }

  closeDeleteModal() {
    this.deleteModalTarget.classList.add("hidden")
    this.deleteModalTarget.classList.remove("flex")
    document.body.style.overflow = ""
    document.removeEventListener("keydown", this.boundKeydown, true)
    this.deleteConfirmInputTarget.value = ""
    this.deleteErrorTarget.classList.add("hidden")
    this.deleteConfirmButtonTarget.disabled = true
    this.restoreFocus()
  }

  focusFirstFocusable(container) {
    const focusables = focusableElements(container)
    if (focusables.length > 0) {
      focusables[0].focus()
    }
  }

  restoreFocus() {
    const element = this.previouslyFocusedElement
    this.previouslyFocusedElement = null
    if (element && element.isConnected && typeof element.focus === "function") {
      element.focus()
    }
  }

  onDeleteModalClick(event) {
    event.stopPropagation()
  }

  onDeleteInput() {
    const typed = this.deleteConfirmInputTarget.value.trim()
    const matches = typed === this.bookTitleValue
    this.deleteConfirmButtonTarget.disabled = !matches
    this.deleteErrorTarget.classList.toggle("hidden", matches || typed.length === 0)
  }

  async confirmDelete() {
    this.deleteConfirmButtonTarget.disabled = true
    this.deleteConfirmButtonTarget.textContent = "Excluindo..."

    try {
      const response = await fetch(this.deleteUrlValue, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "X-CSRF-Token": this.csrfToken
        }
      })

      if (response.ok) {
        window.location.href = "/dashboard"
      } else {
        this.showToast("Erro ao excluir. Tente novamente.", "error")
        this.deleteConfirmButtonTarget.disabled = false
        this.deleteConfirmButtonTarget.textContent = "Excluir Permanentemente"
      }
    } catch (_error) {
      this.showToast("Erro de conexão. Tente novamente.", "error")
      this.deleteConfirmButtonTarget.disabled = false
      this.deleteConfirmButtonTarget.textContent = "Excluir Permanentemente"
    }
  }

  setLoading(loading) {
    this.confirmButtonTarget.disabled = loading
    this.confirmTextTarget.classList.toggle("hidden", loading)
    this.confirmLoadingTarget.classList.toggle("hidden", !loading)
  }

  showToast(message, type) {
    const existing = document.querySelector("[data-flash]")
    if (existing) existing.remove()

    const isError = type === "error"
    const iconClass = isError ? "text-fg-danger bg-danger-soft" : "text-fg-success bg-success-soft"
    const icon = isError
      ? '<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg>'
      : '<svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11.917 9.724 16.5 19 7.5"/></svg>'
    const id = `flash-toast-${Date.now()}`

    const toast = document.createElement("div")
    toast.setAttribute("data-flash", "")
    toast.id = id
    toast.setAttribute("role", isError ? "alert" : "status")
    if (!isError) toast.setAttribute("aria-live", "polite")
    toast.className = "fixed top-5 right-5 z-[60] flex items-center w-full max-w-sm p-4 text-body bg-neutral-primary-soft rounded-base shadow-xs border border-default transition-all duration-300"
    toast.innerHTML = `
      <div class="inline-flex items-center justify-center shrink-0 w-7 h-7 ${iconClass} rounded">
        ${icon}
        <span class="sr-only">${isError ? "Erro" : "Sucesso"}</span>
      </div>
      <div class="ms-3 text-sm font-normal"></div>
      <button type="button" class="ms-auto flex items-center justify-center text-body hover:text-heading bg-transparent box-border border border-transparent hover:bg-neutral-secondary-medium focus:ring-4 focus:ring-neutral-tertiary font-medium leading-5 rounded text-sm h-8 w-8 focus:outline-none" data-dismiss-target="#${id}" aria-label="Fechar notificação">
        <span class="sr-only">Fechar notificação</span>
        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 17.94 6M18 18 6.06 6"/></svg>
      </button>`
    toast.querySelector(".ms-3").textContent = message
    document.body.appendChild(toast)
    new Dismiss(toast, toast.querySelector("[data-dismiss-target]"))

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-x-full")
      setTimeout(() => toast.remove(), 300)
    }, 5000)
  }

  get csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content
  }
}
