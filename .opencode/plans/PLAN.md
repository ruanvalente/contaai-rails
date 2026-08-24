# PLAN.md — Log de Execução: Importação de Capítulos no Editor (ContaAI)

> Documento de acompanhamento da execução de `.opencode/plans/IMPORT-EXPORT-TEXT-PLAN.md`.
> Cada fase é implementada → analisada → validada → documentada aqui antes de avançar.

---

## ✅ Fase 1 — Auditoria da Codebase (Validada)

**Status:** Concluída e verificada contra o código real em 21/08/2026.

### Confirmações da auditoria original

| Item do plano | Verificação |
| --- | --- |
| Modelos `Book` / `Chapter` | ✅ Correto. `Book belongs_to :user`, `has_many :chapters` ordenados por position, `has_one_attached :cover_image`. `Chapter belongs_to :book, touch: true`. |
| Validations | ✅ Chapter: title presence, position numericality ≥ 0. Book: title/author_name/category presence + enums category/status. |
| Concerns `ContentSanitizer` e `ChapterWordCountConcern` | ✅ Existem em `app/models/concerns/`. |
| Endpoint `POST /books/:book_id/chapters` | ✅ Existe (`ChaptersController#create`). |
| Reorder via `PATCH .../chapters/reorder` | ✅ Existe, valida conjunto de ids, transação + lock, `update_column(:position)`. |
| Publicação monta `books.content` com `<h2>título</h2>` + conteúdo | ✅ Correto (`BooksController#publish`, usa `CGI.escapeHTML` no título). |
| Auto-save a cada 30s via `auto-save_controller.js` | ✅ Correto (debounce 30s, retry c/ backoff, sendBeacon fallback). |
| Fixtures e testes de chapter existem | ✅ Minitest + fixtures (`draft_book`, `published_book`, `chapter_one/two`). |

### ⚠️ Correções à auditoria original (importante para as próximas fases)

1. **NÃO existem Turbo Frames** em nenhuma view. A navegação entre capítulos é feita por **Stimulus CustomEvents** (`chapter:selected` bubbling) + `fetch` JSON. O plano menciona "Turbo frames" — corrigido: qualquer preview deve seguir o padrão Stimulus/fetch existente ou usar Turbo tradicional server-rendered.
2. **`position` não é permitido em strong params** (`params.require(:chapter).permit(:title, :content)`). A posição é auto-atribuída pelo callback `set_default_position` (`book.lock!` + `MAX(position)+1`). A importação pode setar `position:` diretamente na criação em massa (atributo de modelo, só não vem de params).
3. **`ChaptersController` é API JSON-only** — todas as ações respondem JSON. UI do editor é client-side (Tiptap montado em `data-editor-target="content"`).
4. **Sanitizer NÃO permite `img`, `figure` nem tabelas** — conteúdo importado com imagens será descartado. Tags permitidas: `h1-h6, p, strong, em, u, s, ul, ol, li, blockquote, a, code, pre, hr, br`; attrs: `href, title, target, rel, align`; protocolos: http/https/mailto (+ validação anti `javascript:` via Nokogiri).
5. **Word count**: `ChapterWordCountConcern` recalcula `word_count`/`character_count` em `before_save` apenas `if content_changed?` — importação que grava `content` dispara recálculo automático; `Chapter#after_save` propaga para `books.word_count`.
6. **Schema usa schema Postgres `public.` explícito** (Supabase local). Novas migrations devem respeitar isso (Rails já gera correto).
7. **Auth**: Devise (`authenticate_user!`) + checagem manual `@book.user == current_user` nos controllers (sem Pundit/policy objects).
8. **Não existe** `app/services/` ainda — será criado. **Não existe** nenhum model/controller/route relacionado a "import".
9. **Stack JS**: Tiptap v3 (`@tiptap/core` + starter-kit), headings limitados a níveis 1–3 no editor, extensões Underline/TextAlign/Indentation custom.
10. **CSS**: Tailwind v4 (`tailwindcss-rails` + Flowbite theme). Views usam classes utilitárias com cores hex arbitrárias (ex.: `bg-[#F5F0EB]`).
11. **Testes**: Minitest (não RSpec) + Capybara/Selenium p/ system tests. Banco de test precisa estar migrado manualmente (autoload de schema desativado).

### Decisão arquitetural derivada (para Fases 3–10)

- Pipeline de serviços em `app/services/chapter_importer/` seguindo convenção PORO.
- Preview server-rendered (padrão Rails) reutilizando os controllers Stimulus existentes onde possível; sem criar segundo editor paralelo.
- Persistência temporária via model `BookImport` (JSONB `parsed_data`), confirmação em transação única.

---

## ✅ Fase 2 — Definição do Formato de Importação (Contrato MVP)

**Status:** Concluída. Especificação congelada abaixo — implementada nas Fases 3–4.

### Contrato de entrada

