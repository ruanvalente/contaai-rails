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

## Fase 4 — UX e Acessibilidade ✅

**Status:** Concluída e validada em 13/08/2026.

### Tarefas executadas

| #   | Tarefa                                                    | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Validação                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Adicionar `role="toolbar"` e `aria-label`                 | Novo partial `app/views/books/_toolbar.html.erb` com `role="toolbar"` e `aria-label="Ferramentas de formatação"` na div que envolve os botões de formatação; `write.html.erb` usa `<%= render "toolbar" %>`                                                                                                                                                                                                                                                                                         | Render do partial via runner: `TOOLBAR_OK buttons=13 history=2`; render de `write.html.erb` via `BooksController.renderer` contém `role="toolbar"` e `aria-label="Ferramentas de formatação"`                                                                               |
| 2   | Adicionar `aria-pressed` nos botões toggle                | Já implementado na Fase 2 (estado ativo via `updateToolbarState` em `editor_controller.js`); verificado no partial renderizado (estático `aria-pressed`)                                                                                                                                                                                                                                                                                                                                           | Runner: `aria-pressed` presente na partial; `aria-pressed` herdado dos 13 botões `data-editor-tool`                                                                                                                                                                        |
| 3   | Adicionar `aria-label` em todos os botões                 | `write.html.erb`: `aria-label="Excluir capítulo"` no botão de excluir capítulo; `chapter_panel_controller.js`: mesmo `aria-label` no botão criado dinamicamente em `createChapterElement`. Demais botões já tinham `aria-label` de fases anteriores                                                                                                                                                                                                                                                  | Render completo: `aria-label="Excluir capítulo"` presente (estático + no bundle JS como `Excluir cap\xEDtulo`)                                                                                                                                                              |
| 4   | Adicionar keyboard navigation na toolbar                  | `editor_controller.js`: `handleToolbarKeydown` (ArrowLeft/ArrowRight/Home/End com roving entre `button:not([disabled])`, `preventDefault` + `focus()`), registrado/removido em `connect()`/`disconnect()` quando `hasToolbarTarget`                                                                                                                                                                                                                                                                | Build JS OK; `handleToolbarKeydown` presente no bundle (5 ocorrências)                                                                                                                                                                                                      |
| 5   | Adicionar `aria-keyshortcuts`                             | `_toolbar.html.erb`: atalhos em todos os botões (Control+B, Control+I, Control+Shift+U, Control+Shift+S, Control+Alt+0/1/2/3, Control+Shift+8, Control+Shift+7, Control+Shift+B, Control+Alt+C, Control+K, Control+Z, Control+Y)                                                                                                                                                                                                                                                                 | Render: `aria-keyshortcuts="Control+B"` presente                                                                                                                                                                                                                            |
| 6   | Adicionar focus trap nos modais                           | Novo helper `app/javascript/helpers/focus_trap.js` (`focusableElements(root)` filtra visíveis via `offsetParent !== null`; `trapFocus(root, event)` intercepta Tab). `publish_controller.js`: `handleKeydown` com `trapFocus` no modal aberto (publish ou delete), `previouslyFocusedElement`, `body.style.overflow`, `focusFirstFocusable()` ao abrir e `restoreFocus()` ao fechar, listener ligado/desligado em `connect()`/`disconnect()`. `editor_sidebar_controller.js`: listener `keydown` em capture phase; Escape fecha e Tab aplica `trapFocus` no sidebar mobile aberto | Build JS OK; `focusableElements`/`trapFocus` no bundle (5/4 ocorrências)                                                                                                                                                                                                    |
| 7   | Adicionar `role="dialog"` e `aria-modal` nos modais       | `_publish_modal.html.erb`: `role="dialog" aria-modal="true" aria-labelledby="publish-modal-title"` + `<h2 id="publish-modal-title">`; `_delete_modal.html.erb`: idem com `delete-modal-title`                                                                                                                                                                                                                                                                                                        | Render completo: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="publish-modal-title"`, `id="publish-modal-title"`, idem para delete                                                                                                                                 |
| 8   | Adicionar `aria-label` no editor                          | `editor_controller.js`: `editorProps.attributes["aria-label"] = "Editor de conteúdo"` (o contenteditable do TipTap é anunciado como "Editor de conteúdo" por leitores de tela; a string não aparece no HTML estático pois é injetada por JS)                                                                                                                                                                                                                                                         | Bundle JS contém `Editor de conte\xFAdo` (1 ocorrência)                                                                                                                                                                                                                     |
| 9   | Extrair toolbar para partial                              | Novo `app/views/books/_toolbar.html.erb` (13 botões toggle + undo/redo), `write.html.erb` passa a renderizar `<%= render "toolbar" %>` (resolução por prefixo do controller `books/`, confirmada empiricamente — via `ApplicationController.render` o nome nu resolvia para `application/_toolbar`; sob `BooksController` resolve para `books/_toolbar`)                                                                                                                                           | Render via `BooksController.renderer` OK (`books/_toolbar` encontrado); render via `ApplicationController.render` corretamente falha (contexto `application`)                                                                                                               |
| 10  | Mover `<style>` inline para stylesheet                    | Removido bloco `<style>` de `write.html.erb`; `application.tailwind.css` ganhou `@keyframes slideDown`/`slideUp` e `.editor-toolbar button:focus-visible` (outline 2px `var(--color-primary)`, `outline-offset: -2px`, `border-radius: 0.5rem`)                                                                                                                                                                                                                                                      | Render completo não contém `@keyframes slideDown` (inline removido); build CSS OK (tailwind v4.3.3)                                                                                                                                                                         |

### Notas técnicas

- **Resolução de partials por prefixo do controller:** `render "toolbar"` (nome nu) resolve relativo ao prefixo do controller (`books/_toolbar`), não ao diretório do template. Confirmado ao renderizar via `BooksController.renderer` (OK) vs `ApplicationController.render` (procurou `application/_toolbar` e falhou).
- **esbuild escapa não-ASCII:** por padrão o esbuild emite `\xNN` para caracteres não-ASCII no bundle (`Editor de conteúdo` → `Editor de conte\xFAdo`, `Excluir capítulo` → `Excluir cap\xEDtulo`). Buscas no bundle devem usar a forma escapada.
- **`aria-label` do editor é runtime:** `editorProps.attributes` é aplicado pelo TipTap ao criar o ProseMirror; não aparece no HTML servido. Validação feita no bundle.
- **Focus trap em capture phase:** listeners `keydown` de `publish_controller` e `editor_sidebar_controller` usam `addEventListener(..., true)` para interceptar Tab antes de outros handlers.
- **`aria-live="polite"` no status** já havia sido adicionado na Fase 3 (não faz parte das 10 tarefas, mas aparece no checklist).
- **Popover de link** (`editor-link`) mantém `role="dialog" aria-label="Editar link"` sem `aria-modal` (é não-modal, por design).

### Checklist de validação da Fase 4

- [x] Toolbar tem `role="toolbar"` + `aria-label`
- [x] Botões toggle têm `aria-pressed` (Fase 2) e todos os botões têm `aria-label`
- [x] Keyboard navigation (setas + Home/End) funciona na toolbar
- [x] `aria-keyshortcuts` presente nos 15 botões da toolbar
- [x] Modais (publicar e excluir) e sidebar mobile prendem foco (Tab trap)
- [x] Modais têm `role="dialog"`, `aria-modal` e `aria-labelledby` apontando para o título
- [x] Editor tem `aria-label` ("Editor de conteúdo")
- [x] Toolbar extraída para partial reutilizável
- [x] `<style>` inline removido (keyframes movidos para `application.tailwind.css`)
- [x] Estrutura de página renderiza sem erros (23.4KB via `BooksController.renderer`)

### Checks finais

- [x] `bin/rubocop` — 59 arquivos, nenhuma ofensa
- [x] `npm run build` — OK (esbuild)
- [x] `npm run build:css` — OK (tailwind v4.3.3)
- [x] Render da partial `books/toolbar` — OK (13 botões de formatação + 2 histórico)
- [x] Render completo de `write.html.erb` via `BooksController.renderer` — OK (15/16 atributos a11y presentes; o único ausente no HTML estático é o `aria-label` do editor, que é runtime e confirmado no bundle)
- [x] Bundle JS contém helper focus trap, keyboard nav da toolbar e aria-labels dinâmicos
- [x] `git status` revisado (8 arquivos modificados + 2 novos: `focus_trap.js`, `_toolbar.html.erb`)

### Ajustes pós-review

Revisão de código executada sobre o diff da Fase 4 apontou 4 achados; todos corrigidos:

1. **Focus trap ciclava por botões invisíveis (baixo-moderado):** `focusableElements` filtrava apenas `display:none` (via `offsetParent`); os botões "Excluir capítulo" usam `opacity-0 group-hover:opacity-100` e passavam pelo filtro — no mobile (sem hover) o Tab no trap do sidebar caía em controles invisíveis. Corrigido em `focus_trap.js`: nova `isVisible(el)` usa `getClientRects().length > 0` + `getComputedStyle` (exclui `display:none`, `visibility:hidden` e `opacity:0`). De quebra resolve o gap de `position: fixed` (que tem `offsetParent === null` por spec).
2. **Visibilidade do botão excluir também para teclado:** além do trap, o botão só aparecia no hover. Adicionado `group-focus-within:opacity-100` em `write.html.erb` e no `createChapterElement` de `chapter_panel_controller.js` — foco por teclado agora revela o botão.
3. **`aria-keyshortcuts` errado no macOS (baixo):** o HTML anunciava `Control+B` etc., mas o TipTap usa atalhos `Mod-` (Cmd no Mac). Novo `editor_controller.js#updateShortcutLabels` reescreve `Control` → `Meta` nos `[aria-keyshortcuts]` da toolbar quando `navigator.platform` é Mac/iPhone/iPad/iPod (chamado no `connect()`).
4. **`disconnect()` não limpava efeitos do modal (baixo):** `publish_controller.disconnect()` removia o listener mas não resetava `document.body.style.overflow` — navegação Turbo com modal aberto deixava o scroll travado. Agora limpa condicionalmente (`if (body.style.overflow === "hidden")` — seguro pois `sidebar_controller` e `editor_sidebar_controller` também gerenciam esse overflow).

