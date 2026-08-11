# PLAN — Execução do EDITOR-REFACTOR-PLAN

> Registro de execução por fases do plano técnico [EDITOR-REFACTOR-PLAN.md](./EDITOR-REFACTOR-PLAN.md).
>
> Cada fase só é marcada como concluída após execução + validação.

---

## Fase 1 — Correções Críticas (Prioridade Máxima) ✅

**Status:** Concluída e validada em 11/08/2026.

### Tarefas executadas

| # | Tarefa | Resultado | Validação |
| --- | --- | --- | --- |
| 1 | Importar `@tiptap/extension-underline` e configurar | `@tiptap/extension-underline@3.29.0` instalado (npm) e adicionado às extensions do `editor_controller.js` | Build `npm run build` OK |
| 2 | Escapar `data-editor-content-value` e `data-editor-chapter-title-value` | **Revertido.** O ERB `<%= %>` já escapa por padrão; a tentativa inicial com `CGI.escapeHTML` gerou double-escape (`&amp;lt;`) e foi desfeita. O `write.html.erb` permanece com `<%= %>` (escape único correto) | Teste de integração: roundtrip do atributo == conteúdo do DB (`WRITE_ATTR_ROUNDTRIP: true`), sem `&amp;lt;` no raw |
| 3 | Corrigir `simple_format` na página de leitura | `read.html.erb` usa `sanitize(@book.content, tags: ContentSanitizer::ALLOWED_TAGS, attributes: ContentSanitizer::ALLOWED_ATTRIBUTES)` + `prose prose-lg` | `READ_PROSE: true`, `READ_XSS_RAW: false` |
| 4 | Corrigir `publish` para gerar HTML válido | `books_controller.rb#publish` gera `"<h2>#{CGI.escapeHTML(chapter.title)}</h2>\n\n#{chapter.content}"` (sem markdown `##`) | Verificado que o conteúdo final não contém `## ` |
| 5 | Instalar `@tailwindcss/typography` e configurar | `@tailwindcss/typography@^0.5.20` instalado; `@plugin "@tailwindcss/typography";` em `application.tailwind.css` | Build `npm run build:css` OK (typography carregado) |
| 6 | Adicionar sanitização no backend | Novo concern `app/models/concerns/content_sanitizer.rb` com `ALLOWED_TAGS`/`ALLOWED_ATTRIBUTES` e `ContentSanitizer.sanitize` (fonte única — delegador `class_methods` redundante removido pós-review); incluído em `Chapter` e `Book`; `before_save :sanitize_content` | Script runner: `<script>` removido, `href="javascript:"` removido, `<img>` removido, `<h2>`/`<p>`/`<u>` preservados |
| 7 | Corrigir `saveOnBeforeUnload` (remover `preventDefault`) | `saveOnBeforeUnload` só chama `saveViaBeacon()` quando dirty, sem `preventDefault` | Revisão de código |
| 8 | Corrigir `saveOnTurboVisit` (aguardar save) | Interrompe navegação quando dirty, chama `save()` e retoma com `Turbo.visit(url, { action })` via `pendingNavigation`. **Pós-review:** só navega quando `save()` retorna `true`; em falha restaura `dirty = true` (permitindo retry) | Review de código + correção de bug |
| 9 | Verificar ownership em `chapters#index` e `chapters#show` | `chapters_controller.rb` reescrito com `before_action :authorize_book_owner!` no controller inteiro | Revisão de código |
| 10 | Verificar retorno de `update` em `books#publish` e `books#unpublish` | Respondem erro (`:unprocessable_entity`/alert) quando `update` falha | Revisão de código |

### Notas técnicas

- **Achado importante (item 2):** o ERB do Rails `<%= %>` já HTML-escapa a saída. O código original de `write.html.erb` já era seguro; a mudança inicial com `CGI.escapeHTML` introduziu double-escaping (o valor chegaria ao editor como texto literal `&lt;h1&gt;`). O double-escape foi confirmado isoladamente com `ApplicationController.render(inline:)` e a mudança revertida. A validação final (roundtrip) confirma escape único correto.
- **Dados legados:** livros publicados antes desta fase têm `books.content` em markdown (`## Capítulo`) misturado com HTML. Os novos publishes geram HTML válido. Migração de dados legados não faz parte desta fase.
- **Validação de views:** realizada via teste de integração (`ActionDispatch::IntegrationTest`) executado por `bin/rails runner` no ambiente dev. O 403 inicial era `HostAuthorization` bloqueando `www.example.com` (host padrão de teste) — corrigido com `host! "localhost:3000"`.

### Checklist de validação da Fase 1

- [x] Clicar em "U" aplica sublinhado (extensão configurada; build OK)
- [x] Conteúdo com aspas carrega corretamente no editor (`WRITE_ATTR_ROUNDTRIP: true`)
- [x] Página de leitura mostra formatação correta (`prose prose-lg`, sanitize ativo)
- [x] Publicação gera HTML válido (sem `## `, com `<h2>`)
- [x] `<script>` é removido do conteúdo (sanitização confirmada)
- [x] Navegação não mostra diálogo do browser (`preventDefault` removido)

### Checks finais

- [x] `bin/rubocop` — 57 arquivos, nenhuma ofensa
- [x] `npm run build` — OK
- [x] `npm run build:css` — OK
- [x] `git status` revisado (9 arquivos modificados + 2 novos, sem secrets)

---

## Próximas fases (não iniciadas)

| Fase | Objetivo | Status |
| --- | --- | --- |
| Fase 2 | Funcionalidades do Editor (placeholder, parágrafo, tachado, links, code block, atalhos, estado ativo, undo/redo) | Pendente |
| Fase 3 | Estado e Persistência (word_count no backend, deduplicação autosave, retry, `aria-live`) | Pendente |
| Fase 4 | UX e Acessibilidade (`role="toolbar"`, `aria-pressed`, focus trap, partial da toolbar) | Pendente |
| Fase 5 | Testes (Minitest/RSpec, model, request, system, JS) | Pendente |
| Fase 6 | Polimento (reorder batch, código morto, CSP, documentação) | Pendente |