| Aspecto | Decisão |
| --- | --- |
| Formatos MVP | `.txt` (obrigatório) e `.md` (aceito, parsing simples) |
| Extensões rejeitadas | Qualquer outra (`.pdf`, `.docx`, etc.) → erro amigável |
| Codificação | UTF-8 obrigatório; entrada detectada/convertida com `String#scrub` + `encode(invalid: :replace)` |
| Tamanho máximo | **5 MB** (`MAX_FILE_SIZE = 5.megabytes`), constante no serviço |
| Conteúdo vazio / whitespace | Rejeitado com erro |
| BOM UTF-8 | Removido no parse |

### Gramática de detecção de capítulos (regex canônicas)

| Padrão (início de linha) | Exemplo | Confiança |
| --- | --- | --- |
| `Capítulo\s+N` (arábico ou romano, case-insensitive) | `Capítulo 1`, `CAPÍTULO IV` | **0.95** |
| `Chapter\s+N` | `Chapter 12`, `CHAPTER III` | **0.95** |
| Linha de título seguinte ao marcador (até 80 chars, sem pontuação final forte) | `A chegada` após `Capítulo 1` | compõe o título |
| Número romano/arábico isolado na linha | `1`, `VII` | **0.60** → requer revisão (< 0.7 marca `needs_review`) |
| Texto livre sem padrão | `Era uma noite...` | tratado como conteúdo do capítulo corrente |

### Regras complementares

1. **Título composto**: quando há linha de título após o marcador, título = `"Marcador — Subtítulo"` (ex.: `Capítulo 1 — A chegada`). Caso contrário, só o marcador.
2. **Prólogo/introdução**: texto antes do primeiro capítulo detectado é descartado da prévia (documentado na UI como "conteúdo inicial ignorado") para não virar capítulo fantasma.
3. **Limite por capítulo**: nenhum limite rígido no MVP (o sanitizer e o DB já limitam); validação de tamanho total do arquivo cobre abuso.
4. **Saída estruturada**: array de hashes `{ title:, content:, confidence:, needs_review: }` com `content` em HTML `<p>` por parágrafo — compatível com allowlist do `ContentSanitizer`.
5. **Markdown**: no MVP `.md` é lido pelo mesmo pipeline de texto puro (parágrafos preservados); conversão rica de sintaxe markdown fica para a segunda etapa.

---

## ✅ Fases 3 e 4 — Parser TXT + Detecção de Capítulos com Confidence

**Status:** Concluídas. Implementadas juntas (contrato da Fase 2 já congelado). Validadas com 24 testes unitários + suíte completa (133 runs) + RuboCop sem offenses.

### Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `app/services/chapter_importer.rb` | Módulo namespace + `ChapterImporter::Error` + constantes de confidence (`HIGH_CONFIDENCE=0.95`, `BARE_NUMBER_CONFIDENCE=0.6`, `REVIEW_THRESHOLD=0.7`) |
| `app/services/chapter_importer/text_parser.rb` | Valida extensão (.txt/.md), tamanho (5MB), presença; normaliza encoding (UTF-8 via `encode` + scrub), remove BOM, unifica CRLF→LF |
| `app/services/chapter_importer/chapter_detector.rb` | Máquina de estados linha-a-linha; retorna array de structs `Chapter(title:, content:, confidence:)` com `needs_review?` |
| `app/services/chapter_importer/importer.rb` | Orquestra parser → detector; `import(file:, book:)` → `Result(chapters:)`; levanta `Error` com mensagens PT-BR |

### Decisões técnicas tomadas durante a implementação

1. **Bug do Ruby descoberto**: `/cap[íi]tulo/i` NÃO casa com "CAPÍTULO" (case folding em character classes não cobre acentuadas). Solução: fazer match contra `line.downcase` e extrair trechos originais por offsets (`match.begin/end`) para preservar caixa original dos números romanos/subtítulos.
2. **Heurística de subtítulo conservadora**: linha seguinte ao marcador só vira subtítulo se (a) não há conteúdo acumulado ainda E (b) a linha subsequente é vazia/EOF. Evita engolir prosa como título (bug encontrado pelo teste de XSS — `<script>` virava subtítulo).
3. **Escape antes de wrap**: conteúdo é escapado com `CGI.escapeHTML` antes de virar `<p>` — proteção XSS em camada dupla com `ContentSanitizer` (que roda no save).
4. **Parágrafos**: blocos separados por linha vazia; linhas consecutivas dentro do bloco são unidas com espaço (convenção de prosa soft-wrapped).
5. **Structs PORO** (`Chapter`, `ChapterStart`, `Result`) — sem dependência de ActiveRecord, testáveis isoladamente.

### Testes criados (24)

- `test/services/chapter_importer/text_parser_test.rb` (8): extensões válidas/inválidas, vazio, limite de tamanho, BOM, CRLF, acentos
- `test/services/chapter_importer/chapter_detector_test.rb` (13): caso básico, uppercase, romanos, inglês, subtítulo inline, bare number c/ review, intro descartada, sem capítulos, capítulo vazio, escape XSS, agrupamento de parágrafos
- `test/services/chapter_importer/importer_test.rb` (3): pipeline completo, resultado vazio, erro de arquivo inválido