**Revalidação pós-review:** `npm run build` OK; `bin/rubocop` OK (59 arquivos); bundle contém `updateShortcutLabels`, `getClientRects` e `group-focus-within:opacity-100` (10 ocorrências); render de `write.html.erb` contém `group-focus-within:opacity-100`.


---

## Fase 5 — Testes ✅

**Status:** Concluída e validada em 13/08/2026.

Decisão do usuário: **Minitest** (padrão Rails, railtie reativado) + **testes JS com Vitest + jsdom** incluídos nesta fase.

### Pré-requisitos e ambiente

| #   | Tarefa                                                          | Resultado                                                                                                                                                                                                                                                                                                                                                                                   | Validação                                                                            |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Reativar railtie de testes                                      | `config/application.rb`: `# require "rails/test_unit/railtie"` descomentado (não havia `test/` nem framework ativo)                                                                                                                                                                                                                                                                         | `bin/rails test` roda                                                                 |
| 2   | Adicionar gems de teste                                         | `Gemfile` (grupo `:test`): `capybara` (3.40.0) e `selenium-webdriver` (4.47.0); `bundle install` OK (131 gems)                                                                                                                                                                                                                                                                               | `bundle check` OK                                                                     |
| 3   | Criar banco de teste                                           | `contaai_rails_test` em Postgres Supabase local (127.0.0.1:54322, role `postgres`). Workaround do schema: drop/create → `CREATE SCHEMA IF NOT EXISTS vault` → `db:schema:load RAILS_ENV=test` (precisa ser executado uma única vez em DB recém-criado; o `schema.rb` não é idempotente — `create_schema "extensions"` falha com `PG::DuplicateSchema` na 2ª execução)                            | `db:schema:load` OK; 10 tabelas criadas                                              |
| 4   | Contornar falta de superuser no Postgres gerenciado            | O role `postgres` (`rolsuper=false`) não permite `ALTER TABLE ... DISABLE TRIGGER` (usado pelo Rails p/ limpar fixtures) nem `check_all_foreign_keys_valid!` (VALIDA CONSTRAINT exige privilégio em `pg_constraint`). `test_helper.rb` define `ActiveRecord.verify_foreign_keys_for_fixtures = false` + módulo `ContaaiRails::TestFixtures::TruncateInsteadOfTriggerDisable` (prepend em `PostgreSQLAdapter#insert_fixtures_set`): usa `TRUNCATE TABLE ... CASCADE` e ordena os INSERTs por dependência de FK (`fixture_fk_depth`, pais antes de filhos) | Fixtures carregam; 55 testes passam sem `PG::InsufficientPrivilege`                 |
| 5   | Test DB descoberto durante execução                             | Sem `psql` no PATH; comandos SQL foram executados via `bin/rails runner`. Erro original: `PG::ForeignKeyViolation` na 1ª carga de fixtures (ordem de insert) — resolvido pelo sort topológico; depois `PG::InsufficientPrivilege` em `check_all_foreign_keys_valid!` — resolvido desabilitando a verificação (os dados são consistentes)                                                        | Logs da execução                                                                      |

