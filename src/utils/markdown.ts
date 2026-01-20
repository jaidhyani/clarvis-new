import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'

// Track loaded languages
const loadedLanguages = new Set<string>()

// Explicit dynamic imports - Vite can analyze these and create chunks
const languageLoaders: Record<string, () => Promise<{ default: unknown }>> = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  python: () => import('highlight.js/lib/languages/python'),
  bash: () => import('highlight.js/lib/languages/bash'),
  json: () => import('highlight.js/lib/languages/json'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  css: () => import('highlight.js/lib/languages/css'),
  scss: () => import('highlight.js/lib/languages/scss'),
  xml: () => import('highlight.js/lib/languages/xml'),
  sql: () => import('highlight.js/lib/languages/sql'),
  go: () => import('highlight.js/lib/languages/go'),
  rust: () => import('highlight.js/lib/languages/rust'),
  java: () => import('highlight.js/lib/languages/java'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  diff: () => import('highlight.js/lib/languages/diff'),
  plaintext: () => import('highlight.js/lib/languages/plaintext'),
  swift: () => import('highlight.js/lib/languages/swift'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  scala: () => import('highlight.js/lib/languages/scala'),
  php: () => import('highlight.js/lib/languages/php'),
  perl: () => import('highlight.js/lib/languages/perl'),
  r: () => import('highlight.js/lib/languages/r'),
  lua: () => import('highlight.js/lib/languages/lua'),
  haskell: () => import('highlight.js/lib/languages/haskell'),
  elixir: () => import('highlight.js/lib/languages/elixir'),
  erlang: () => import('highlight.js/lib/languages/erlang'),
  clojure: () => import('highlight.js/lib/languages/clojure'),
  lisp: () => import('highlight.js/lib/languages/lisp'),
  scheme: () => import('highlight.js/lib/languages/scheme'),
  ocaml: () => import('highlight.js/lib/languages/ocaml'),
  fsharp: () => import('highlight.js/lib/languages/fsharp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  objectivec: () => import('highlight.js/lib/languages/objectivec'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  nginx: () => import('highlight.js/lib/languages/nginx'),
  apache: () => import('highlight.js/lib/languages/apache'),
  makefile: () => import('highlight.js/lib/languages/makefile'),
  cmake: () => import('highlight.js/lib/languages/cmake'),
  gradle: () => import('highlight.js/lib/languages/gradle'),
  groovy: () => import('highlight.js/lib/languages/groovy'),
  ini: () => import('highlight.js/lib/languages/ini'),
  properties: () => import('highlight.js/lib/languages/properties'),
  graphql: () => import('highlight.js/lib/languages/graphql'),
  protobuf: () => import('highlight.js/lib/languages/protobuf'),
  thrift: () => import('highlight.js/lib/languages/thrift'),
  latex: () => import('highlight.js/lib/languages/latex'),
  matlab: () => import('highlight.js/lib/languages/matlab'),
  wasm: () => import('highlight.js/lib/languages/wasm'),
  nix: () => import('highlight.js/lib/languages/nix'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
  vbnet: () => import('highlight.js/lib/languages/vbnet'),
  dart: () => import('highlight.js/lib/languages/dart'),
  vim: () => import('highlight.js/lib/languages/vim'),
  http: () => import('highlight.js/lib/languages/http'),
}

// Aliases map to canonical names
const aliases: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  html: 'xml',
  htm: 'xml',
  xhtml: 'xml',
  svg: 'xml',
  rs: 'rust',
  golang: 'go',
  rb: 'ruby',
  pl: 'perl',
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  clj: 'clojure',
  ml: 'ocaml',
  fs: 'fsharp',
  cs: 'csharp',
  m: 'objectivec',
  mm: 'objectivec',
  objc: 'objectivec',
  make: 'makefile',
  tex: 'latex',
  ps1: 'powershell',
  psm1: 'powershell',
  txt: 'plaintext',
  text: 'plaintext',
  toml: 'ini',
}

function resolveLanguage(lang: string): string {
  const lower = lang.toLowerCase()
  return aliases[lower] ?? lower
}

async function loadLanguage(lang: string): Promise<boolean> {
  const resolved = resolveLanguage(lang)

  if (loadedLanguages.has(resolved)) return true

  const loader = languageLoaders[resolved]
  if (!loader) return false

  try {
    const module = await loader()
    hljs.registerLanguage(resolved, module.default as Parameters<typeof hljs.registerLanguage>[1])
    loadedLanguages.add(resolved)
    return true
  } catch {
    return false
  }
}

// Extract language names from markdown code fences
function extractLanguages(markdown: string): string[] {
  const fenceRegex = /```(\w+)/g
  const languages = new Set<string>()
  let match

  while ((match = fenceRegex.exec(markdown)) !== null) {
    const lang = match[1]
    if (lang) languages.add(resolveLanguage(lang))
  }

  return Array.from(languages)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Configure marked with custom renderer
marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      const language = lang ? resolveLanguage(lang) : ''

      let highlighted: string
      if (language && loadedLanguages.has(language)) {
        highlighted = hljs.highlight(text, { language }).value
      } else {
        highlighted = escapeHtml(text)
      }

      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
    }
  }
})

const renderCache = new Map<string, string>()
const MAX_CACHE_SIZE = 500

/** Renders markdown to HTML with caching and on-demand syntax highlighting */
export async function renderMarkdown(text: string | undefined | null): Promise<string> {
  if (!text) return ''

  const cached = renderCache.get(text)
  if (cached) return cached

  // Load languages found in the markdown
  const languages = extractLanguages(text)
  await Promise.all(languages.map(loadLanguage))

  const rendered = marked.parse(text) as string

  if (renderCache.size >= MAX_CACHE_SIZE) {
    const firstKey = renderCache.keys().next().value
    if (firstKey) renderCache.delete(firstKey)
  }
  renderCache.set(text, rendered)

  return rendered
}