### Validação executada

```
bin/rails test test/services/chapter_importer/  → 24 runs, 0 failures
bin/rails test                                  → 133 runs, 369 assertions, 0 failures
bundle exec rubocop app/services test/services  → 7 files, no offenses
```

---

## ✅ Fase 8 — Persistência Temporária (Model BookImport)

**Status:** Concluída. Executada antes das Fases 5–7 (upload/preview dependem do model; ordem igual ao roadmap do plano). 7 testes de modelo + suíte completa verdes.

### Arquivos criados/alterados

| Arquivo | Mudança |
| --- | --- |
| `db/migrate/20260821121955_create_book_imports.rb` | Tabela `book_imports`: `book_id`/`user_id` FK NOT NULL, `filename` NOT NULL, `status` int default 0, `parsed_data` jsonb default `{}`, `error_message` text, índice em status |
| `app/models/book_import.rb` | Enum status (`pending/processing/ready/confirmed/failed`), validação filename, scopes, helpers `mark_ready!` / `mark_failed!` / `parsed_chapters` / `needs_review?` |
| `app/models/book.rb` | ➕ `has_many :book_imports, dependent: :destroy` (imports são artefatos temporários; morrem com o livro) |
| `test/models/book_import_test.rb` + `test/fixtures/book_imports.yml` | 7 testes: associações, validação, ciclo de vida do enum, parsed_data array/hash, needs_review?, mark_ready!/mark_failed! |

### Decisões técnicas

1. **JSONB** para `parsed_data` (Postgres nativo) — permite query futura por conteúdo parseado.
2. **Bug pego pelos testes de integração existentes**: sem `dependent: :destroy`, deletar um livro quebrava com `PG::ForeignKeyViolation` (testes `BooksControllerTest#test_destroy...` e `BookTest#test_destroying_book_destroys_chapters` pegaram). Corrigido no model Book.
3. `Struct#to_h` em vez de `Hash#slice` no `mark_ready!` (Struct não tem slice).
4. `needs_review?` calculado a partir dos dados persistidos (confidence < 0.7) — usado pela UI de preview para destacar capítulos duvidosos.

### Validação executada

```
bin/rails db:migrate (+ test DB)                 → migrated
bin/rails test                                   → 140 runs, 385 assertions, 0 failures
bundle exec rubocop (services+models+migration)  → no offenses
```

---

## ✅ Fases 5, 6 e 7 — Upload + Preview Editável + Operações na Prévia

**Status:** Concluídas e validadas em 24/08/2026. Implementadas como um único fluxo (upload → preview → editar/reordenar/excluir/adicionar → confirmar), pois o ciclo é indivisível do ponto de vista do usuário. **14 testes de controller + suíte completa verdes; RuboCop limpo (53 files).**

> Nota: durante a auditoria desta fase foram encontrados e removidos dois `puts` de debug esquecidos em `book_imports_controller_test.rb`, e corrigida uma expectativa errada de teste (`position == 0` para livro vazio — o modelo usa convenção `MAX+1` estabelecida e testada em `chapter_test.rb:16/:107`; o teste agora verifica ordenação relativa entre capítulos criados).

### Arquivos criados/alterados

| Arquivo | Responsabilidade |
| --- | --- |
| `config/routes.rb` | `resource :import, only: [:new, :create, :show, :destroy], controller: "book_imports"` + `patch :confirm` (recurso singular: **um import ativo por livro**) |
| `app/controllers/book_imports_controller.rb` | `new` (form upload), `create` (parser → BookImport ready → redirect preview), `show` (preview editável), `confirm` (transação → chapters), `destroy` (cancelar) |
| `app/views/book_imports/new.html.erb` | Form de upload mobile-first (`accept=".txt,.md"`), dica de formatos, exemplo de arquivo esperado em `<details>` |
| `app/views/book_imports/show.html.erb` | Preview: contador ao vivo (`aria-live="polite"`), rows renderizadas, template p/ novos capítulos, barra sticky Cancelar/Confirmar |
| `app/views/book_imports/_chapter_fields.html.erb` | Parcial de linha: nº da ordem, badge "Verificar título" se `confidence < 0.7`, botões mover ↑/↓/remover, input título + textarea conteúdo |
| `app/javascript/controllers/import_preview_controller.js` | Stimulus: `add` (clona `<template>`, foca título), `remove` (última row limpa campos em vez de sumir), `moveUp/moveDown` (reordena DOM + scroll suave), `renumber` (renumera ordem e contador) |
| `app/views/books/write.html.erb` | ➕ Link "Importar" com ícone no header da sidebar de capítulos (ponto de entrada) |
| `test/controllers/book_imports_controller_test.rb` | 14 testes: auth, ownership (403 p/ não-dono em todas as ações), parse feliz, substituição de imports obsoletos, sem capítulos detectados, formato rejeitado, preview renderiza, confirmação cria em ordem + converte HTML + calcula word count, marca confirmed, rollback em capítulo inválido, linhas vazias ignoradas, cancelar |

### Decisões técnicas e desvios conscientes do plano

