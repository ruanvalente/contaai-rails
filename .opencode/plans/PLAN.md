# PLAN — Execução do EDITOR-REFACTOR-PLAN

> Registro de execução por fases do plano técnico [EDITOR-REFACTOR-PLAN.md](./EDITOR-REFACTOR-PLAN.md).
>
> Cada fase só é marcada como concluída após execução + validação.

---

## Fase 1 — Correções Críticas (Prioridade Máxima) ✅

**Status:** Concluída e validada em 11/08/2026.

### Tarefas executadas

| #   | Tarefa                                                                  | Resultado                                                                                                                                                                                                                             | Validação                                                                                                           |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Importar `@tiptap/extension-underline` e configurar                     | `@tiptap/extension-underline@3.29.0` instalado (npm) e adicionado às extensions do `editor_controller.js`                                                                                                                             | Build `npm run build` OK                                                                                            |
| 2   | Escapar `data-editor-content-value` e `data-editor-chapter-title-value` | **Revertido.** O ERB `<%= %>` já escapa por padrão; a tentativa inicial com `CGI.escapeHTML` gerou double-escape e foi desfeita. O `write.html.erb` permanece com `<%= %>` (escape único correto)                                     | Teste de integração: roundtrip do atributo == conteúdo do DB, sem double-escape no raw                              |
| 3   | Corrigir `simple_format` na página de leitura                           | `read.html.erb` usa `sanitize(@book.content, tags: ContentSanitizer::ALLOWED_TAGS, attributes: ContentSanitizer::ALLOWED_ATTRIBUTES)` + `prose prose-lg`                                                                              | `READ_PROSE: true`, `READ_XSS_RAW: false`                                                                           |
| 4   | Corrigir `publish` para gerar HTML válido                               | `books_controller.rb#publish` gera `"<h2>#{CGI.escapeHTML(chapter.title)}</h2>\n\n#{chapter.content}"` (sem markdown `##`)                                                                                                            | Verificado que o conteúdo final não contém `## `                                                                    |
| 5   | Instalar `@tailwindcss/typography` e configurar                         | `@tailwindcss/typography@^0.5.20` instalado; `@plugin "@tailwindcss/typography";` em `application.tailwind.css`                                                                                                                       | Build `npm run build:css` OK (typography carregado)                                                                 |
| 6   | Adicionar sanitização no backend                                        | Novo concern `app/models/concerns/content_sanitizer.rb` com `ALLOWED_TAGS`/`ALLOWED_ATTRIBUTES` e `ContentSanitizer.sanitize` (fonte única); incluído em `Chapter` e `Book`; `before_save :sanitize_content`                          | Script runner: `<script>` removido, `href="javascript:"` removido, `<img>` removido, `<h2>`/`<p>`/`<u>` preservados |
| 7   | Corrigir `saveOnBeforeUnload` (remover `preventDefault`)                | `saveOnBeforeUnload` só chama `saveViaBeacon()` quando dirty, sem `preventDefault`                                                                                                                                                    | Revisão de código                                                                                                   |
| 8   | Corrigir `saveOnTurboVisit` (aguardar save)                             | Interrompe navegação quando dirty, chama `save()` e retoma com `Turbo.visit(url, { action })` via `pendingNavigation`. **Pós-review:** só navega quando `save()` retorna sucesso; em falha restaura `dirty = true` (permitindo retry) | Review de código + correção de bug                                                                                  |
| 9   | Verificar ownership em `chapters#index` e `chapters#show`               | `chapters_controller.rb` reescrito com `before_action :authorize_book_owner!` no controller inteiro                                                                                                                                   | Revisão de código                                                                                                   |
| 10  | Verificar retorno de `update` em `books#publish` e `books#unpublish`    | Respondem erro (`:unprocessable_entity`/alert) quando `update` falha                                                                                                                                                                  | Revisão de código                                                                                                   |

### Notas técnicas

