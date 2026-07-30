import { Controller } from "@hotwired/stimulus"

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

  async open() {
    const autoSaveCtrl = this.application.getControllerForElementAndIdentifier(
      this.element,
      "auto-save"
    )
    if (autoSaveCtrl) {
      await autoSaveCtrl.save()
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

    this.modalTarget.classList.remove("hidden")
    this.modalTarget.classList.add("flex")
    document.body.style.overflow = "hidden"
  }

  close() {
    this.modalTarget.classList.add("hidden")
    this.modalTarget.classList.remove("flex")
    document.body.style.overflow = ""
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
      await autoSaveCtrl.save()
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
    this.deleteModalTarget.classList.remove("hidden")
    this.deleteModalTarget.classList.add("flex")
    document.body.style.overflow = "hidden"
    this.deleteConfirmInputTarget.focus()
  }

  closeDeleteModal() {
    this.deleteModalTarget.classList.add("hidden")
    this.deleteModalTarget.classList.remove("flex")
    document.body.style.overflow = ""
    this.deleteConfirmInputTarget.value = ""
    this.deleteErrorTarget.classList.add("hidden")
    this.deleteConfirmButtonTarget.disabled = true
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

    const bgClass = type === "error" ? "bg-error/10 border-error/30 text-error" : "bg-success/10 border-success/30 text-success"
    const icon = type === "error"
      ? '<svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>'
      : '<svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>'

    const toast = document.createElement("div")
    toast.setAttribute("data-flash", "")
    toast.className = `fixed top-4 right-4 z-[60] ${bgClass} border px-4 py-3 rounded-lg shadow-lg max-w-md transition-all duration-300 translate-x-0 opacity-100`
    toast.innerHTML = `<div class="flex items-center gap-2">${icon}<span>${message}</span></div>`
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-x-full")
      setTimeout(() => toast.remove(), 300)
    }, 5000)
  }

  get csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content
  }
}