1. **Preview usa `textarea` simples, NÃO o Editor Tiptap** *(desvio documentado da Fase 6)*. Motivo arquitetural: o plano pedia PATCH para `/chapters/:id`, mas os capítulos importados **ainda não existem** no banco durante a prévia (só nascem no confirm). Editar texto puro em textarea + converter para HTML no servidor no momento do confirm (`ChapterDetector.html_from_text`: escapa HTML, quebra parágrafos em `<p>`) mantém o contrato Tiptap do banco sem montar N instâncias de Tiptap numa página só. O conteúdo confirmado abre normalmente no editor existente.
2. **Reordenação por botões ↑/↓ em vez de drag & drop** *(desvio da Fase 7)*: mesma interação funciona idêntica em desktop e touch (mobile-first), acessível por teclado/screen reader sem ARIA extra de drag. Drag & drop fica como melhoria futura.
3. **Rota singular `resource :import`**: modelagem "um import ativo por livro"; imports antigos não-confirmados são descartados (`discard_stale_imports`) dentro da mesma transação do create.
4. **Confirmação transacional completa** (Fase 10): `ActiveRecord::Base.transaction` envolve criação de todos os chapters + update do status do import; qualquer `RecordInvalid` faz rollback total e devolve à prévia com erro. Capítulos herdam `set_default_position` (MAX+1 com lock) e callbacks de word count existentes — zero lógica duplicada.
5. **Segurança aplicada nesta camada**: ownership check em todas as ações (padrão manual `@book.user == current_user`), `File.basename` + truncamento 255 no filename (nunca confia no cliente), escape XSS duplo (detector + `ContentSanitizer` no save), linhas totalmente vazias filtradas no confirm.
6. **UX de confiança**: badge âmbar "Verificar título" nos capítulos com confidence < 0.7; contador "N capítulos encontrados" atualiza ao vivo com `aria-live="polite"`; última row restante tem campos limpos em vez de ser removida (evita estado sem rows).

### Refinamentos de robustez/acessibilidade (aplicados na validação da fase)

Critério: **simplicidade máxima cobrindo a necessidade real** — drag & drop e Tiptap na prévia foram avaliados e descartados (os botões ↑/↓ já atendem desktop+touch com acessibilidade nativa; o conteúdo importado é texto puro e textareas evitam N instâncias do editor). Dois riscos reais corrigidos:

1. **Duplo-submit no confirm**: botão "Confirmar importação" ganhou `data-turbo-submits-with="Confirmando..."` — Turbo desabilita/renomeia durante o envio, eliminando capítulos duplicados por clique duplo.
2. **Alvos de toque**: botões mover ↑/↓/remover ampliados de `p-1.5` (~28px) para `p-2` (~32px) — acima do mínimo WCAG 2.5.8 AA (24px), melhorando uso mobile sem poluir o layout desktop.

### Validação executada

```
bin/rails test                                   → 154 runs, 448 assertions, 0 failures
bundle exec rubocop app test                     → 53 files inspected, no offenses
```

---

## ✅ Fases 9 e 10 — Fluxo Definitivo + Transação na Confirmação (Validadas)

**Status:** Concluídas (implementadas junto com as Fases 5–7, pois são o fechamento natural do ciclo). Validadas em 24/08/2026 com os 5 testes de `confirm` do controller (incluindo rollback) verdes.

### Fase 9 — Fluxo real implementado vs. diagrama do plano

| Etapa do plano | Implementação real | Evidência |
| --- | --- | --- |
| Upload | Form em `new.html.erb` (`POST /books/:book_id/import`) | `app/views/book_imports/new.html.erb:12` |
| Import Controller | `BookImportsController#create` | `book_imports_controller.rb:12` |
| Import Service | `ChapterImporter::Importer.import(file:, book:)` | `importer.rb:12` |
| Text Parser | `TextParser.parse!` (validações + normalização) | `text_parser.rb:10` |
| Chapter Detection | `ChapterDetector.detect` (máquina de estados) | `chapter_detector.rb:17` |
| BookImport persistido | Status `ready` + `parsed_data` JSONB, imports obsoletos descartados na mesma transação | `book_imports_controller.rb:24-32` |
| Preview UI | `show.html.erb` editável (Stimulus `import-preview`) | `app/views/book_imports/show.html.erb` |
| Confirmar | `PATCH /books/:book_id/import/confirm` | `book_imports_controller.rb:44` |
| Transaction Rails | Cria todos os chapters + marca import confirmed, atômico | `book_imports_controller.rb:57-62` |
| Chapters + Book data | Callbacks existentes propagam word_count p/ livro; redirect ao Editor (`write_book_path`) | `book_imports_controller.rb:64-65` |

**Desvio consciente do diagrama:** não há job/background nem status `pending`/`processing` visíveis — parse é síncrono (limite de 5MB torna isso rápido) e o registro nasce direto em `ready`. Os enums `pending/processing/failed` permanecem disponíveis no model para uso futuro.

### Fase 10 — Transação na confirmação

