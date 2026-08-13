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

## Fase 3 — Estado e Persistência ✅

**Status:** Concluída e validada em 13/08/2026.

### Tarefas executadas

| #   | Tarefa                                                    | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Validação                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Limpar concern `ChapterWordCountConcern`                  | Reescrito: removida linha duplicada (`text =`/`plain_text =`), `before_save :recalculate_word_and_char_count_from_content, if: :content_changed?`, define `word_count` e `character_count`                                                                                                                                                                                                                                                                                                            | Runner: `<h1>Olá</h1><p>mundo <strong>legal</strong></p>` → `wc=3 cc=15`; `<p>dois palavras</p>` → `wc=2 cc=13`; `<script>` removido (`clean=SIM`)                                                                                                                                                         |
| 2   | Blocos contíguos contavam errado                          | **Correção pós-teste:** `full_sanitizer` concatena blocos sem separador (`<h1>Olá</h1><p>mundo` → "Olámundo", contando 2 palavras). Adicionado `BLOCK_TAG_PATTERN` que substitui tags de bloco (`p,div,h1-6,ul,ol,li,blockquote,pre,table,tr,td,br,hr`) por espaço antes do sanitize, espelhando o `getText()` do Tiptap (separador de bloco)                                                                                                                                                         | Runner: mesmo conteúdo agora `wc=3 cc=15` (antes `wc=2 cc=14`)                                                                                                                                                                                                                                           |
| 3   | Remover `:word_count` de `chapter_params`                 | `chapters_controller.rb` agora permite apenas `:title, :content` — backend é a fonte da verdade para contadores                                                                                                                                                                                                                                                                                                                                                                                       | Revisão de código; rubocop OK                                                                                                                                                                                                                                                                            |
| 4   | Criar helper JS centralizado de contagem                 | Novo `app/javascript/helpers/word_count.js` exportando `calculateWordCount(text)` e `calculateCharacterCount(text)` — elimina a lógica duplicada em `editor_controller`, `auto_save_controller` e `word_count_controller`                                                                                                                                                                                                                                                                              | `npm run build` OK; helper presente no bundle (`rg calculateWordCount/calculateCharacterCount` → 4/3 ocorrências)                                                                                                                                                                                        |
| 5   | `editor_controller.js` usa helper                         | Importa `calculateWordCount` de `../helpers/word_count`; usado em `dispatchContentChanged` e `getChapterData` (detail `{ wordCount, text }`)                                                                                                                                                                                                                                                                                                                                                           | Build JS OK                                                                                                                                                                                                                                                                                              |
| 6   | Reescrita do `auto_save_controller.js`                    | `editorController` obtido sincronamente em `connect()` via `application.getControllerForElementAndIdentifier(this.element, "editor")`; estado `saving`+`savePromise`; `save()` com loop de deduplicação (se saving, aguarda promise e reavalia; retorna `true` se `!dirty`; em falha agenda autosave); `performSave` PATCH JSON `{ chapter: { content } }` (sem `word_count`), 5xx/erro → `retrySave` com `backoffDelay = 1000 * 2 ** attempt` (max 3); `markCleanIfCurrent` só limpa dirty se conteúdo atual == salvo; `updateChapterId`; `saveViaBeacon` via `URLSearchParams` (`_method=patch`, `chapter[content]`, `authenticity_token`); `saveOnTurboVisit` aguarda `save()` e só navega com sucesso | Revisão de código + build JS OK                                                                                                                                                                                                                                                                          |
| 7   | `word_count_controller.js` usa helper e corrige acesso    | Reescrito: usa `calculateWordCount`/`calculateCharacterCount`; editor obtido de `this.element.editorController?.editor` (está no mesmo elemento, não em descendente — o antigo `querySelector("[data-controller*='editor']")` nunca achava e caía no frágil `updateFromDOM`); `updateFromDOM` removido; ouve `editor:contentChanged` e `editor:chapterChanged`; atualiza sidebar (`.chapter-word-count`) via `getActiveChapterElement`                                                                   | Build JS OK                                                                                                                                                                                                                                                                                              |
| 8   | `aria-live="polite"` no status de salvamento              | `write.html.erb`: `<span data-save-status aria-live="polite">` — leitores de tela anunciam mudanças de status de save                                                                                                                                                                                                                                                                                                                                                                                 | Revisão de HTML                                                                                                                                                                                                                                                                                          |
| 9   | Verificação de wiring dos controllers                     | `chapter_panel_controller.js` dispatcha `chapter:selected` → `editor_controller#loadChapter` salva capítulo atual (via `autoSaveCtrl.save()` + `updateChapterId`) e dispatcha `editor:chapterChanged` → `word_count_controller` atualiza. `editor_controller` já tinha `showSavingStatus`/`showSavedStatus`/`showErrorStatus` (linhas 216/225/239) usados pelo auto-save                                                                                                                               | Revisão de código                                                                                                                                                                                                                                                                                        |