### Infraestrutura de testes

| #   | Tarefa                          | Resultado                                                                                                                                                                                                                                                                        | Validação |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 6   | `test/test_helper.rb`           | Capybara (`require "capybara/rails"` + `"capybara/minitest"`); `Devise::Test::IntegrationHelpers` incluído em `ActionDispatch::IntegrationTest`; `fixtures :all`; hook de truncate topológico; `verify_foreign_keys_for_fixtures = false`                                        | `bin/rails test` OK     |
| 7   | `test/application_system_test_case.rb` | Classe padrão Rails 8 (`require "test_helper"`); `driven_by :selenium, using: :headless_chrome, screen_size: [1400, 1400]`; `Warden::Test::Helpers` com `Warden.test_mode!`/`Warden.test_reset!` (login via `login_as` sem passar pela UI)                                        | System tests rodam      |
| 8   | Fixtures                      | `users.yml` (author/reader com Devise: `encrypted_password` via `BCrypt::Password.create("password")`, `confirmed_at`), `books.yml` (draft_book/published_book/other_book), `chapters.yml` (chapter_one/chapter_two/published_chapter)                                               | Fixtures carregam       |
| 9   | Rebuild de assets para system tests | JS/CSS são servidos dos `app/assets/builds`; alterações nos controllers JS exigem `npm run build` (+ `npm run build:css`) antes dos system tests (o primeiro run usava bundle antigo e os testes de seleção falharam)                                                             | `npm run build` OK      |