1. **Atômica**: `ActiveRecord::Base.transaction` envolve a criação de todos os capítulos + update do status do import (`book_imports_controller.rb:57`). Qualquer falha → rollback total.
2. **Sucesso**: redirect ao editor com notice "N capítulos importados com sucesso."
3. **Erro**: `rescue ActiveRecord::RecordInvalid` → rollback completo (nenhum capítulo criado), usuário volta à prévia com mensagem de validação.
4. **Prova por teste**: `test "confirm rolls back everything when one chapter is invalid"` — envia 1 capítulo válido + 1 sem título e afirma que o contador de capítulos não mudou (`book_imports_controller_test.rb:156-175`).
5. **Contadores do livro**: não são recalculados manualmente — `ChapterWordCountConcern` (`before_save`) + `after_save` já propagam para `books.word_count`; duplicar isso violaria DRY (decisão registrada na Fase 1, item 5).

### Validação executada

```
bin/rails test test/controllers/book_imports_controller_test.rb -n "/confirm/"
→ 5 runs, 22 assertions, 0 failures
```

---

## ✅ Fase 11 — Integração com o Editor Existente (Validada)

**Status:** Concluída. Checklist do plano verificado item a item contra o código real; lacuna de evidência (publicação pós-importação) coberta com novo teste de integração. Validado em 24/08/2026.

### Checklist de verificação

| # | Item do plano | Verificação |
| --- | --- | --- |
| 1 | Conteúdo em `chapters.content` HTML | ✅ Confirm converte texto → HTML via `ChapterDetector.html_from_text` (`<p>` escapados) antes de `create!` |
| 2 | Formato Tiptap compatível com allowlist | ✅ Só produz `<p>`; tags permitidas pelo `ContentSanitizer` (h1-h3 usados só pela publicação) |
| 3 | Editor salva via PATCH `/chapters/:id` | ✅ Intocado — capítulos importados são chapters normais |
| 4 | Autosave 30s | ✅ Intocado (`auto-save_controller.js`) |
| 5 | Word/char count automáticos | ✅ `before_save` recalcula se `content_changed?` + `after_save` propaga para `books.word_count`; testado (`assert_equal 4, first_chapter.word_count`) |
| 6 | Sanitização XSS | ✅ Camada dupla: `CGI.escapeHTML` no detector + `ContentSanitizer` no save; título malicioso (`Capítulo <b>Um</b> & Dois`) sai escapado na publicação |
| 7 | Publicação monta `books.content` | ⚠️ Era o único item sem prova automatizada → **novo teste adicionado**: import → confirm → publish → `book.published?`, `content` contém `<h2>título</h2>` + conteúdo do capítulo |
| 8 | Status enum do book | ✅ Intocado |
| 9 | Ordenação por position | ✅ Herda `set_default_position` (MAX+1 com lock); teste verifica ordem relativa entre capítulos criados |
| 10 | CRUD via ChaptersController | ✅ Intocado |

### Arquivos alterados nesta fase

| Arquivo | Mudança |
| --- | --- |
| `test/controllers/book_imports_controller_test.rb` | ➕ Teste `imported chapters satisfy editor contract and feed publication`: confirma importação com título contendo HTML/entidades, verifica conversão para Tiptap HTML, word_count > 0, publica o livro e valida `books.content` montado |

### Decisão técnica

O contrato do importador (Fase 11 do plano: tags/atributos permitidos + contadores automáticos) é atendido **por construção** — o import nunca escreve atributos fora do fluxo normal de modelo (`create!` dispara os mesmos callbacks/sanitizers). Por isso a integração é verificada nas bordas (controller/publicação), sem duplicar asserts de unidade já existentes.

### Validação executada

```
bin/rails test test/controllers/book_imports_controller_test.rb -n "/imported chapters satisfy/"
→ 1 runs, 11 assertions, 0 failures
```

---

## ✅ Fase 12 — Segurança (Validada)

**Status:** Concluída. Auditoria da tabela de validações do plano contra o código; lacuna encontrada (sniffing de conteúdo server-side) implementada + testada. Validada em 24/08/2026.

### Matriz de requisitos do plano

| Requisito | Status | Implementação |
| --- | --- | --- |
| Extensão apenas `.txt` / `.md` | ✅ (Fases 3–4) | `TextParser::ALLOWED_EXTENSIONS`, erro PT-BR amigável |
| **MIME validado no servidor** | ✅ **implementado nesta fase** | `TextParser#binary?`: rejeita arquivos com byte NUL ou densidade > 5% de caracteres de controle (C0/DEL). Motivo da abordagem: o MIME do multipart é header client-controlado (não confiável); sniffing determinístico de conteúdo é a única checagem real server-side para texto |
| Tamanho máximo configurável | ✅ (Fases 3–4) | `MAX_FILE_SIZE = 5.megabytes` |
| Encoding forçado UTF-8 | ✅ (Fases 3–4) | `force_encoding(UTF_8)` + `scrub` |
| Conteúdo vazio rejeitado | ✅ (Fases 3–4) | `validate_content!` |
| BOM / caracteres inválidos | ✅ (Fases 3–4) | BOM removido; bytes inválidos substituídos pelo scrub |
| Limite pós-parsing | ✅ (Fase 3) | `Importer::MAX_CHAPTERS = 200` (tamanho total já limitado pelo arquivo) |
| Nunca confiar em filename/MIME do cliente | ✅ (Fase 5–7) | `File.basename(...).first(255)`; `content_type` nunca é lido |
| Sanitização do conteúdo | ✅ | Dupla camada: `CGI.escapeHTML` antes de virar HTML + `ContentSanitizer` no save |
| Limite por capítulo | ✅ por construção | arquivo limitado a 5MB → conteúdo por capítulo naturalmente limitado |

