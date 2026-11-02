/**
 * Mermaid renderer registration.
 *
 * Port from: dsh-client/src/mermaid.ts
 * Lazily injects <script> from /threadharbor/mermaid.js on first encounter,
 * then renders Mermaid code blocks in the conversation DOM.
 */

const MERMAID_ROUTE = '/threadharbor/mermaid.js'
let loaded: Promise<void> | null = null

function loadMermaid(): Promise<void> {
  if (loaded !== null) return loaded
  loaded = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = MERMAID_ROUTE
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load mermaid runtime'))
    document.head.appendChild(script)
  })
  return loaded
}

export function registerMermaid(): () => void {
  // Port full implementation from dsh-client/src/mermaid.ts
  // Strategy: MutationObserver on conversation container, intercept
  // <code class="language-mermaid"> blocks, render on demand.
  loadMermaid().catch(() => {
    // Silently degrade — mermaid is optional
  })
  return () => { /* cleanup observer */ }
}