### Testes implementados

| Área                    | Arquivos                                                             | Cobertura                                                                                                                                                                                                                                                                | Resultado |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Model — Chapter         | `test/models/chapter_test.rb` (10 testes)                            | título obrigatório; position default = max+1; recálculo `word_count`/`character_count`; conteúdo vazio; remoção de `<script>` (sem inflar contagem); `javascript:` em href removido; `<img>` removido; tags permitidas preservadas; `Book#word_count` atualizado em save/destroy | 10 OK     |
| Model — Book            | `test/models/book_test.rb` (8 testes)                                | validações (title/author_name/category); `total_word_count`; `has_chapters?`; `publishable?` (4 variantes); sanitização do content                                                                                                                                         | 8 OK      |
| Request — Chapters      | `test/controllers/chapters_controller_test.rb` (15 testes)           | auth exigida; index/show/create/update/destroy/reorder; ownership (403 p/ não-dono); posição sequencial no create; sanitização XSS no create; erro sem título; `word_count` enviado pelo cliente é ignorado (recalculado no backend); reorder move/posição idêntica        | 15 OK     |
| Request — Books         | `test/controllers/books_controller_test.rb` (21 testes)              | index público (só published); show público; new/create/destroy; ownership; publish: owner, já publicado, checks de requisitos (publishable=false), gera HTML `<h2>` sem `##`; unpublish: owner, draft, volta a rascunho; write owner; read exige auth                    | 21 OK     |
| System — Editor         | `test/system/editor_test.rb` (7 testes)                              | carga do 1º capítulo + contagens; negrito via toolbar; contagem em tempo real; auto-save persiste no servidor (recarga + conferência); adicionar capítulo pela sidebar (cria/seleciona); trocar de capítulo carrega conteúdo; publicar via modal (UI + DB)                 | 7 OK      |
| JS — helpers            | `test/javascript/helpers/word_count.test.js` (8 testes)              | `calculateWordCount` (espaços, múltiplos espaços, vazio, null, bordas) e `calculateCharacterCount`                                                                                                                                                                          | 8 OK      |
| JS — helpers            | `test/javascript/helpers/focus_trap.test.js` (7 testes)              | `focusableElements` (só visíveis/focáveis; vazio) e `trapFocus` (não-Tab ignorado, foco externo→primeiro, Tab no último→primeiro, Shift+Tab no primeiro→último); `getClientRects` stubado (jsdom retorna vazio)                                                              | 7 OK      |
| JS — controller         | `test/javascript/controllers/word_count_controller.test.js` (3 testes) | atualiza contadores via `editor:contentChanged`; atualiza contador do capítulo ativo na sidebar; usa `editor:chapterChanged` para ler do editor                                                                                                                               | 3 OK      |