### Arquivos alterados nesta fase

| Arquivo | Mudança |
| --- | --- |
| `app/services/chapter_importer/text_parser.rb` | ➕ Constantes `CONTROL_CHARACTERS` e `MAX_CONTROL_CHARACTER_RATIO` (0.05); `binary?` detecta NUL bytes e densidade de controle; nova mensagem "O arquivo não parece ser um documento de texto legível." |
| `test/services/chapter_importer/text_parser_test.rb` | ➕ 2 testes: binário com NUL bytes renomeado `.txt` é rejeitado; conteúdo ruidoso com alta densidade de `\u0007` é rejeitado |

### Decisões técnicas

1. **Por que não validar `file.content_type`:** qualquer valor pode ser forjado no cliente; browsers também mandam `application/octet-stream` legítimo para `.md`. Checar esse header daria falsos negativos e zero segurança real. A validação efetiva é sobre o *conteúdo* decodificado.
2. **NUL byte como sinal forte:** documentos binários reais (PDF, DOCX, ZIP, UTF-16) quase sempre contêm `\0`; texto UTF-8 legítimo praticamente nunca.
3. **Densidade de controle como rede secundária** (>5%): cobre binários sem NUL; tolera texto normal (tabulações `\t` e quebras `\n` não contam).
4. Falsos positivos improváveis: um texto real precisaria de ~1 caractere de controle a cada 20 chars.

### Validação executada

```
bin/rails test test/services/chapter_importer/text_parser_test.rb
→ 10 runs, 16 assertions, 0 failures
bundle exec rubocop app/services/chapter_importer/text_parser.rb test/services/chapter_importer/text_parser_test.rb
→ 2 files inspected, no offenses
```

---

## ✅ Fase 13 — UX / Mobile First (Validada)

**Status:** Concluída. Revisão de conformidade dos princípios do plano contra as views/controller Stimulus — nenhum gap encontrado que justifique código novo. Validada em 24/08/2026.

### Princípios do plano vs. implementação

| Princípio | Verificação |
| --- | --- |
| Interface simples no mobile | ✅ Coluna única em ambas as telas (`max-w-2xl` upload, `max-w-3xl` preview); sem drag & drop na prévia (desvio consciente documentado nas Fases 5–7) |
| Toques/gestos intuitivos | ✅ Botões ↑/↓ com ícones claros funcionam igual em touch e mouse; mesma interação nos dois contextos |
| Botões grandes o suficiente p/ touch | ✅ Ícones de ação `p-2` (~32px > mínimo WCAG 2.5.8 de 24px); CTAs principais `px-6 py-2.5` |
| Scroll suave entre capítulos | ✅ `row.scrollIntoView({ block: "nearest", behavior: "smooth" })` ao reordenar (`import_preview_controller.js:45,56`) |
| Layouts do plano (desktop/mobile sketches) | ✅ Equivalentes funcionais: header com contador → lista de cards editáveis → barra sticky Cancelar/Confirmar |

### Detalhes de qualidade já presentes (além do mínimo do plano)

1. **Foco gerenciado**: ao adicionar capítulo, foco vai direto pro input de título (teclado abre no mobile pronto pra digitar).
2. **Contador ao vivo** com `aria-live="polite"` — screen readers anunciam "N capítulos" após cada operação.
3. **Estado seguro**: remover a última linha limpa os campos em vez de sumir com o card (nunca fica sem rows).
4. **Feedback visual de risco**: capítulos com confidence < 0.7 ganham borda âmbar + badge "Verificar título".
5. **Barra sticky bottom** mantém Confirmar/Cancelar acessíveis durante scroll de prévia longa.
6. Campos com `aria-label` explícitos e número da ordem marcado `aria-hidden` (decorativo).

### Validação executada

Revisão estática (sem mudanças de código). Comportamento dinâmico coberto pelo system test E2E da Fase 16 (reordenar, adicionar, remover, confirmar).

---

## ✅ Fase 14 — Feedback durante Processamento (Validada)

**Status:** Concluída. Um gap de UX corrigido no form de upload; mensagens de erro do plano já mapeadas 1:1. Validada em 24/08/2026.

### ⚠️ Descoberta importante desta fase