- **Achado importante (item 2):** o ERB do Rails `<%= %>` já HTML-escapa a saída. O código original de `write.html.erb` já era seguro; a mudança inicial com `CGI.escapeHTML` introduziu double-escaping (o valor chegaria ao editor como texto literal). O double-escape foi confirmado isoladamente com `ApplicationController.render(inline:)` e a mudança revertida. A validação final (roundtrip) confirma escape único correto.
- **Dados legados:** livros publicados antes desta fase têm `books.content` em markdown (`## Capítulo`) misturado com HTML. Os novos publishes geram HTML válido. Migração de dados legados não faz parte desta fase.
- **Validação de views:** realizada via teste de integração (`ActionDispatch::IntegrationTest`) executado por `bin/rails runner` no ambiente dev. O 403 inicial era `HostAuthorization` bloqueando `www.example.com` (host padrão de teste) — corrigido com `host! "localhost:3000"`.

### Checklist de validação da Fase 1

- [x] Clicar em "U" aplica sublinhado (extensão configurada; build OK)
- [x] Conteúdo com aspas carrega corretamente no editor (roundtrip confirmado)
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

## Fase 2 — Funcionalidades do Editor ✅

**Status:** Concluída e validada em 12/08/2026.

### Tarefas executadas

| #   | Tarefa                                            | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Validação                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Adicionar `Placeholder` extension                 | `@tiptap/extension-placeholder@3.29.0` já presente (dependência transitiva do StarterKit); importado e configurado no `editor_controller.js` com `Placeholder.configure` usando placeholder "Comece a escrever sua história...", `emptyEditorClass: "is-editor-empty"` e `emptyNodeClass: "is-empty"`                                                                                                                                                                                                            | CSS em `application.tailwind.css` usa `.ProseMirror p.is-editor-empty:first-child::before` e `.ProseMirror p.is-empty::before` com `content: attr(data-placeholder)` — compatível com a implementação v3 (verificado no `@tiptap/extensions/dist/index.js` linhas 220-247 e 559-560) |
| 2   | Adicionar botão "Parágrafo"                       | Botão `¶` na toolbar com `data-action="click->editor#paragraph"`, `data-editor-tool="paragraph"`, `aria-pressed`; método `paragraph()` chama `this.editor.chain().focus().setParagraph().run()`; atalho `Ctrl+Alt+0`                                                                                                                                                                                                                                                                                             | Build JS OK                                                                                                                                                                                                                                                                          |
| 3   | Adicionar botão "Tachado"                         | Botão com `<span class="line-through">S</span>` na toolbar com `data-action="click->editor#strike"`, `data-editor-tool="strike"`, `aria-pressed`; método `strike()` chama `this.editor.chain().focus().toggleStrike().run()`                                                                                                                                                                                                                                                                                     | Build JS OK                                                                                                                                                                                                                                                                          |
| 4   | Adicionar suporte a links (extensão + modal)      | `@tiptap/extension-link` já incluído no StarterKit v3 (configurado com `openOnClick: false`, `autolink: true`, `defaultProtocol: "https"`, `rel: "noopener noreferrer nofollow"`, `target: "_blank"`); novo controller `editor_link_controller.js` com popover de URL (abrir/editar/remover link, validação de URL, Escape para fechar); botão com ícone de link `data-action="click->editor-link#open"`; atalho `Mod-k` dispara evento `editor:linkShortcut`; `editor_link_controller` registrado no `index.js` | Build JS OK; popover com `role="dialog"` e `aria-label="Editar link"`                                                                                                                                                                                                                |
| 5   | Adicionar botão "Code Block"                      | Botão com ícone `</>` na toolbar com `data-action="click->editor#codeBlock"`, `data-editor-tool="codeBlock"`, `aria-pressed`; método `codeBlock()` chama `this.editor.chain().focus().toggleCodeBlock().run()` (extensão CodeBlock já presente no StarterKit)                                                                                                                                                                                                                                                    | Build JS OK                                                                                                                                                                                                                                                                          |
| 6   | Adicionar atalhos de teclado customizados         | Nova extensão `EditorShortcuts` (`Extension.create`) com `Mod-Shift-u` para `toggleUnderline` e `Mod-k` para dispatch de `editor:linkShortcut`; registrada nas extensions do editor                                                                                                                                                                                                                                                                                                                              | Build JS OK                                                                                                                                                                                                                                                                          |
| 7   | Adicionar `onSelectionUpdate` para estado ativo   | Handler no `Editor` que chama `this.updateToolbarState()`; `updateToolbarState` itera `[data-editor-tool]` e usa `isToolActive(tool)` com `this.editor.isActive(...)` para setar `aria-pressed` e classe `is-active`                                                                                                                                                                                                                                                                                             | `.editor-toolbar button.is-active` estilizado no CSS                                                                                                                                                                                                                                 |
| 8   | Adicionar `onTransaction` para undo/redo disabled | Handler que chama `this.updateToolbarState()` quando `transaction.docChanged` ou `transaction.selectionSet`; `updateToolbarState` itera `[data-editor-history]` e usa `this.editor.can()` com `undo()`/`redo()` para setar `disabled`                                                                                                                                                                                                                                                                            | `.editor-toolbar button:disabled` estilizado no CSS                                                                                                                                                                                                                                  |

