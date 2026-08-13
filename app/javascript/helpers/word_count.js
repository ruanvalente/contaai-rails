export function calculateWordCount(text) {
  const normalized = (text || "").trim()
  return normalized ? normalized.split(/\s+/).length : 0
}

export function calculateCharacterCount(text) {
  return (text || "").length
}
