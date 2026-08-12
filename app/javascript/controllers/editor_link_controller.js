import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["popover", "input", "apply", "remove", "error", "linkButton"]

  connect() {
    this.boundOnKeydown = this.onKeydown.bind(this)
    this.boundOnLinkShortcut = this.onLinkShortcut.bind(this)
    document.addEventListener("keydown", this.boundOnKeydown)
    this.element.addEventListener("editor:linkShortcut", this.boundOnLinkShortcut)
  }

  disconnect() {
    document.removeEventListener("keydown", this.boundOnKeydown)
    this.element.removeEventListener("editor:linkShortcut", this.boundOnLinkShortcut)
  }

  getEditor() {
    return this.application.getControllerForElementAndIdentifier(this.element, "editor")?.editor
  }

  open() {
    const editor = this.getEditor()
    if (!editor) return

    const existingHref = editor.getAttributes("link").href || ""
    this.inputTarget.value = existingHref
    this.errorTarget.classList.add("hidden")
    this.removeTarget.classList.toggle("hidden", !editor.isActive("link"))
    this.applyTarget.textContent = existingHref ? "Atualizar" : "Adicionar"

    this.popoverTarget.classList.remove("hidden")
    this.popoverTarget.classList.add("flex")
    this.inputTarget.focus()
  }

  close() {
    this.popoverTarget.classList.add("hidden")
    this.popoverTarget.classList.remove("flex")
  }

  submit(event) {
    event.preventDefault()
    const editor = this.getEditor()
    if (!editor) return

    let url = this.inputTarget.value.trim()
    if (!url) {
      this.showError("Informe a URL do link.")
      return
    }

    if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("/") && !url.startsWith("#")) {
      url = `https://${url}`
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    this.close()
  }

  removeLink() {
    const editor = this.getEditor()
    if (editor) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    }
    this.close()
  }

  showError(message) {
    this.errorTarget.textContent = message
    this.errorTarget.classList.remove("hidden")
    this.inputTarget.focus()
  }

  onKeydown(event) {
    if (event.key === "Escape" && !this.popoverTarget.classList.contains("hidden")) {
      this.close()
      this.linkButtonTarget?.focus()
    }
  }

  onLinkShortcut() {
    this.open()
  }
}