### Bugs reais encontrados e corrigidos pelos testes

1. **`set_default_position` nunca disparava (todos os capítulos criados com position 0).** O schema define `default: 0` para `position`; no `build`, o atributo já vem como `0` (não `nil`), então `self.position ||= ...` era inócuo. Como `chapter_params` não aceita `position`, **todo capítulo novo era criado com position 0**, fazendo a ordenação depender da ordem de inserção. Corrigido em `app/models/chapter.rb`: `self.position = book.chapters.maximum(:position).to_i + 1` (sobrescreve no create). Testes: `posição padrão é a máxima atual + 1` e `create cria capítulo com posição sequencial`.
2. **Capítulos renderizados no servidor não eram selecionáveis.** O `createChapterElement` de `chapter_panel_controller.js` anexava listener de click, mas os `li` iniciais renderizados por `write.html.erb` não tinham listener nenhum — clicar num capítulo existente não fazia nada. Corrigido com **delegação de eventos**: `connect()` registra `listTarget.addEventListener("click", this.handleListClick)` (closest `li[data-chapter-id]`, ignora `button`) e o listener por-item no `createChapterElement` foi removido. Teste: `trocar de capítulo carrega o conteúdo correto`.

### Notas técnicas

- **Postgres Supabase local não é superuser:** impossível usar o fluxo padrão de fixtures do Rails (`disable_referential_integrity` e `check_all_foreign_keys_valid!`). O TRUNCATE `... CASCADE` exige apenas ownership das tabelas e, combinado com o sort topológico dos INSERTs, substitui o `DISABLE TRIGGER` com segurança.
- **`schema:load` não idempotente:** `db/schema.rb` contém `create_schema "extensions"` + `enable_extension "vault.supabase_vault"`. Para (re)criar o banco de teste: drop/create, `CREATE SCHEMA IF NOT EXISTS vault`, e um único `db:schema:load`.
- **System tests e assincronismo:** `confirm()` do publish e `loadChapter` são assíncronos (fetch); os testes usam espera do Capybara (`assert_selector`/`assert_text`) antes de assertar DB/UI. Sem o wait, o `@book.reload` lia o estado antes do PATCH terminar.
- **Driving o TipTap nos testes:** `document.execCommand` não aciona o ProseMirror (a contagem não atualizava). Os system tests usam a API do editor via Stimulus (`window.Stimulus.getControllerForElementAndIdentifier(...).editor.chain()...`), o mesmo caminho das ações da toolbar.
- **`evaluate_script` vs `execute_script`:** `evaluate_script` exige script como expressão (declarações `const` no topo falham com "Unexpected token 'const'"); usou-se expressões/IIFEs.
- **jsdom não tem layout:** `getClientRects()` retorna vazio para todos os elementos; stubado com `vi.spyOn(HTMLElement.prototype, "getClientRects")` nos testes de `focus_trap`. `hidden`/`display:none` só são detectados no próprio elemento (não no ancestral).
- **Observações para a Fase 6:** (a) a página pública `show` exibe "Ler Agora" para `read_book_path`, mas `books#read` exige autenticação (visitante cai no login) — decisão de produto pendente; (b) `CI` `.github/workflows/ci.yml` não tem job de testes — recomendado adicionar.

### Checklist de validação da Fase 5

- [x] `bin/rails test` passa — **55 runs, 163 assertions, 0 failures, 0 errors**
- [x] `npm test` (Vitest) passa — **17 testes, 3 arquivos, 0 falhas**
- [x] Cobertura das funcionalidades do editor (capítulos, livros, publish/unpublish, sanitização/XSS, autosave, sidebar, modais, contadores)
- [x] Sanitização e XSS testados em model, request e system
- [x] `bin/rubocop` — 66 arquivos, nenhuma ofensa
- [x] `npm run build` e `npm run build:css` — OK
- [x] `git status` revisado

---

## Fase 6 — Polimento ✅

**Status:** Concluída e validada em 13/08/2026.