Ao rodar os **system tests pela primeira vez** (`bin/rails test` padrão não executa `test/system`), o E2E `book_import_flow_test` falhou por uma **inconsistência interna pré-existente**: a linha 41 esperava o título *antigo* ("Capítulo 2 — A descoberta") em `titles.first`, contradizendo as assertions finais do mesmo teste (linhas 63–65), que exigem o título *editado* persistido no banco — o cenário correto segundo o roteiro da Fase 16 do plano (editar → reordenar → confirmar). Corrigida a expectativa obsoleta para "A descoberta revisada". O teste nunca havia rodado de verdade; agora roda e passa.

### Feedback durante processamento

| Cenário do plano | Implementação |
| --- | --- |
| Botão de upload sem resposta visível | ✅ **Corrigido nesta fase**: `data-turbo-submits-with="Analisando..."` — Turbo renomeia e desabilita o botão durante o parse (também elimina duplo-submit) |
| Progresso por etapas ("✓ Arquivo recebido...") | ➖ Simplificação consciente: parse é síncrono (<1s até 5MB); etapas assíncronas seriam over-engineering. Feedback = botão desabilitado + rename |
| Erro: capítulos não identificados | ✅ Flash: "Não conseguimos identificar capítulos nesse arquivo. Verifique se ele usa marcadores como \"Capítulo 1\"." (equivalente amigável ao texto do plano) |
| Erros de formato/tamanho/vazio/binário | ✅ Mensagens PT-BR específicas via `ChapterImporter::Error` (Fases 3–4 e 12) |
| Confirmar importação | ✅ Já tinha `turbo_submits_with="Confirmando..."` desde as Fases 5–7 |

### Arquivos alterados nesta fase

| Arquivo | Mudança |
| --- | --- |
| `app/views/book_imports/new.html.erb` | ➕ `data-turbo-submits-with: "Analisando..."` no submit |
| `test/system/book_import_flow_test.rb` | 🔧 Expectativa da linha 41 corrigida (inconsistência pré-existente, ver nota acima) |

### Validação executada

```
bin/rails test test/system/book_import_flow_test.rb
→ 2 runs, 17 assertions, 0 failures
```

---

## ✅ Fase 15 — Testes (Validada)

**Status:** Concluída. Matriz de cobertura do plano mapeada contra os testes reais; suíte completa (incluindo system) verde e RuboCop limpo. Validada em 24/08/2026.

### Cobertura da tabela de testes unitários do plano

| Cenário do plano | Teste real |
| --- | --- |
| Caso básico (Cap 1 + Cap 2 TXT) | `chapter_detector_test "detects basic chapters"` + E2E completo |
| Maiúsculas ("CAPÍTULO 1") | `"detects uppercase markers"` |
| Romanos ("CAPÍTULO I") | `"detects roman numerals case-insensitively"` |
| Arquivo sem capítulos | `"returns no chapters when file has no structure"` |
| Capítulo sem conteúdo | `"detects chapter without content"` |
| Arquivo vazio | `text_parser_test "rejects empty file"` |
| Muito grande | `text_parser_test "rejects file above size limit"` |
| Encoding (á, ç, ã, é) | `text_parser_test "preserves accented characters"` |
| Conteúdo malformado | `"discards intro text before first chapter"`, `"bare number becomes low confidence..."`, `"does not treat subtitle-looking sentence..."` |

### Testes extras além do plano

- XSS: escape duplo no detector (`"escapes html in content to prevent injection"`) + título malicioso na publicação (Fase 11)
- Binário renomeado `.txt` / densidade de controle (Fase 12)
- Substituição de imports obsoletos, rollback transacional, linhas em branco ignoradas (controller)
- Integração com publicação (Fase 11)

### Totais da feature (acumulados)

| Camada | Arquivo | Testes |
| --- | --- | --- |
| Serviços | `text_parser_test` / `chapter_detector_test` / `importer_test` | 10 / 13 / 3 |
| Modelo | `book_import_test` | 7 |
| Controller | `book_imports_controller_test` | 16 |
| System/E2E | `book_import_flow_test` | 2 |

### Validação executada

```
bin/rails test:system  → 9 runs, 35 assertions, 0 failures (editor + import flow)
bin/rails test         → 157 runs, 463 assertions, 0 failures
bundle exec rubocop app test → 54 files inspected, no offenses
```

> Nota operacional: `bin/rails test` padrão NÃO roda system tests — usar `bin/rails test:system` ou ambos (lição registrada na Fase 14).

---

## ✅ Fase 16 — Testes de Integração/E2E (Validada)

**Status:** Concluída. Cenário completo do plano coberto por `test/system/book_import_flow_test.rb` (executado com sucesso pela primeira vez nesta fase — ver descoberta da Fase 14). Validada em 24/08/2026.

### Mapeamento dos 12 passos do plano → assertions reais

