import { Controller } from "@hotwired/stimulus"
import { getConfirmModalController } from "./confirm_modal_controller"

export default class extends Controller {
  static targets = ["list", "emptyState"]
  static values = {
    bookId: Number,
    activeChapterId: Number
  }

  connect() {
    this.draggedElement = null
  }

  async addChapter() {
    const position = this.listTarget.querySelectorAll("li[data-chapter-id]").length

    try {
      const response = await fetch(`/books/${this.bookIdValue}/chapters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken,
          "Accept": "application/json"
        },
        body: JSON.stringify({
          chapter: {
            title: `Capítulo ${position + 1}`,
            position: position
          }
        })
      })

      if (response.ok) {
        const chapter = await response.json()
        this.appendChapter(chapter)
        this.selectChapter(chapter.id)
      }
    } catch (error) {
      console.error("Erro ao criar capítulo:", error)
    }
  }

  appendChapter(chapter) {
    if (this.hasEmptyStateTarget) {
      this.emptyStateTarget.remove()
    }

    const li = this.createChapterElement(chapter)
    li.style.animation = "slideDown 0.2s ease-out"
    this.listTarget.appendChild(li)
  }

  createChapterElement(chapter) {
    const li = document.createElement("li")
    li.dataset.chapterId = chapter.id
    li.dataset.position = chapter.position
    li.draggable = true
    li.className = "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#C2A47E]/5 transition-colors group"

    li.innerHTML = `
      <span class="text-text-muted text-sm chapter-number">${chapter.position + 1}</span>
      <span class="flex-1 text-sm text-text-primary chapter-title truncate">${this.escapeHtml(chapter.title)}</span>
      <span class="text-xs text-text-muted chapter-word-count">${chapter.word_count || 0} pal.</span>
      <button class="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-opacity p-1" data-action="click->chapter-panel#deleteChapter" title="Excluir capítulo">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    `

    li.addEventListener("click", (e) => {
      if (e.target.closest("button")) return
      this.selectChapter(chapter.id)
    })

    li.addEventListener("dblclick", (e) => {
      e.preventDefault()
      this.startRename(li, chapter)
    })

    li.addEventListener("dragstart", (e) => this.handleDragStart(e, li))
    li.addEventListener("dragover", (e) => this.handleDragOver(e))
    li.addEventListener("drop", (e) => this.handleDrop(e, li))
    li.addEventListener("dragend", (e) => this.handleDragEnd(e))

    return li
  }

  selectChapter(chapterId) {
    this.activeChapterIdValue = chapterId

    this.listTarget.querySelectorAll("li").forEach((li) => {
      const id = parseInt(li.dataset.chapterId)
      if (id === chapterId) {
        li.classList.add("bg-[#C2A47E]/10", "border-l-3", "border-[#C2A47E]")
        li.classList.remove("hover:bg-[#C2A47E]/5")
      } else {
        li.classList.remove("bg-[#C2A47E]/10", "border-l-3", "border-[#C2A47E]")
        li.classList.add("hover:bg-[#C2A47E]/5")
      }
    })

    const event = new CustomEvent("chapter:selected", {
      detail: { chapterId: chapterId },
      bubbles: true
    })
    this.element.dispatchEvent(event)
  }

  startRename(li, chapter) {
    const titleSpan = li.querySelector(".chapter-title")
    const currentTitle = chapter.title

    const input = document.createElement("input")
    input.type = "text"
    input.value = currentTitle
    input.className = "flex-1 text-sm text-text-primary bg-bg-card border border-primary rounded px-1 py-0.5 focus:outline-none"

    titleSpan.replaceWith(input)
    input.focus()
    input.select()

    const finishRename = async () => {
      const newTitle = input.value.trim() || currentTitle

      try {
        const response = await fetch(`/books/${this.bookIdValue}/chapters/${chapter.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": this.csrfToken,
            "Accept": "application/json"
          },
          body: JSON.stringify({
            chapter: { title: newTitle }
          })
        })

        if (response.ok) {
          chapter.title = newTitle
        }
      } catch (error) {
        console.error("Erro ao renomear capítulo:", error)
      }

