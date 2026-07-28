import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["fileInput", "preview", "previewContainer", "placeholder", "error", "dropZone"]

  static values = {
    maxSize: { type: Number, default: 5242880 },
    accept: { type: Array, default: ["image/jpeg", "image/png", "image/webp"] }
  }

  connect() {
    this.fileInputTarget.addEventListener("change", this.boundFileChange)
  }

  disconnect() {
    this.fileInputTarget.removeEventListener("change", this.boundFileChange)
  }

  get boundFileChange() {
    if (!this._boundFileChange) {
      this._boundFileChange = this.onFileChange.bind(this)
    }
    return this._boundFileChange
  }

  openFilePicker(event) {
    event.preventDefault()
    event.stopPropagation()
    this.fileInputTarget.click()
  }

  onFileChange(event) {
    const file = event.target.files[0]
    if (file) {
      this.processFile(file)
    }
  }

  onDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    this.dropZoneTarget.classList.remove("drag-over")

    const files = event.dataTransfer.files
    if (files.length > 0) {
      this.processFile(files[0])
    }
  }

  onDragOver(event) {
    event.preventDefault()
    event.stopPropagation()
    this.dropZoneTarget.classList.add("drag-over")
  }

  onDragLeave(event) {
    event.preventDefault()
    event.stopPropagation()
    this.dropZoneTarget.classList.remove("drag-over")
  }

  processFile(file) {
    this.clearError()

    if (!this.acceptValue.includes(file.type)) {
      this.showError("Formato não suportado. Use JPG, PNG ou WebP.")
      return
    }

    if (file.size > this.maxSizeValue) {
      const maxMB = Math.round(this.maxSizeValue / 1048576)
      this.showError(`Arquivo muito grande. Máximo: ${maxMB}MB.`)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      this.showPreview(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  showPreview(src) {
    this.previewTarget.src = src
    this.previewContainerTarget.classList.remove("hidden")
    this.placeholderTarget.classList.add("hidden")
  }

  removeCover(event) {
    event.preventDefault()
    event.stopPropagation()
    this.previewTarget.src = ""
    this.previewContainerTarget.classList.add("hidden")
    this.placeholderTarget.classList.remove("hidden")
    this.fileInputTarget.value = ""

    const removeInput = this.element.querySelector('input[name="book[remove_cover]"]')
    if (removeInput) {
      removeInput.value = "1"
    }
  }

  showError(message) {
    this.errorTarget.textContent = message
    this.errorTarget.classList.remove("hidden")
  }

  clearError() {
    this.errorTarget.textContent = ""
    this.errorTarget.classList.add("hidden")
  }
}
