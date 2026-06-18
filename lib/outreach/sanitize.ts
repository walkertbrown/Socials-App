// sanitize.ts — deterministic cleanup applied to EVERY generated email
// (AI-written or template) before it's stored. The prompt forbids em/en dashes,
// but a model can still slip one in, so this is the guaranteed backstop.

// Replace em (—) and en (–) dashes. The common case is a dash used as an aside or
// clause break, e.g. "lived up to the memory — we look forward..." → we turn that
// into a real sentence break and capitalize the next letter. Any leftover dash
// becomes a comma. Plain hyphens (-) in words like "four-course" are left alone.
export function stripDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*([^\s])/g, (_m, c: string) => `. ${c.toUpperCase()}`)
    .replace(/[—–]/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}