      const newTitleSpan = document.createElement("span")
      newTitleSpan.className = "flex-1 text-sm text-text-primary chapter-title truncate"
      newTitleSpan.textContent = newTitle
      input.replaceWith(newTitleSpan)
    }

    input.addEventListener("blur", finishRename)
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        input.blur()
      }
      if (e.key === "Escape") {
        input.value = currentTitle
        input.blur()
      }
    })
  }

  async deleteChapter(event) {
    event.stopPropagation()

    const li = event.target.closest("li")
    const chapterId = parseInt(li.dataset.chapterId)

    const confirmModal = getConfirmModalController()
    if (!confirmModal) {
      if (!window.confirm("Tem certeza que deseja excluir este capítulo?")) return
    } else {
      const confirmed = await confirmModal.confirm({
        title: "Excluir capítulo",
        message: "Tem certeza que deseja excluir este capítulo?",
        confirmText: "Excluir",
        cancelText: "Cancelar",
        variant: "danger"
      })
      if (!confirmed) return
    }

    try {
      const response = await fetch(`/books/${this.bookIdValue}/chapters/${chapterId}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": this.csrfToken,
          "Accept": "application/json"
        }
      })

      if (response.ok) {
        li.style.animation = "slideUp 0.2s ease-out forwards"
        setTimeout(() => {
          li.remove()
          this.reindexChapters()

          if (this.listTarget.children.length === 0) {
            this.showEmptyState()
          }

          if (this.activeChapterIdValue === chapterId) {
            const firstChapter = this.listTarget.querySelector("li")
            if (firstChapter) {
              this.selectChapter(parseInt(firstChapter.dataset.chapterId))
            }
          }
        }, 200)
      }
    } catch (error) {
      console.error("Erro ao excluir capítulo:", error)
    }
  }

  showEmptyState() {
    const empty = document.createElement("li")
    empty.className = "text-center py-8 text-text-muted text-sm"
    empty.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2 opacity-50"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
      <p>Nenhum capítulo ainda</p>
      <p class="text-xs mt-1">Clique em "+ Novo" para começar</p>
    `
    this.listTarget.appendChild(empty)
  }

  reindexChapters() {
    this.listTarget.querySelectorAll("li").forEach((li, index) => {
      const numberEl = li.querySelector(".chapter-number")
      if (numberEl) {
        numberEl.textContent = index + 1
      }
      li.dataset.position = index
    })
  }

  handleDragStart(event, li) {
    this.draggedElement = li
    li.classList.add("opacity-50")
    event.dataTransfer.effectAllowed = "move"
  }

  handleDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  async handleDrop(event, targetLi) {
    event.preventDefault()

    if (!this.draggedElement || this.draggedElement === targetLi) return

    const list = this.listTarget
    const items = Array.from(list.querySelectorAll("li"))
    const draggedIndex = items.indexOf(this.draggedElement)
    const targetIndex = items.indexOf(targetLi)

    if (draggedIndex < targetIndex) {
      targetLi.after(this.draggedElement)
    } else {
      targetLi.before(this.draggedElement)
    }

    this.reindexChapters()
    await this.saveNewOrder()
  }

  handleDragEnd(event) {
    if (this.draggedElement) {
      this.draggedElement.classList.remove("opacity-50")
      this.draggedElement = null
    }
  }

  async saveNewOrder() {
    const items = this.listTarget.querySelectorAll("li[data-chapter-id]")

    for (let i = 0; i < items.length; i++) {
      const li = items[i]
      const chapterId = parseInt(li.dataset.chapterId)
      const newPosition = i

      try {
        await fetch(`/books/${this.bookIdValue}/chapters/${chapterId}/reorder`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": this.csrfToken,
            "Accept": "application/json"
          },
          body: JSON.stringify({ position: newPosition })
        })
      } catch (error) {
        console.error("Erro ao reordenar capítulo:", error)
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  get csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ""
  }
}