### Melhoria adicional (pós-revisão)

| #   | Tarefa                                      | Resultado                                                                                                                                                                                                                                                                                                                        | Validação   |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 9   | Sincronizar `contentValue` no `loadChapter` | `editor_controller.js#loadChapter` agora seta `this.contentValue = chapter.content` (com fallback para string vazia) antes de `this.editor.commands.setContent(...)` — corrige o problema #7 da auditoria ("contentValue não é atualizado após loadChapter; se o controller reconectar (Turbo), o conteúdo antigo é restaurado") | Build JS OK |

### Notas técnicas

- **StarterKit v3 inclui `Link` e `Underline`:** verificado no `node_modules/@tiptap/starter-kit/package.json` (dependências `@tiptap/extension-link` e `@tiptap/extension-underline`) e no `dist/index.d.ts` (opções `link` e `underline`). Isso elimina a necessidade de importar essas extensões separadamente.
- **Placeholder v3 compatível com CSS:** a implementação do Placeholder em `@tiptap/extensions/dist/index.js` (linhas 220-247) usa `Decoration.node` com atributo `data-placeholder` e classes `is-editor-empty`/`is-empty` (defaults nas linhas 559-560). O CSS existente em `application.tailwind.css` já usa `content: attr(data-placeholder)`, portanto é compatível.
- **Auto-formatação do editor:** ao salvar `editor_controller.js`, o editor aplicou formatação (semicolons, aspas duplas, quebras de linha). O arquivo está consistente com o estilo do projeto.

### Checklist de validação da Fase 2

- [x] Placeholder aparece em editor vazio (extensão configurada; CSS compatível com v3)
- [x] Botão "Parágrafo" volta para texto normal (`setParagraph`)
- [x] Tachado funciona (`toggleStrike`)
- [x] Links podem ser adicionados e editados (`editor_link_controller.js` + popover + `Mod-k`)
- [x] Code block funciona (`toggleCodeBlock`)
- [x] Atalhos de teclado funcionam (`Mod-Shift-u` para sublinhado, `Mod-k` para link)
- [x] Botões mostram estado ativo (`onSelectionUpdate` + `updateToolbarState`)
- [x] Undo/redo têm disabled states (`onTransaction` + `editor.can()`)

### Checks finais

- [x] `bin/rubocop` — 57 arquivos, nenhuma ofensa
- [x] `npm run build` — OK
- [x] `npm run build:css` — OK
- [x] `git status` revisado (6 arquivos modificados + 1 novo: `editor_link_controller.js`)

---

## Próximas fases (não iniciadas)

| Fase   | Objetivo                                                                                 | Status   |
| ------ | ---------------------------------------------------------------------------------------- | -------- |
| Fase 3 | Estado e Persistência (word_count no backend, deduplicação autosave, retry, `aria-live`) | Pendente |
| Fase 4 | UX e Acessibilidade (`role="toolbar"`, `aria-pressed`, focus trap, partial da toolbar)   | Pendente |
| Fase 5 | Testes (Minitest/RSpec, model, request, system, JS)                                      | Pendente |
| Fase 6 | Polimento (reorder batch, código morto, CSP, documentação)                               | Pendente |