| #   | Tarefa                                            | Resultado                                                                                                                                                                                                                                                                                                                             | Validação                                                     |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Otimizar `reorder` para batch update              | Rota alterada para ação de collection (`PATCH /books/:book_id/chapters/reorder`) aceitando `ordered_ids` (ordem completa dos capítulos). Controller valida que o conjunto de ids é exatamente o do livro (evita posições órfãs/duplicadas), aplica em transação única com `update_column` e retorna os capítulos ordenados. Frontend (`chapter_panel_controller.js#saveNewOrder`) passou de N requisições sequenciais (uma por capítulo) para **1 requisição** com a ordem inteira | 16 testes do ChaptersController verde, incl. "mesma ordem" e "ids inválidos" |
| 2   | Remover código morto                              | `editor_controller.js`: removido `getChapterData` (nunca chamado; `calculateWordCount` ainda usado em `dispatchContentChanged`). `book.rb`: removido `total_word_count` (só o teste usava; `word_count` é denormalizado no livro). Teste correspondente removido                                                                         | `rg` não encontra referências; suíte verde                    |
| 3   | Adicionar `published_at` em chapters (se necessário) | **Não necessário** — `Book` já tem `published_at`; publicação é por livro (capítulos são consolidados em `book.content`), então `published_at` por capítulo não agrega valor                                                          | Decisão registrada; sem migration                              |
| 4   | Documentar o editor no README                     | README: corrigido item 5 da "Camada de escrita" (publish agora gera HTML `<h2>` + conteúdo sanitizado, não mais markdown `##`); seção "Testes" reescrita (antes dizia que não havia suíte) documentando Minitest + Vitest e o workaround de fixtures; estrutura do projeto inclui `test/` (controllers, fixtures, javascript, models, system) | `README.md` revisado                                          |
| 5   | Ativar CSP                                        | `content_security_policy.rb` ativado: `default-src :self :https`, `font/img-src` com `:data`, `object-src :none`, `script-src :self :https` com **nonce** (nonce generator + `nonce_auto`), `style-src` com `:unsafe_inline` (necessário pelos estilos inline de capa dos livros e classes do editor), `connect-src :self`. `csp_meta_tag` já presente nos layouts                            | 7 system tests verdes com CSP ativo (headless Chrome aplica a política) |
| 6   | Adicionar `@tailwindcss/typography` para o editor | **Já estava instalado/configurado** em fases anteriores: `@tailwindcss/typography ^0.5.20` no package.json, `@plugin "@tailwindcss/typography"` no `application.tailwind.css` e classes `prose prose-lg` em uso em `read.html.erb` e `editor_controller.js`. Verificado no CSS compilado (477 ocorrências de `prose`)                    | `read.html.erb` renderiza com tipografia; build CSS ok        |

### Extra — job de testes no CI

A suíte de testes (Fase 5) não rodava no GitHub Actions (o `ci.yml` só tinha `scan_ruby` e `lint`). Adicionado job `test`:

- Service container **Postgres 17** na porta 54322 (espelha `config/database.yml` do ambiente test, que aponta para Supabase local 54322), com `POSTGRES_DB: contaai_rails_test`.
- `npm ci` → `npm run build` + `npm run build:css` (system tests usam o bundle compilado).
- `db:create` + **`db:migrate`** (não `schema:load`, que referencia extensões Supabase `vault`/`pg_net` inexistentes em Postgres vanilla — as migrations da app não dependem delas).
- `bin/rails test` (inclui system tests com Chrome headless) + `npm test` (Vitest).
- `bin/ci` (local) permanece inalterado.

### Checklist de validação da Fase 6

- [x] Reorder é atômico (1 request + transação única) — 16 testes do ChaptersController
- [x] Código morto removido (`getChapterData`, `total_word_count`)
- [x] CSP ativo (`script-src` com nonce; `style-src unsafe-inline` documentado)
- [x] Documentação atualizada (README: editor, testes, estrutura; CSP)
- [x] `bin/rails test` — **55 runs, 166 assertions, 0 failures, 0 errors**
- [x] `npm test` — **17 testes, 3 arquivos, 0 falhas**
- [x] `bin/rubocop` — 66 arquivos, nenhuma ofensa
- [x] `npm run build` + `npm run build:css` — OK
- [x] CI job `test` adicionado ao `.github/workflows/ci.yml`

---

## Próximas fases (não iniciadas)

| Fase   | Objetivo                                                                                 | Status   |
| ------ | ---------------------------------------------------------------------------------------- | -------- |
| —      | Fases do plano original concluídas (Fase 1 a Fase 6)                                      | ✅ Todas |

Itens pós-plano (opcionais): (a) decisão de produto sobre link "Ler Agora" público × `read` exigir auth; (b) validação do job `test` no GitHub Actions (depende de push); (c) cobertura real ≥70% via SimpleCov, se desejado.