| # | Passo do plano | Cobertura |
| --- | --- | --- |
| 1 | Abre livro em rascunho | `visit write_book_path(@book)` (fixture `draft_book`) |
| 2 | Clica "Importar texto" | `click_on "Importar"` (link na sidebar) |
| 3 | Seleciona arquivo .txt | `attach_file("Arquivo de texto", sample_file)` (tmpdir) |
| 4 | Upload + detecção | submit do form → controller/serviços reais |
| 5 | Preview mostra capítulos | `assert_text "2 capítulos encontrados"` |
| 6 | Edita título | `fill_in "Título do capítulo", with: "A descoberta revisada"` |
| 7 | Reordena | clique em ↑ + asserts de ordem (título e conteúdo na 1ª posição) |
| 8 | Remove capítulo | clique em × + `assert_text "1 capítulo"` |
| 9 | Confirma | `click_on "Confirmar importação"` |
| 10 | Capítulos criados no DB | `assert_equal chapters_before + 1` (linha em branco ignorada) |
| 11 | Direcionado ao Editor | `assert_selector "h1", text: "Livro Rascunho"` |
| 12 | Conteúdo correto | título editado, `<p>` no content, `word_count > 0` |

### Regressão (evitar quebras no fluxo existente)

| Item do plano | Cobertura |
| --- | --- |
| Editor existente continua funcionando | ✅ `test/system/editor_test.rb` verde na mesma suíte system (7 testes) |
| Word count / char count corretos | ✅ Controller (`word_count == 4`) + system (`word_count > 0`) |
| Publicação após importação | ✅ Teste de integração da Fase 11 (confirm → publish → `books.content`) |
| Cancelamento não cria nada | ✅ Segundo teste do system file (import descartado, contadores intactos) |

### Validação executada

```
bin/rails test:system → 9 runs, 35 assertions, 0 failures
```

---

## ✅ Fase 17 — Observabilidade (Validada)

**Status:** Concluída. Ciclo de vida completo instrumentado com logs estruturados + persistência de falhas; conteúdo nunca logado. Validada em 24/08/2026.

### Eventos de log implementados (`Rails.logger`, formato `key=value` greppável)

| Evento | Nível | Metadados |
| --- | --- | --- |
| `[book_import] ready` | info | user, book, filename, **chapters=N** (≈ métrica `chapters_detected`) |
| `[book_import] confirmed` | info | user, book, chapters=N (≈ `imports_completed`) |
| `[book_import] cancelled` | info | user, book |
| `[book_import] no_chapters_detected` | warn | user, book (já existia) |
| `[book_import] failed` | warn | user, book, filename, error_class (≈ `imports_failed`; já existia, agora com filename) |
| `[book_import] failed_record_not_saved` | warn | book, error_class (guarda da própria observabilidade) |

**Privacidade:** nenhum log contém conteúdo do arquivo ou dos capítulos — apenas filename (sanitizado via `File.basename`), contadores e classes de erro, conforme exigência do plano.

### Persistência de falhas

- Parse com erro → cria `BookImport(status: :failed, error_message:)` para auditoria em banco (exigência "Logs de Erro" do plano).
- Protegido por `create` sem bang + rescue interno: falha ao salvar o registro de erro **nunca mascara** o erro original nem quebra a resposta ao usuário.
- Registros `failed` são limpos naturalmente pelo `discard_stale_imports` no próximo upload do mesmo livro.

### Métricas agregadas

| Métrica do plano | Cobertura MVP |
| --- | --- |
| `imports_started` / `completed` / `failed` / `chapters_detected` | ✅ Deriváveis grepando os eventos acima; backend de métricas (StatsD/APM) deliberadamente adiado — não existe infra de métricas no projeto e criar uma violaria "código simples" |

### Arquivos alterados nesta fase

| Arquivo | Mudança |
| --- | --- |
| `app/controllers/book_imports_controller.rb` | ➕ Logs `ready`/`confirmed`/`cancelled`; `record_failed_import` + helper `uploaded_filename` (fallback "unknown") |
| `test/controllers/book_imports_controller_test.rb` | ➕ Teste "records failed import for observability"; 🔧 Teste de formato rejeitado atualizado p/ novo comportamento (falha é registrada, nada fica `ready`) |

### Validação executada

```
bin/rails test        → 158 runs, 468 assertions, 0 failures
bin/rails test:system → 9 runs, 35 assertions, 0 failures
bundle exec rubocop app test → 54 files inspected, no offenses
```

---

## 🏁 Status Final do Plano

Todas as fases (1–17) executadas e validadas. MVP fechado conforme roadmap:

**TXT → Parser → Detecção (confidence) → Preview editável → Edição/Reordenação/Exclusão/Acréscimo → Confirmação transacional → Chapters**

| Entregue | Destaques |
| --- | --- |
| Pipeline determinístico sem IA | `ChapterImporter::` POROs, confidence 0.95/0.6, badge de revisão < 0.7 |
| Segurança em camadas | extensão + sniffing binário server-side + escape duplo + ownership em todas as ações |
| Integração zero-duplicação com editor | capítulos importados = chapters normais; callbacks existentes fazem contadores/sanitize/publicação |
| Qualidade | 158 unit/controller + 9 system tests verdes; RuboCop 54 files limpo |

Futuro (2ª etapa do plano): DOCX/PDF, drag & drop na prévia, divisão/mesclagem de capítulos, IA como camada opcional.
