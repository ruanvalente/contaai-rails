function isVisible(el) {
  if (el.getClientRects().length === 0) return false
  const style = window.getComputedStyle(el)
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0"
}

export function focusableElements(root) {
  return Array.from(
    root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(isVisible)
}

export function trapFocus(root, event) {
  if (event.key !== "Tab") return

  const focusables = focusableElements(root)
  if (focusables.length === 0) return

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const activeElement = document.activeElement

  if (!root.contains(activeElement)) {
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