### Notas técnicas

- **Contagem de caracteres:** `character_count` usa `plain_text.length` após `squeeze(" ")` (conta um único espaço entre palavras, ignora duplicados/whitespace de tags). Não é exibido na UI (frontend usa texto do editor ao vivo); é armazenado para persistência/uso futuro.
- **Fonte da verdade:** o cliente não envia mais `word_count`/`character_count` — ambos são recalculados no `Chapter` (`before_save`), refletindo em `Book#total_word_count`.
- **`editorController` no elemento:** como todos os controllers (`editor`, `word-count`, `auto-save`, etc.) ficam no mesmo elemento em `write.html.erb`, o acesso via `this.element.editorController` (setado em `editor_controller#connect`) é correto; o antigo `querySelector` buscava descendentes e nunca encontrava o próprio elemento.
- **Concern vs Tiptap:** `BLOCK_TAG_PATTERN` aproxima o comportamento do `getText()` do Tiptap (que insere `\n\n` entre blocos) ao inserir espaço entre tags de bloco antes de sanear.

### Ajustes pós-review (autosave)

O `save()` agora retorna um status (`"saved"` | `"terminal"` | `"retry"` | `"noop"`) em vez de boolean, e diferencia flush de background:

- **Deduplicação sem cascata (review #1):** no caminho não-flush (debounce), se o conteúdo mudou durante o save, o loop **não** re-salva imediatamente — agenda `scheduleAutoSave()` e retorna, respeitando o debounce de 30s. O loop só re-salva de imediato no modo `flush` (navegação/troca de capítulo/publicação), com teto de segurança de 3 iterações.
- **4xx tratado como terminal (review #2):** `performSave` retorna `"terminal"` para 4xx (sem retry/backoff e sem re-agendar autosave). `saveOnTurboVisit` navega em `"saved"` **ou** `"terminal"` (não prende o usuário com erro persistente), mas bloqueia em `"retry"` (5xx/rede esgotados — dados preservados, autosave re-agendado).
- **`editorController` lazy (review #4):** `auto_save_controller` agora resolve o controller do editor via getter `this.application.getControllerForElementAndIdentifier(...)` a cada acesso, eliminando a dependência da ordem de identificadores no `data-controller`. (O `word_count_controller` já lia dinamicamente.)
- **Callers atualizados:** `editor_controller#loadChapter` e `publish_controller` usam `save({ flush: true })` e checam `status !== "saved"`.

### Checklist de validação da Fase 3

- [x] Word count é recalculado no backend (runner: `wc=3` para "Olá mundo legal"; atualiza após edição e propaga ao `Book`)
- [x] Character count é persistido (`cc=15` / `cc=13`)
- [x] `<script>` não infla word count e é removido do conteúdo
- [x] `chapter_params` não aceita `:word_count`
- [x] Helper JS centralizado existe e é usado pelos 3 controllers
- [x] Autosave deduplica (loop `saving`/`savePromise`) e faz retry com backoff
- [x] Autosave não envia `word_count` no payload
- [x] Status de save tem `aria-live="polite"`
- [x] Troca de capítulo salva o capítulo atual antes de carregar o novo
- [x] Sem cascata de saves no caminho não-flush (debounce respeitado)
- [x] 4xx é terminal (sem retry/re-agendamento) e não prende a navegação

### Checks finais

- [x] `bin/rubocop` — 59 arquivos, nenhuma ofensa
- [x] `npm run build` — OK
- [x] `npm run build:css` — OK
- [x] Teste do concern via runner — OK (word_count, character_count, XSS, propagação ao Book)
- [x] `git status` revisado

---

## Próximas fases (não iniciadas)

| Fase   | Objetivo                                                                                 | Status   |
| ------ | ---------------------------------------------------------------------------------------- | -------- |
| Fase 4 | UX e Acessibilidade (`role="toolbar"`, `aria-pressed`, focus trap, partial da toolbar)   | Pendente |
| Fase 5 | Testes (Minitest/RSpec, model, request, system, JS)                                      | Pendente |
| Fase 6 | Polimento (reorder batch, código morto, CSP, documentação)                               | Pendente |
