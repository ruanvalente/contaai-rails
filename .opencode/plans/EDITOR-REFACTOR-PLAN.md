# EDITOR-REFACTOR.md

> **Plano técnico de refatoração do Editor de conteúdo/livros**
>
> Auditoria completa da implementação atual, diagnóstico de problemas, causas raiz e roadmap de correção.
>
> **Data da auditoria:** 11/08/2026
> **Stack:** Ruby on Rails 8.1, TailwindCSS 4, Hotwire (Turbo + Stimulus), Tiptap 3.29, PostgreSQL

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Fluxo Completo do Editor](#2-fluxo-completo-do-editor)
3. [Análise do Backend](#3-análise-do-backend)
4. [Análise do Frontend](#4-análise-do-frontend)
5. [Auditoria dos Comandos de Formatação](#5-auditoria-dos-comandos-de-formatação)
6. [Causa Raiz dos Problemas](#6-causa-raiz-dos-problemas)
7. [Modelo de Dados](#7-modelo-de-dados)
8. [Controllers e Fluxo HTTP](#8-controllers-e-fluxo-http)
9. [Persistência do Conteúdo](#9-persistência-do-conteúdo)
10. [Sanitização e Segurança](#10-sanitização-e-segurança)
11. [UX do Editor](#11-ux-do-editor)
12. [Auditoria da Toolbar](#12-auditoria-da-toolbar)
13. [Contadores](#13-contadores)
14. [Autosave](#14-autosave)
15. [Publicação](#15-publicação)
16. [Testes](#16-testes)
17. [Proposta de Arquitetura](#17-proposta-de-arquitetura)
18. [Plano de Refatoração por Fases](#18-plano-de-refatoração-por-fases)
19. [Matriz de Priorização](#19-matriz-de-priorização)
20. [Checklist de Implementação](#20-checklist-de-implementação)

---

## 1. Visão Geral da Arquitetura

### Stack do Editor

| Camada       | Tecnologia           | Versão |
| ------------ | -------------------- | ------ |
| Editor       | Tiptap (ProseMirror) | 3.29.0 |
| Framework JS | Stimulus             | 3.2.2  |
| Navegação    | Turbo (Hotwire)      | 8.0.23 |
| Backend      | Ruby on Rails        | 8.1.3  |
| CSS          | TailwindCSS          | 4.3.3  |
| Banco        | PostgreSQL           | —      |

### Arquivos Envolvidos

**Frontend (JavaScript/Stimulus):**

| Arquivo                                                   | Responsabilidade                        |
| --------------------------------------------------------- | --------------------------------------- |
| `app/javascript/controllers/editor_controller.js`         | Controlador principal do Tiptap         |
| `app/javascript/controllers/auto_save_controller.js`      | Autosave com debounce e beacon          |
| `app/javascript/controllers/chapter_panel_controller.js`  | Sidebar de capítulos, CRUD, reordenação |
| `app/javascript/controllers/word_count_controller.js`     | Contadores de palavras/caracteres       |
| `app/javascript/controllers/publish_controller.js`        | Modal de publicação e exclusão          |
| `app/javascript/controllers/editor_sidebar_controller.js` | Sidebar mobile                          |
| `app/javascript/controllers/confirm_modal_controller.js`  | Modal de confirmação global             |

**Views:**

| Arquivo                                     | Responsabilidade            |
| ------------------------------------------- | --------------------------- |
| `app/views/books/write.html.erb`            | Página principal do editor  |
| `app/views/books/read.html.erb`             | Página de leitura pública   |
| `app/views/books/_publish_modal.html.erb`   | Modal de publicação         |
| `app/views/books/_delete_modal.html.erb`    | Modal de exclusão           |
| `app/views/chapters/_chapter.json.jbuilder` | Serializer JSON de capítulo |

**Backend:**

| Arquivo                                  | Responsabilidade                         |
| ---------------------------------------- | ---------------------------------------- |
| `app/controllers/books_controller.rb`    | CRUD de livros, publish/unpublish, write |
| `app/controllers/chapters_controller.rb` | CRUD de capítulos, reorder               |
| `app/models/book.rb`                     | Model de livro                           |
| `app/models/chapter.rb`                  | Model de capítulo                        |
| `config/routes.rb`                       | Rotas                                    |
| `db/schema.rb`                           | Schema do banco                          |

---

## 2. Fluxo Completo do Editor

### Fluxo Atual (mapeado)

```text
UI (write.html.erb)
 ↓
Stimulus (editor_controller.js — Tiptap)
 ↓
Evento "editor:contentChanged" (CustomEvent)
 ↓
auto_save_controller.js (debounce 30s)
 ↓
HTTP PATCH /books/:book_id/chapters/:id
 ↓
ChaptersController#update
 ↓
Chapter#update (sem sanitização)
 ↓
PostgreSQL (chapters.content)
```

### Fluxo de Troca de Capítulo

```text
Clique no capítulo (chapter_panel_controller.js)
 ↓
Evento "chapter:selected"
 ↓
editor_controller.js#loadChapter
 ↓
auto_save_controller.js#save() (salva capítulo atual)
 ↓
GET /books/:book_id/chapters/:id (JSON)
 ↓
editor.commands.setContent(chapter.content)
 ↓
Evento "editor:chapterChanged"
 ↓
word_count_controller.js atualiza contadores
```

### Fluxo de Publicação

```text
Clique "Publicar" (publish_controller.js#open)
 ↓
auto_save_controller.js#save() (salva capítulo atual)
 ↓
Validações client-side (título, categoria, conteúdo)
 ↓
PATCH /books/:id/publish
 ↓
BooksController#publish
 ↓
Concatena capítulos: "## #{title}\n\n#{content}" (HTML + markdown)
 ↓
Book#update(status: :published, content: full_content)
 ↓
Redirect/reload
```

### Quebras Identificadas no Fluxo

1. **`underline()` quebra o editor** — chama `toggleUnderline()` sem a extensão `Underline` importada.
2. **`simple_format` destrói HTML na leitura** — o conteúdo publicado (HTML do Tiptap) é renderizado com `simple_format`, que escapa todas as tags HTML.
3. **Conteúdo misto markdown+HTML na publicação** — `## #{title}` é markdown, mas `content` é HTML.
4. **Sem sanitização no backend** — o HTML é salvo cru no banco.
5. **`prose` classes sem plugin typography** — o conteúdo do editor não tem estilos de tipografia.

---

## 3. Análise do Backend

### 3.1 Controllers

#### `BooksController`

| Action      | Rota                   | Método | Autorização | Params        | Response      |
| ----------- | ---------------------- | ------ | ----------- | ------------- | ------------- |
| `index`     | `/books`               | GET    | Público     | —             | HTML          |
| `show`      | `/books/:id`           | GET    | Público     | —             | HTML          |
| `new`       | `/books/new`           | GET    | Autenticado | —             | HTML          |
| `create`    | `/books`               | POST   | Autenticado | `book_params` | Redirect/HTML |
| `edit`      | `/books/:id/edit`      | GET    | Owner       | —             | HTML          |
| `update`    | `/books/:id`           | PATCH  | Owner       | `book_params` | Redirect/HTML |
| `destroy`   | `/books/:id`           | DELETE | Owner       | —             | HTML/JSON     |
| `publish`   | `/books/:id/publish`   | PATCH  | Owner       | —             | HTML/JSON     |
| `unpublish` | `/books/:id/unpublish` | PATCH  | Owner       | —             | Redirect      |
| `write`     | `/books/:id/write`     | GET    | Owner       | —             | HTML          |
| `read`      | `/books/:id/read`      | GET    | Público     | —             | HTML          |

**Problemas encontrados:**

- 🔴 **`publish` concatena markdown + HTML**: `full_content = @book.chapters.ordered.map { |c| "## #{c.title}\n\n#{c.content}" }.join("\n\n")` — o `content` é HTML do Tiptap, mas o `##` é markdown. O resultado é um formato híbrido que não é renderizado corretamente por `simple_format`.
- 🔴 **`publish` não verifica retorno de `update`**: `@book.update(...)` pode retornar `false` e o controller ainda responde sucesso.
- 🟠 **`write` sempre carrega o primeiro capítulo**: `@active_chapter = @chapters.first` — não há suporte para abrir um capítulo específico via URL.
- 🟡 **`book_params` permite `:content`**: O campo `content` do livro é permitido, mas o editor salva conteúdo em `chapters`, não em `books`. Isso é confuso e pode causar dados inconsistentes.

#### `ChaptersController`

| Action    | Rota                                   | Método | Autorização            | Params           | Response |
| --------- | -------------------------------------- | ------ | ---------------------- | ---------------- | -------- |
| `index`   | `/books/:book_id/chapters`             | GET    | Autenticado (qualquer) | —                | JSON     |
| `show`    | `/books/:book_id/chapters/:id`         | GET    | Autenticado (qualquer) | —                | JSON     |
| `create`  | `/books/:book_id/chapters`             | POST   | Owner                  | `chapter_params` | JSON     |
| `update`  | `/books/:book_id/chapters/:id`         | PATCH  | Owner                  | `chapter_params` | JSON     |
| `destroy` | `/books/:book_id/chapters/:id`         | DELETE | Owner                  | —                | 204      |
| `reorder` | `/books/:book_id/chapters/:id/reorder` | PATCH  | Owner                  | `position`       | JSON     |

**Problemas encontrados:**

- 🔴 **`index` e `show` sem verificação de ownership**: Qualquer usuário autenticado pode ler capítulos de qualquer livro via API JSON.
- 🔴 **Sem sanitização de `content`**: `chapter_params` permite `:content` sem sanitização. XSS vulnerável.
- 🟠 **`word_count` é aceito do cliente**: O frontend envia `word_count` e o backend confia cegamente. Um cliente malicioso pode enviar qualquer valor.
- 🟡 **`reorder` não valida limites de `position`**: `new_position = params[:position].to_i` — valores negativos ou muito grandes podem causar problemas.

### 3.2 Models

#### `Book`

```ruby
class Book < ApplicationRecord
  belongs_to :user
  has_one_attached :cover_image
  has_many :chapters, -> { order(position: :asc) }, dependent: :destroy
  has_many :ratings, dependent: :destroy
  has_many :favorites, dependent: :destroy
  has_many :reading_progresses, dependent: :destroy

  enum :category, { fiction: 0, non_fiction: 1, poetry: 2, essay: 3, short_story: 4, other: 5 }
  enum :status, { draft: 0, published: 1, archived: 2 }

  validates :title, presence: true
  validates :author_name, presence: true
  validates :category, presence: true

  def total_word_count
    chapters.sum(:word_count)
  end

  def has_chapters?
    chapters.any?
  end

  def publishable?
    title.present? && has_chapters? && chapters.sum(:word_count) > 0 && category.present?
  end
end
```

**Problemas:**

- 🟠 **`total_word_count` nunca é usado**: O método existe mas o código usa `chapters.sum(:word_count)` diretamente.
- 🟠 **`publishable?` depende de `word_count` client-side**: Se o cliente enviar `word_count: 0`, o livro não é publicável mesmo com conteúdo.
- 🟡 **Sem validação de `content`**: O campo `content` do livro não tem validação de presença ou formato.

#### `Chapter`

```ruby
class Chapter < ApplicationRecord
  belongs_to :book, touch: true

  validates :title, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :ordered, -> { order(position: :asc) }

  before_create :set_default_position
  after_save :recalculate_book_word_count
  after_destroy :recalculate_book_word_count, :reorder_positions

  private

  def set_default_position
    self.position ||= book.chapters.maximum(:position).to_i + 1
  end

  def recalculate_book_word_count
    total = book.chapters.sum(:word_count)
    book.update_column(:word_count, total)
  end

  def reorder_positions
    book.chapters.ordered.each_with_index do |chapter, index|
      chapter.update_column(:position, index) unless chapter.position == index
    end
  end
end
```

**Problemas:**

- 🟠 **`recalculate_book_word_count` usa `update_column`**: Bypassa validações e callbacks. Também é chamado em TODA atualização (incluindo rename de título), o que é desnecessário.
- 🟠 **`reorder_positions` usa `update_column`**: Bypassa callbacks. Se um capítulo tiver `after_save` que dependa de `position`, não será executado.
- 🟡 **Sem validação de `content`**: Conteúdo vazio é permitido.
- 🟡 **Sem validação de `word_count`**: O valor é aceito do cliente sem validação.

### 3.3 Routes

```ruby
resources :books do
  member do
    patch :publish
    patch :unpublish
    get :read
    get :write
  end

  resources :chapters, only: [ :index, :show, :create, :update, :destroy ] do
    member do
      patch :reorder
    end
  end
end
```

**Problemas:**

- 🟡 **`read` e `write` como member routes**: São ações de livro, mas poderiam ser mais RESTful como `books/:id/read` e `books/:id/write`. Funciona, mas não é ideal.
- 🟡 **Sem namespace para API**: As rotas JSON são misturadas com rotas HTML. Não há separação clara entre API e views.

### 3.4 Migrations e Schema

```ruby
create_table "public.books" do |t|
  t.string "author_name", null: false
  t.decimal "average_rating", precision: 3, scale: 2, default: "0.0"
  t.integer "category", null: false
  t.text "content"
  t.string "cover_color", limit: 7, default: "#8B4513", null: false
  t.datetime "created_at", null: false
  t.text "description"
  t.integer "page_count"
  t.datetime "published_at"
  t.integer "ratings_count", default: 0
  t.integer "status", default: 0, null: false
  t.string "title", null: false
  t.datetime "updated_at", null: false
  t.bigint "user_id", null: false
  t.integer "word_count", default: 0, null: false
end

create_table "public.chapters" do |t|
  t.bigint "book_id", null: false
  t.text "content"
  t.datetime "created_at", null: false
  t.integer "position", default: 0, null: false
  t.string "title", null: false
  t.datetime "updated_at", null: false
  t.integer "word_count", default: 0, null: false
end
```

**Problemas:**

- 🟡 **Sem `character_count`**: Não há campo para contagem de caracteres.
- 🟡 **Sem versionamento**: Não há histórico de versões do conteúdo.
- 🟡 **Sem `published_at` em chapters**: Não há rastreamento de quando um capítulo foi publicado.
- 🟡 **`books.content` é denormalizado**: O conteúdo completo é concatenado no campo `content` do livro na publicação. Isso pode ficar stale se capítulos forem editados após a publicação.

---

## 4. Análise do Frontend

### 4.1 `editor_controller.js` (Tiptap)

**Configuração atual:**

```javascript
this.editor = new Editor({
  element: this.contentTarget,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
  ],
  content: this.contentValue,
  editorProps: {
    attributes: {
      class:
        "prose prose-lg max-w-none focus:outline-none min-h-[60vh] px-8 py-6 font-reading text-[18px] leading-relaxed text-text-primary",
      "data-placeholder": "Comece a escrever sua história...",
    },
  },
  onUpdate: ({ editor }) => {
    this.dispatchContentChanged(editor);
  },
});
```

**Problemas encontrados:**

| #   | Problema                             | Severidade | Detalhe                                                                                                                                                                                        |
| --- | ------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`toggleUnderline()` sem extensão** | 🔴 Crítico | `underline()` chama `this.editor.chain().focus().toggleUnderline().run()` mas `Underline` não é importado. StarterKit NÃO inclui Underline. Isso lança erro no console e o botão não funciona. |
| 2   | **Sem `Placeholder` extension**      | 🟠 Alto    | O atributo `data-placeholder` é definido mas nenhuma extensão `Placeholder` é configurada. O placeholder nunca aparece.                                                                        |
| 3   | **Sem `onSelectionUpdate`**          | 🟠 Alto    | Não há handler para atualizar o estado ativo dos botões da toolbar quando a seleção muda.                                                                                                      |
| 4   | **Sem `onTransaction`**              | 🟡 Médio   | Não há handler para atualizar undo/redo disabled states.                                                                                                                                       |
| 5   | **`isActive()` nunca é chamado**     | 🟡 Médio   | O método existe mas não é usado em nenhum lugar.                                                                                                                                               |
| 6   | **`getChapterData()` nunca é usado** | 🟢 Baixo   | O método existe mas `auto_save_controller.js` tem sua própria implementação duplicada.                                                                                                         |
| 7   | **`contentValue` não é atualizado**  | 🟠 Alto    | Após `loadChapter`, `this.contentValue` não é atualizado. Se o controller reconectar (Turbo), o conteúdo antigo é restaurado.                                                                  |
| 8   | **`setTimeout` no `connect()`**      | 🟡 Médio   | `setTimeout(() => { this.dispatchContentChanged(this.editor) }, 0)` dispara `editor:contentChanged` no load, marcando o editor como dirty e potencialmente disparando autosave desnecessário.  |
| 9   | **Sem `Link` extension**             | 🟡 Médio   | Não há suporte a links no editor.                                                                                                                                                              |
| 10  | **Sem `TextAlign` extension**        | 🟢 Baixo   | Não há suporte a alinhamento.                                                                                                                                                                  |
| 11  | **Sem `CodeBlock` button**           | 🟢 Baixo   | StarterKit inclui CodeBlock mas não há botão na toolbar.                                                                                                                                       |
| 12  | **Sem `Strike` button**              | 🟢 Baixo   | StarterKit inclui Strike mas não há botão na toolbar.                                                                                                                                          |

### 4.2 `auto_save_controller.js`

**Problemas encontrados:**

| #   | Problema                                                | Severidade | Detalhe                                                                                                                                                                                          |
| --- | ------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`saveOnBeforeUnload` chama `event.preventDefault()`** | 🔴 Crítico | Isso mostra um diálogo de confirmação do browser ("Tem certeza que deseja sair?"). UX terrível. Deveria usar `sendBeacon` e NÃO prevenir default.                                                |
| 2   | **`saveOnTurboVisit` não previne a navegação**          | 🟠 Alto    | `saveViaBeacon()` é async, mas a navegação Turbo pode acontecer antes do beacon completar.                                                                                                       |
| 3   | **Race condition em `save()`**                          | 🟠 Alto    | `this.dirty = false` é setado ANTES do fetch completar. Se o fetch falhar, `dirty = true` é restaurado, mas se outra edição acontecer durante o fetch, `dirty` pode ser incorretamente resetado. |
| 4   | **Sem deduplicação de requests**                        | 🟠 Alto    | Múltiplos `save()` podem ser chamados concorrentemente (ex: debounce + publish#open). Não há tracking de request in-flight.                                                                      |
| 5   | **`editorController` via `setTimeout(0)`**              | 🟡 Médio   | `this.editorController` é obtido via `setTimeout(..., 0)`. Se o editor controller não estiver conectado ainda, `editorController` será `null` e autosave não funciona.                           |
| 6   | **Sem retry**                                           | 🟡 Médio   | Falhas de save não têm retry automático.                                                                                                                                                         |
| 7   | **`saveViaBeacon` com `URLSearchParams`**               | 🟡 Médio   | Envia HTML content como form-encoded. Pode ter problemas de encoding com caracteres especiais.                                                                                                   |
| 8   | **Sem feedback de "saving" no status bar**              | 🟢 Baixo   | O status "Salvando..." é mostrado mas não há indicador visual de progresso.                                                                                                                      |

### 4.3 `chapter_panel_controller.js`

**Problemas encontrados:**

| #   | Problema                                         | Severidade | Detalhe                                                                                                     |
| --- | ------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | **`saveNewOrder` envia requests sequenciais**    | 🟠 Alto    | Para cada capítulo, um PATCH individual é enviado. Ineficiente e propenso a falhas parciais.                |
| 2   | **Sem rollback em caso de falha de reordenação** | 🟠 Alto    | Se um PATCH falhar no meio, a ordem no DOM está alterada mas o backend está parcialmente atualizado.        |
| 3   | **`createChapterElement` usa `innerHTML`**       | 🟡 Médio   | O título é escapado com `escapeHtml`, mas o `word_count` é interpolado diretamente (é um número, então OK). |
| 4   | **Sem feedback visual de drag**                  | 🟢 Baixo   | Não há indicador visual de onde o item será dropado.                                                        |
| 5   | **Sem suporte a reordenação por teclado**        | 🟢 Baixo   | Não há atalhos de teclado para mover capítulos.                                                             |
| 6   | **`selectChapter` não atualiza `contentValue`**  | 🟡 Médio   | O editor controller não atualiza `this.contentValue` após trocar de capítulo.                               |

### 4.4 `word_count_controller.js`

**Problemas encontrados:**

| #   | Problema                                              | Severidade | Detalhe                                                                                                        |
| --- | ----------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | **`updateFromEvent` não atualiza charCount**          | 🟡 Médio   | O evento `editor:contentChanged` só inclui `wordCount` e `text`. O charCount é recalculado separadamente.      |
| 2   | **`updateFromDOM` é frágil**                          | 🟢 Baixo   | Parseia o texto do elemento DOM para extrair o word count. Quebra se o formato mudar.                          |
| 3   | **`updateSidebarWordCount` usa querySelector global** | 🟡 Médio   | `document.querySelector("[data-chapter-panel-target='list']")` — frágil se houver múltiplos editors na página. |
| 4   | **Duplicação de lógica de cálculo**                   | 🟡 Médio   | `calculateWordCount` existe em `editor_controller.js`, `auto_save_controller.js` e `word_count_controller.js`. |

### 4.5 `publish_controller.js`

**Problemas encontrados:**

| #   | Problema                                         | Severidade | Detalhe                                                                                                                     |
| --- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`confirm()` publica mesmo se autosave falhar** | 🟠 Alto    | `await autoSaveCtrl.save()` — se retornar `false`, o código continua e publica conteúdo potencialmente stale.               |
| 2   | **`open()` verifica `.text-success` no DOM**     | 🟡 Médio   | `titleOk = this.titleCheckTarget.querySelector(".text-success") !== null` — depende de classes CSS server-rendered. Frágil. |
| 3   | **Sem focus trap no modal**                      | 🟡 Médio   | O modal de publicação não prende o foco. Usuários de teclado podem tab para fora do modal.                                  |
| 4   | **Sem `aria-modal`**                             | 🟡 Médio   | O modal não tem `role="dialog"` nem `aria-modal="true"`.                                                                    |
| 5   | **`showToast` usa Flowbite Dismiss**             | 🟢 Baixo   | Dependência desnecessária do Flowbite para um toast simples.                                                                |

### 4.6 `editor_sidebar_controller.js`

**Problemas encontrados:**

| #   | Problema                                  | Severidade | Detalhe                                                       |
| --- | ----------------------------------------- | ---------- | ------------------------------------------------------------- |
| 1   | **Sem `role="dialog"` no sidebar mobile** | 🟡 Médio   | O sidebar mobile não tem `role="dialog"` nem `aria-modal`.    |
| 2   | **Sem focus trap no sidebar mobile**      | 🟡 Médio   | O foco não é preso dentro do sidebar quando aberto em mobile. |
| 3   | **`handleResize` não restaura foco**      | 🟢 Baixo   | Ao fechar o sidebar por resize, o foco não é restaurado.      |

### 4.7 `write.html.erb`

**Problemas encontrados:**

| #   | Problema                                         | Severidade | Detalhe                                                                                                                                                        |
| --- | ------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`data-editor-content-value` sem escape**       | 🔴 Crítico | `data-editor-content-value="<%= @active_chapter&.content %>"` — se o conteúdo contiver aspas `"`, o atributo HTML quebra. Deve usar `CGI.escapeHTML` ou JSON.  |
| 2   | **`data-editor-chapter-title-value` sem escape** | 🔴 Crítico | Mesmo problema com o título.                                                                                                                                   |
| 3   | **Sem `@tailwindcss/typography`**                | 🔴 Crítico | As classes `prose prose-lg` são usadas no editor e na página de leitura, mas o plugin typography NÃO está instalado. O conteúdo não tem estilos de tipografia. |
| 4   | **Toolbar sem `role="toolbar"`**                 | 🟡 Médio   | A toolbar não tem `role="toolbar"` nem `aria-label`.                                                                                                           |
| 5   | **Botões sem `aria-pressed`**                    | 🟡 Médio   | Botões toggle (bold, italic, H1, etc.) não têm `aria-pressed`.                                                                                                 |
| 6   | **Botões sem `aria-label`**                      | 🟡 Médio   | A maioria dos botões usa `title` em vez de `aria-label`. `title` não é suficiente para acessibilidade.                                                         |
| 7   | **Sem `aria-live` no status bar**                | 🟡 Médio   | O status de salvamento (`data-save-status`) não tem `aria-live="polite"`.                                                                                      |
| 8   | **Sem `aria-keyshortcuts`**                      | 🟢 Baixo   | Os botões mencionam atalhos no `title` mas não têm `aria-keyshortcuts`.                                                                                        |
| 9   | **Sem keyboard navigation na toolbar**           | 🟡 Médio   | Não há suporte a navegação por setas entre botões da toolbar.                                                                                                  |
| 10  | **`<style>` inline no template**                 | 🟢 Baixo   | Animações `slideDown`/`slideUp` estão inline no template. Deveriam estar no stylesheet.                                                                        |
| 11  | **Editor sem `aria-label`**                      | 🟡 Médio   | O contenteditable do Tiptap não tem `aria-label` ou `aria-describedby`.                                                                                        |
| 12  | **Sem `aria-disabled` em undo/redo**             | 🟢 Baixo   | Os botões undo/redo não têm estado disabled.                                                                                                                   |
| 13  | **Layout dentro do layout authenticated**        | 🟡 Médio   | O editor é renderizado dentro do layout `authenticated` que tem sidebar e header. O editor não é full-screen.                                                  |

---

## 5. Auditoria dos Comandos de Formatação

### Legenda

- ✅ Funciona corretamente
- ⚠️ Parcialmente funcional / com problemas
- ❌ Não funciona / não implementado
- N/A Não aplicável

### Tabela de Diagnóstico

| Comando            | UI  | Evento | Execução | HTML | Persistência | Reload | Teste | Status                                       |
| ------------------ | --- | ------ | -------- | ---- | ------------ | ------ | ----- | -------------------------------------------- |
| H1                 | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| H2                 | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| H3                 | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| Parágrafo          | ❌  | ❌     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 Não existe botão                          |
| Negrito            | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| Itálico            | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| Sublinhado         | ✅  | ✅     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 **Quebrado** — extensão não importada     |
| Tachado            | ❌  | ❌     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 Não existe botão                          |
| Lista ordenada     | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| Lista não ordenada | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| Blockquote         | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona, sem estado ativo                |
| Links              | ❌  | ❌     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 Não implementado                          |
| Alinhamento        | ❌  | ❌     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 Não implementado                          |
| Indentação         | ❌  | ❌     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 Não implementado                          |
| Outdentação        | ❌  | ❌     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 Não implementado                          |
| Código/code block  | ❌  | ❌     | ❌       | ❌   | ❌           | ❌     | ❌    | 🔴 Sem botão (extensão existe no StarterKit) |
| Separador (HR)     | ✅  | ✅     | ✅       | ✅   | ✅           | ✅     | ❌    | ⚠️ Funciona                                  |
| Undo               | ✅  | ✅     | ✅       | ✅   | N/A          | N/A    | ❌    | ⚠️ Funciona, sem disabled state              |
| Redo               | ✅  | ✅     | ✅       | ✅   | N/A          | N/A    | ❌    | ⚠️ Funciona, sem disabled state              |

### Análise Detalhada por Comando

#### H1 / H2 / H3

- **Botão existe na UI?** ✅ Sim, na toolbar.
- **Evento associado?** ✅ `data-action="click->editor#heading1"` etc.
- **JavaScript responsável?** ✅ `editor_controller.js` → `heading1()`, `heading2()`, `heading3()`.
- **Comando executado?** ✅ `this.editor.chain().focus().toggleHeading({ level: 1 }).run()`.
- **Alteração visual imediata?** ⚠️ Sim, mas sem estilos `prose` (plugin typography ausente), o H1 pode não parecer diferente.
- **Refletido no HTML?** ✅ Tiptap gera `<h1>`, `<h2>`, `<h3>`.
- **Persistido no backend?** ✅ O HTML é salvo via autosave.
- **Continua após reload?** ✅ O HTML é carregado de volta no editor.
- **Funciona com seleção?** ✅ `toggleHeading` funciona com seleção.
- **Funciona sem seleção?** ✅ Aplica ao bloco atual.
- **Estado ativo atualizado?** ❌ Não. Não há `onSelectionUpdate` para atualizar `aria-pressed`.
- **Consistente entre browsers?** ✅ Tiptap abstrai as diferenças.
- **Erros no console?** ❌ Nenhum para H1/H2/H3.
- **Erros no Rails log?** ❌ Nenhum.
- **Testes cobrindo?** ❌ Nenhum teste existe.

#### Sublinhado (Underline)

- **Botão existe na UI?** ✅ Sim.
- **Evento associado?** ✅ `data-action="click->editor#underline"`.
- **JavaScript responsável?** ✅ `editor_controller.js` → `underline()`.
- **Comando executado?** ❌ **NÃO.** `this.editor.chain().focus().toggleUnderline().run()` — a extensão `Underline` NÃO é importada. StarterKit não inclui Underline. Isso lança `Error: Cannot read properties of undefined (reading 'run')` ou similar no console.
- **Alteração visual imediata?** ❌ Não.
- **Refletido no HTML?** ❌ Não.
- **Persistido no backend?** ❌ Não.
- **Continua após reload?** ❌ Não.
- **Funciona com seleção?** ❌ Não.
- **Funciona sem seleção?** ❌ Não.
- **Estado ativo atualizado?** ❌ Não.
- **Consistente entre browsers?** ❌ Não aplicável.
- **Erros no console?** ✅ Sim — erro de comando inexistente.
- **Erros no Rails log?** ❌ Nenhum (erro é client-side).
- **Testes cobrindo?** ❌ Nenhum.

#### Links

- **Botão existe na UI?** ❌ Não há botão de link na toolbar.
- **Evento associado?** ❌ Não.
- **JavaScript responsável?** ❌ Não.
- **Comando executado?** ❌ Não.
- **Alteração visual imediata?** ❌ Não.
- **Refletido no HTML?** ❌ Não.
- **Persistido no backend?** ❌ Não.
- **Continua após reload?** ❌ Não.
- **Funciona com seleção?** ❌ Não.
- **Funciona sem seleção?** ❌ Não.
- **Estado ativo atualizado?** ❌ Não.
- **Consistente entre browsers?** ❌ Não aplicável.
- **Erros no console?** ❌ Nenhum (não há código).
- **Erros no Rails log?** ❌ Nenhum.
- **Testes cobrindo?** ❌ Nenhum.

#### Parágrafo

- **Botão existe na UI?** ❌ Não há botão "Parágrafo" na toolbar.
- **Evento associado?** ❌ Não.
- **JavaScript responsável?** ❌ Não.
- **Comando executado?** ❌ Não.
- **Alteração visual imediata?** ❌ Não.
- **Refletido no HTML?** ❌ Não.
- **Persistido no backend?** ❌ Não.
- **Continua após reload?** ❌ Não.
- **Funciona com seleção?** ❌ Não.
- **Funciona sem seleção?** ❌ Não.
- **Estado ativo atualizado?** ❌ Não.
- **Consistente entre browsers?** ❌ Não aplicável.
- **Erros no console?** ❌ Nenhum.
- **Erros no Rails log?** ❌ Nenhum.
- **Testes cobrindo?** ❌ Nenhum.

#### Tachado (Strike)

- **Botão existe na UI?** ❌ Não há botão de tachado na toolbar.
- **Evento associado?** ❌ Não.
- **JavaScript responsável?** ❌ Não.
- **Comando executado?** ❌ Não.
- **Alteração visual imediata?** ❌ Não.
- **Refletido no HTML?** ❌ Não.
- **Persistido no backend?** ❌ Não.
- **Continua após reload?** ❌ Não.
- **Funciona com seleção?** ❌ Não.
- **Funciona sem seleção?** ❌ Não.
- **Estado ativo atualizado?** ❌ Não.
- **Consistente entre browsers?** ❌ Não aplicável.
- **Erros no console?** ❌ Nenhum.
- **Erros no Rails log?** ❌ Nenhum.
- **Testes cobrindo?** ❌ Nenhum.

#### Alinhamento, Indentação, Outdentação

- **Botão existe na UI?** ❌ Não há botões de alinhamento, indentação ou outdentação.
- **Evento associado?** ❌ Não.
- **JavaScript responsável?** ❌ Não.
- **Comando executado?** ❌ Não.
- **Alteração visual imediata?** ❌ Não.
- **Refletido no HTML?** ❌ Não.
- **Persistido no backend?** ❌ Não.
- **Continua após reload?** ❌ Não.
- **Funciona com seleção?** ❌ Não.
- **Funciona sem seleção?** ❌ Não.
- **Estado ativo atualizado?** ❌ Não.
- **Consistente entre browsers?** ❌ Não aplicável.
- **Erros no console?** ❌ Nenhum.
- **Erros no Rails log?** ❌ Nenhum.
- **Testes cobrindo?** ❌ Nenhum.

#### Código / Code Block

- **Botão existe na UI?** ❌ Não há botão de código na toolbar.
- **Evento associado?** ❌ Não.
- **JavaScript responsável?** ❌ Não.
- **Comando executado?** ❌ Não.
- **Alteração visual imediata?** ❌ Não.
- **Refletido no HTML?** ❌ Não.
- **Persistido no backend?** ❌ Não.
- **Continua após reload?** ❌ Não.
- **Funciona com seleção?** ❌ Não.
- **Funciona sem seleção?** ❌ Não.
- **Estado ativo atualizado?** ❌ Não.
- **Consistente entre browsers?** ❌ Não aplicável.
- **Erros no console?** ❌ Nenhum.
- **Erros no Rails log?** ❌ Nenhum.
- **Testes cobrindo?** ❌ Nenhum.

---

## 6. Causa Raiz dos Problemas

### 6.1 Sublinhado quebrado

**Sintoma:** Clicar no botão "U" não faz nada (ou lança erro no console).

**Causa raiz:** `editor_controller.js` linha 68 chama `this.editor.chain().focus().toggleUnderline().run()`, mas a extensão `Underline` do Tiptap não é importada nem configurada. O StarterKit do Tiptap NÃO inclui a extensão `Underline` por padrão.

**Arquivo:** `app/javascript/controllers/editor_controller.js`

**Correção:** Importar `@tiptap/extension-underline` e adicionar à lista de extensions.

### 6.2 Conteúdo não renderiza na página de leitura

**Sintoma:** O conteúdo publicado mostra tags HTML cruas (ex: `<h1>`, `<ul>`, `<strong>`) em vez de formatação.

**Causa raiz:** `read.html.erb` usa `simple_format(@book.content)` que escapa todas as tags HTML e converte quebras de linha em `<br>`/`<p>`. O conteúdo armazenado é HTML do Tiptap, não texto puro.

**Arquivo:** `app/views/books/read.html.erb`

**Correção:** Usar `sanitize(@book.content, tags: [...])` ou `raw` com sanitização adequada. Instalar `@tailwindcss/typography` para estilizar o conteúdo.

### 6.3 Conteúdo misto markdown + HTML na publicação

**Sintoma:** O campo `books.content` contém `## Título do Capítulo` (markdown) concatenado com HTML do Tiptap.

**Causa raiz:** `BooksController#publish` linha 83: `full_content = @book.chapters.ordered.map { |c| "## #{c.title}\n\n#{c.content}" }.join("\n\n")`.

**Arquivo:** `app/controllers/books_controller.rb`

**Correção:** Gerar HTML válido para o título do capítulo (ex: `<h2>#{c.title}</h2>`) ou usar uma estrutura de dados JSON.

### 6.4 Sem estilos de tipografia (prose)

**Sintoma:** O conteúdo do editor e da página de leitura não tem estilos para headings, listas, blockquotes, etc.

**Causa raiz:** As classes `prose prose-lg` são usadas mas o plugin `@tailwindcss/typography` NÃO está instalado no `package.json`.

**Arquivo:** `package.json`, `app/assets/stylesheets/application.tailwind.css`

**Correção:** Instalar `@tailwindcss/typography` e adicionar `@plugin "@tailwindcss/typography"` no CSS.

### 6.5 XSS — sem sanitização no backend

**Sintoma:** Qualquer HTML é aceito e salvo no banco.

**Causa raiz:** `ChaptersController#chapter_params` permite `:content` sem sanitização. O HTML é salvo cru.

**Arquivo:** `app/controllers/chapters_controller.rb`

**Correção:** Sanitizar o HTML no backend com `Rails::HTML5::SafeListSanitizer` ou `sanitize` no model.

### 6.6 `data-editor-content-value` quebra com aspas

**Sintoma:** Se o conteúdo do capítulo contiver aspas `"`, o atributo HTML `data-editor-content-value` quebra, e o editor não carrega o conteúdo corretamente.

**Causa raiz:** `write.html.erb` linha 8: `data-editor-content-value="<%= @active_chapter&.content %>"` — o HTML é interpolado diretamente no atributo sem escape.

**Arquivo:** `app/views/books/write.html.erb`

**Correção:** Usar `CGI.escapeHTML` ou passar o conteúdo via JSON.

### 6.7 Autosave com race conditions

**Sintoma:** Conteúdo pode ser perdido ou sobrescrito em cenários de navegação rápida.

**Causa raiz:** `auto_save_controller.js` — `dirty` é resetado antes do fetch completar; `saveOnBeforeUnload` previne default; `saveOnTurboVisit` não previne navegação.

**Arquivo:** `app/javascript/controllers/auto_save_controller.js`

**Correção:** Implementar tracking de request in-flight, usar `sendBeacon` sem `preventDefault`, e aguardar save antes de navegar.

### 6.8 Sem estado ativo na toolbar

**Sintoma:** Os botões da toolbar não indicam se o formato está ativo (ex: se o cursor está em um H1, o botão H1 não fica destacado).

**Causa raiz:** Não há `onSelectionUpdate` no Tiptap para atualizar o estado dos botões.

**Arquivo:** `app/javascript/controllers/editor_controller.js`

**Correção:** Adicionar `onSelectionUpdate` e `onTransaction` handlers que atualizam `aria-pressed` nos botões.

### 6.9 Sem placeholder

**Sintoma:** O texto "Comece a escrever sua história..." nunca aparece quando o editor está vazio.

**Causa raiz:** O atributo `data-placeholder` é definido mas a extensão `Placeholder` do Tiptap não é importada.

**Arquivo:** `app/javascript/controllers/editor_controller.js`

**Correção:** Importar `@tiptap/extension-placeholder` e configurar.

### 6.10 Sem testes

**Sintoma:** Nenhuma garantia de que o editor funciona.

**Causa raiz:** Não existe diretório `test/` ou `spec/` no projeto.

**Correção:** Criar testes de model, controller, request, system e JS.

---

## 7. Modelo de Dados

### 7.1 Tabelas Relacionadas

```
users
  ├── books (user_id)
  │     ├── chapters (book_id)
  │     ├── ratings (book_id)
  │     ├── favorites (book_id)
  │     └── reading_progresses (book_id)
  ├── author_follows (author_id, follower_id)
  └── user_reading_preferences (user_id)
```

### 7.2 Campos Relevantes

| Tabela     | Campo          | Tipo     | Observação                                                     |
| ---------- | -------------- | -------- | -------------------------------------------------------------- |
| `books`    | `content`      | text     | Conteúdo concatenado na publicação (HTML + markdown misturado) |
| `books`    | `word_count`   | integer  | Denormalizado, atualizado via callback do Chapter              |
| `books`    | `status`       | integer  | 0=draft, 1=published, 2=archived                               |
| `books`    | `published_at` | datetime | Data de publicação                                             |
| `chapters` | `content`      | text     | HTML do Tiptap                                                 |
| `chapters` | `word_count`   | integer  | Enviado pelo cliente, não validado                             |
| `chapters` | `position`     | integer  | Ordem do capítulo                                              |

### 7.3 Problemas de Modelagem

| #   | Problema                                           | Impacto    | Sugestão                                 |
| --- | -------------------------------------------------- | ---------- | ---------------------------------------- |
| 1   | `books.content` é denormalizado e mistura formatos | 🔴 Crítico | Recalcular na publicação com HTML válido |
| 2   | `chapters.word_count` é client-side                | 🟠 Alto    | Recalcular no backend                    |
| 3   | Sem `character_count`                              | 🟡 Médio   | Adicionar campo ou calcular on-the-fly   |
| 4   | Sem versionamento                                  | 🟡 Médio   | Considerar `paper_trail` ou similar      |
| 5   | Sem `published_at` em chapters                     | 🟢 Baixo   | Adicionar se necessário                  |

---

## 8. Controllers e Fluxo HTTP

### 8.1 Endpoints do Editor

| Route                                  | Método | Controller#Action  | Params                                               | Response  |
| -------------------------------------- | ------ | ------------------ | ---------------------------------------------------- | --------- |
| `/books/:id/write`                     | GET    | `books#write`      | `id`                                                 | HTML      |
| `/books/:book_id/chapters`             | GET    | `chapters#index`   | `book_id`                                            | JSON      |
| `/books/:book_id/chapters/:id`         | GET    | `chapters#show`    | `book_id, id`                                        | JSON      |
| `/books/:book_id/chapters`             | POST   | `chapters#create`  | `book_id, chapter[title], chapter[position]`         | JSON 201  |
| `/books/:book_id/chapters/:id`         | PATCH  | `chapters#update`  | `book_id, id, chapter[content], chapter[word_count]` | JSON      |
| `/books/:book_id/chapters/:id`         | DELETE | `chapters#destroy` | `book_id, id`                                        | 204       |
| `/books/:book_id/chapters/:id/reorder` | PATCH  | `chapters#reorder` | `book_id, id, position`                              | JSON      |
| `/books/:id/publish`                   | PATCH  | `books#publish`    | `id`                                                 | JSON/HTML |
| `/books/:id/unpublish`                 | PATCH  | `books#unpublish`  | `id`                                                 | Redirect  |
| `/books/:id`                           | DELETE | `books#destroy`    | `id`                                                 | JSON/HTML |

### 8.2 Inconsistências Frontend ↔ Backend

| #   | Frontend                                                                     | Backend                                                 | Problema                              |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| 1   | Envia `chapter[content]` como HTML                                           | Aceita sem sanitização                                  | XSS                                   |
| 2   | Envia `chapter[word_count]`                                                  | Aceita sem validação                                    | Dados incorretos                      |
| 3   | `publish_controller.js` chama `autoSaveCtrl.save()` antes de publicar        | `books#publish` não verifica se o save foi bem-sucedido | Publica conteúdo stale                |
| 4   | `chapter_panel_controller.js` envia PATCH individual por capítulo no reorder | `chapters#reorder` atualiza posições                    | Ineficiente, sem transação            |
| 5   | `editor_controller.js#loadChapter` faz GET do capítulo                       | `chapters#show` não verifica ownership                  | Qualquer usuário autenticado pode ler |

---

## 9. Persistência do Conteúdo

### 9.1 Fluxo de Persistência

```text
Usuário digita no editor
 ↓
Tiptap gera HTML (ex: <h1>Capítulo</h1><p>Texto</p>)
 ↓
editor:contentChanged event
 ↓
auto_save_controller.js#markDirty
 ↓
Debounce 30s
 ↓
PATCH /books/:id/chapters/:id
  body: { chapter: { content: "<h1>...</h1>", word_count: 5 } }
 ↓
ChaptersController#update
 ↓
Chapter#update (sem sanitização)
 ↓
PostgreSQL
```

### 9.2 Verificação do Fluxo

| Etapa                      | Funciona? | Observação                                                  |
| -------------------------- | --------- | ----------------------------------------------------------- |
| Usuário seleciona texto    | ✅        | Tiptap gerencia seleção                                     |
| Clica em H1                | ✅        | `toggleHeading` funciona                                    |
| Editor altera DOM          | ✅        | Tiptap atualiza DOM                                         |
| HTML é atualizado          | ✅        | `editor.getHTML()` retorna HTML correto                     |
| Autosave/Save              | ✅        | PATCH é enviado                                             |
| Controller recebe conteúdo | ✅        | `chapter_params` aceita `content`                           |
| Model salva conteúdo       | ✅        | `Chapter#update` persiste                                   |
| Página é recarregada       | ✅        | `editor_controller.js#connect` carrega `contentValue`       |
| H1 continua existindo      | ⚠️        | No editor sim, mas na página de leitura NÃO (simple_format) |

### 9.3 Onde o Fluxo Quebra

1. **Na página de leitura**: `simple_format` destrói o HTML.
2. **Na publicação**: `## #{title}` mistura markdown com HTML.
3. **No `data-editor-content-value`**: aspas no conteúdo quebram o atributo.
4. **No autosave**: race conditions podem perder conteúdo.

---

## 10. Sanitização e Segurança

### 10.1 Estado Atual

| Aspecto                             | Status        | Detalhe                                                                  |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------ |
| Sanitização de HTML no backend      | ❌            | Nenhuma sanitização em `ChaptersController`                              |
| Sanitização de HTML no model        | ❌            | Nenhuma sanitização em `Chapter`                                         |
| Sanitização de HTML na renderização | ⚠️            | `simple_format` escapa tudo (seguro mas quebra formatação)               |
| XSS                                 | 🔴 Vulnerável | HTML é salvo cru e pode conter `<script>`                                |
| Tags permitidas                     | ❌            | Nenhuma lista de tags permitidas                                         |
| Atributos permitidos                | ❌            | Nenhuma lista de atributos permitidos                                    |
| URLs                                | ❌            | Nenhuma validação de URLs                                                |
| Links externos                      | ❌            | Nenhum tratamento                                                        |
| `html_safe`                         | ⚠️            | Usado em `navigation_helper.rb` para SVGs (seguro, paths são constantes) |
| `sanitize`                          | ❌            | Não usado em nenhum lugar                                                |
| CSP                                 | ⚠️            | Comentado no initializer — não ativo                                     |

### 10.2 Riscos

1. **XSS via conteúdo**: Um usuário pode salvar `<script>alert('xss')</script>` no conteúdo do capítulo. Se renderizado com `raw` ou `html_safe`, executa no browser de outros usuários.
2. **XSS via título**: O título do capítulo é escapado no frontend (`escapeHtml`), mas não há sanitização no backend.
3. **CSP desativado**: O Content Security Policy está comentado no initializer.

### 10.3 Recomendações

1. **Sanitizar no backend**: Usar `Rails::HTML5::SafeListSanitizer` no model `Chapter` para permitir apenas tags seguras (`h1-h6`, `p`, `strong`, `em`, `u`, `s`, `ul`, `ol`, `li`, `blockquote`, `a`, `code`, `pre`, `hr`, `br`).
2. **Sanitizar na renderização**: Usar `sanitize(@book.content, tags: [...], attributes: [...])` na página de leitura.
3. **Ativar CSP**: Descomentar e configurar o Content Security Policy.
4. **Validar URLs**: Permitir apenas `http`, `https`, `mailto` em links.
5. **Não remover sanitização**: A solução deve permitir formatação rica SEM comprometer a segurança.

---

## 11. UX do Editor

### 11.1 Problemas de UX

| #   | Problema                                     | Severidade | Detalhe                                                                    |
| --- | -------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| 1   | **Sem feedback de estado ativo na toolbar**  | 🟠 Alto    | Usuário não sabe se o texto está em negrito, H1, etc.                      |
| 2   | **Sem placeholder**                          | 🟡 Médio   | Editor vazio não mostra instrução                                          |
| 3   | **Sem feedback de erro no autosave**         | 🟡 Médio   | "Erro ao salvar" aparece mas sem detalhes ou retry                         |
| 4   | **`beforeunload` mostra diálogo do browser** | 🔴 Crítico | "Tem certeza que deseja sair?" — UX terrível                               |
| 5   | **Sem undo/redo disabled states**            | 🟢 Baixo   | Botões sempre habilitados mesmo sem histórico                              |
| 6   | **Sem atalhos de teclado customizados**      | 🟡 Médio   | StarterKit tem atalhos padrão (Ctrl+B, Ctrl+I) mas não há indicação visual |
| 7   | **Sem suporte a links**                      | 🟡 Médio   | Usuário não pode adicionar links                                           |
| 8   | **Sem suporte a tachado**                    | 🟢 Baixo   | Não há botão de tachado                                                    |
| 9   | **Sem suporte a código**                     | 🟢 Baixo   | Não há botão de code block                                                 |
| 10  | **Sem suporte a alinhamento**                | 🟢 Baixo   | Não há botões de alinhamento                                               |
| 11  | **Sem suporte a indentação**                 | 🟢 Baixo   | Não há botões de indentação                                                |
| 12  | **Sem suporte a parágrafo**                  | 🟡 Médio   | Não há botão para voltar a parágrafo normal                                |
| 13  | **Sem feedback de "saving"**                 | 🟢 Baixo   | O status "Salvando..." é mostrado mas sem indicador visual                 |
| 14  | **Sem mensagem de sucesso**                  | 🟢 Baixo   | "Salvo automaticamente às HH:MM" é mostrado mas sem destaque               |
| 15  | **Sem tratamento de erro de conexão**        | 🟡 Médio   | "Erro ao salvar" sem retry automático                                      |

### 11.2 Acessibilidade

| #   | Problema                               | Severidade | Detalhe                                              |
| --- | -------------------------------------- | ---------- | ---------------------------------------------------- |
| 1   | **Toolbar sem `role="toolbar"`**       | 🟡 Médio   | Screen readers não identificam a toolbar             |
| 2   | **Botões sem `aria-pressed`**          | 🟡 Médio   | Botões toggle não indicam estado                     |
| 3   | **Botões sem `aria-label`**            | 🟡 Médio   | `title` não é suficiente                             |
| 4   | **Sem `aria-live` no status**          | 🟡 Médio   | Screen readers não anunciam status de salvamento     |
| 5   | **Sem keyboard navigation na toolbar** | 🟡 Médio   | Não há navegação por setas                           |
| 6   | **Editor sem `aria-label`**            | 🟡 Médio   | Screen readers não identificam o editor              |
| 7   | **Modal sem focus trap**               | 🟡 Médio   | Usuários de teclado podem tab para fora              |
| 8   | **Modal sem `aria-modal`**             | 🟡 Médio   | Screen readers não sabem que é um modal              |
| 9   | **Sidebar mobile sem `role="dialog"`** | 🟡 Médio   | Screen readers não identificam o sidebar como dialog |
| 10  | **Sem `aria-keyshortcuts`**            | 🟢 Baixo   | Atalhos não são anunciados                           |

### 11.3 Responsividade

| #   | Problema                                  | Severidade | Detalhe                                                                |
| --- | ----------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| 1   | **Toolbar com overflow-x-auto**           | 🟢 Baixo   | Funciona mas sem indicador de scroll                                   |
| 2   | **Editor dentro do layout authenticated** | 🟡 Médio   | O editor não é full-screen, tem sidebar e header                       |
| 3   | **Sidebar mobile com overlay**            | ✅         | Funciona corretamente                                                  |
| 4   | **Touch support**                         | 🟡 Médio   | Tiptap suporta touch, mas a toolbar pode ser difícil de usar em mobile |

---

## 12. Auditoria da Toolbar

### 12.1 Botões Existentes

| #   | Botão              | Função             | Implementação                                   | Evento | Estado Ativo | Feedback | Compatibilidade | Problemas                  | Prioridade |
| --- | ------------------ | ------------------ | ----------------------------------------------- | ------ | ------------ | -------- | --------------- | -------------------------- | ---------- |
| 1   | **B**              | Negrito            | `editor#bold` → `toggleBold()`                  | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 2   | **I**              | Itálico            | `editor#italic` → `toggleItalic()`              | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 3   | **U**              | Sublinhado         | `editor#underline` → `toggleUnderline()`        | ✅     | ❌           | ❌       | ❌              | **Extensão não importada** | 🔴         |
| 4   | **H1**             | Título 1           | `editor#heading1` → `toggleHeading({level:1})`  | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 5   | **H2**             | Título 2           | `editor#heading2` → `toggleHeading({level:2})`  | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 6   | **H3**             | Título 3           | `editor#heading3` → `toggleHeading({level:3})`  | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 7   | **Lista**          | Lista não ordenada | `editor#bulletList` → `toggleBulletList()`      | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 8   | **Lista Ordenada** | Lista ordenada     | `editor#orderedList` → `toggleOrderedList()`    | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 9   | **Citação**        | Blockquote         | `editor#blockquote` → `toggleBlockquote()`      | ✅     | ❌           | ⚠️       | ✅              | Sem `aria-pressed`         | 🟡         |
| 10  | **Separador**      | HR                 | `editor#horizontalRule` → `setHorizontalRule()` | ✅     | N/A          | ✅       | ✅              | —                          | 🟢         |
| 11  | **Undo**           | Desfazer           | `editor#undo` → `undo()`                        | ✅     | N/A          | ✅       | ✅              | Sem disabled state         | 🟢         |
| 12  | **Redo**           | Refazer            | `editor#redo` → `redo()`                        | ✅     | N/A          | ✅       | ✅              | Sem disabled state         | 🟢         |

### 12.2 Botões Faltantes

| #   | Botão       | Função                       | Prioridade |
| --- | ----------- | ---------------------------- | ---------- |
| 1   | Parágrafo   | Voltar para parágrafo normal | 🟡         |
| 2   | Tachado     | Strike                       | 🟢         |
| 3   | Link        | Adicionar link               | 🟡         |
| 4   | Código      | Code block                   | 🟢         |
| 5   | Alinhamento | Esquerda/Centro/Direita      | 🟢         |
| 6   | Indentação  | Aumentar/Diminuir indent     | 🟢         |

### 12.3 Acessibilidade da Toolbar

| Aspecto                         | Status               |
| ------------------------------- | -------------------- |
| `role="toolbar"`                | ❌                   |
| `aria-label` nos botões         | ❌ (usa `title`)     |
| `aria-pressed` em botões toggle | ❌                   |
| `aria-keyshortcuts`             | ❌                   |
| Keyboard navigation (setas)     | ❌                   |
| Focus state visível             | ⚠️ (hover apenas)    |
| Disabled states                 | ❌ (undo/redo)       |
| Tooltip                         | ⚠️ (`title` nativo)  |
| Mobile behavior                 | ⚠️ (overflow-x-auto) |

---

## 13. Contadores

### 13.1 Word Count

| Aspecto                | Status     | Detalhe                                            |
| ---------------------- | ---------- | -------------------------------------------------- |
| Onde é calculado       | Frontend   | `editor_controller.js` e `auto_save_controller.js` |
| Quando é atualizado    | Tempo real | Via `editor:contentChanged` event                  |
| Salvo no banco         | ✅         | `chapters.word_count`                              |
| Recalculado no backend | ❌         | Backend confia no valor do cliente                 |
| Frontend vs Backend    | ⚠️         | Podem divergir se o cliente enviar valor incorreto |
| HTML considerado       | ❌         | Usa `editor.getText()` que extrai texto puro       |

### 13.2 Character Count

| Aspecto                | Status     | Detalhe                           |
| ---------------------- | ---------- | --------------------------------- |
| Onde é calculado       | Frontend   | `word_count_controller.js`        |
| Quando é atualizado    | Tempo real | Via `editor:contentChanged` event |
| Salvo no banco         | ❌         | Não há campo `character_count`    |
| Recalculado no backend | ❌         | Não existe                        |
| Frontend vs Backend    | N/A        | Não há backend                    |
| HTML considerado       | ❌         | Usa `editor.getText()`            |

### 13.3 Problemas

1. **Word count é client-side e confiável**: Um usuário pode manipular o valor.
2. **Duplicação de lógica**: `calculateWordCount` existe em 3 controllers.
3. **Sem `character_count` no banco**: Não há persistência.
4. **`updateFromDOM` é frágil**: Parseia texto do DOM.

### 13.4 Estratégia Proposta

1. **Recalcular no backend**: No model `Chapter`, adicionar callback `before_save` que recalcula `word_count` a partir do `content` (extraindo texto puro do HTML).
2. **Adicionar `character_count`**: Se necessário, adicionar campo e recalcular no backend.
3. **Centralizar lógica**: Criar um helper JS único para cálculo de word count.
4. **Remover `updateFromDOM`**: Substituir por leitura direta do editor.

---

## 14. Autosave

### 14.1 Estado Atual

| Aspecto               | Status       | Detalhe                                                 |
| --------------------- | ------------ | ------------------------------------------------------- |
| Quando é disparado    | Debounce 30s | `data-auto-save-debounce-ms-value="30000"`              |
| Debounce/throttle     | ✅           | `setTimeout` com 30s                                    |
| Endpoint              | ✅           | `PATCH /books/:id/chapters/:id`                         |
| Concorrência          | ❌           | Race conditions                                         |
| Feedback visual       | ⚠️           | "Salvando..." / "Salvo automaticamente às HH:MM"        |
| Tratamento de erros   | ⚠️           | "Erro ao salvar" sem retry                              |
| Retry                 | ❌           | Nenhum                                                  |
| Estado "saving"       | ✅           | `showSavingStatus()`                                    |
| Estado "saved"        | ✅           | `showSavedStatus()`                                     |
| Estado "error"        | ✅           | `showErrorStatus()`                                     |
| Risco de sobrescrever | 🟠 Alto      | Race conditions                                         |
| Compatibilidade Turbo | ⚠️           | `saveOnTurboVisit` usa beacon mas não previne navegação |

### 14.2 Problemas

1. **`saveOnBeforeUnload` previne default**: Mostra diálogo do browser.
2. **`saveOnTurboVisit` não previne navegação**: Beacon pode não completar.
3. **Race condition em `save()`**: `dirty` resetado antes do fetch.
4. **Sem deduplicação**: Múltiplos saves concorrentes.
5. **Sem retry**: Falhas não são retentadas.
6. **`editorController` via `setTimeout(0)`**: Frágil.

### 14.3 Melhorias Propostas

1. **Remover `event.preventDefault()`** de `saveOnBeforeUnload`.
2. **Usar `sendBeacon` sem bloquear navegação**.
3. **Implementar tracking de request in-flight**: `this.saving = true/false`.
4. **Adicionar retry com backoff**.
5. **Obter `editorController` de forma síncrona** no `connect()`.
6. **Adicionar `aria-live="polite"` no status**.

---

## 15. Publicação

### 15.1 Fluxo de Publicação

```text
Editor
 ↓
Save (autosave)
 ↓
Validation (client-side: título, categoria, conteúdo)
 ↓
Publish (PATCH /books/:id/publish)
 ↓
Status: draft → published
 ↓
Public page (read.html.erb)
```

### 15.2 Problemas

| #   | Problema                                                     | Severidade | Detalhe                                                                |
| --- | ------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| 1   | **Conteúdo misto markdown+HTML**                             | 🔴 Crítico | `## #{title}` + HTML do Tiptap                                         |
| 2   | **`simple_format` destrói HTML**                             | 🔴 Crítico | Página de leitura mostra tags cruas                                    |
| 3   | **`publish` não verifica retorno de `update`**               | 🟠 Alto    | Pode responder sucesso sem persistir                                   |
| 4   | **`publish_controller.js` publica mesmo se autosave falhar** | 🟠 Alto    | Conteúdo stale                                                         |
| 5   | **Validações client-side frágeis**                           | 🟡 Médio   | Dependem de classes CSS no DOM                                         |
| 6   | **Publicação reversível?**                                   | ✅         | `unpublish` existe                                                     |
| 7   | **Conteúdo vazio permitido?**                                | ⚠️         | `publishable?` verifica `word_count > 0`, mas word_count é client-side |

### 15.3 Correções Propostas

1. **Gerar HTML válido na publicação**: `"<h2>#{CGI.escapeHTML(c.title)}</h2>\n\n#{c.content}"`.
2. **Usar `sanitize` na página de leitura**: `sanitize(@book.content, tags: [...])`.
3. **Verificar retorno de `update`**: `if @book.update(...)`.
4. **Bloquear publicação se autosave falhar**: `return unless await autoSaveCtrl.save()`.
5. **Recalcular `word_count` no backend** para validação confiável.

---

## 16. Testes

### 16.1 Estado Atual

| Tipo de Teste     | Existe? | Cobertura |
| ----------------- | ------- | --------- |
| Model specs       | ❌      | Nenhum    |
| Controller specs  | ❌      | Nenhum    |
| Request specs     | ❌      | Nenhum    |
| System specs      | ❌      | Nenhum    |
| View specs        | ❌      | Nenhum    |
| JavaScript tests  | ❌      | Nenhum    |
| Stimulus tests    | ❌      | Nenhum    |
| Integration tests | ❌      | Nenhum    |
| E2E tests         | ❌      | Nenhum    |

**Não existe diretório `test/` ou `spec/` no projeto.**

### 16.2 Lacunas de Cobertura

| Funcionalidade       | Teste Necessário                                                       |
| -------------------- | ---------------------------------------------------------------------- |
| H1/H2/H3             | System test: clicar em H1, verificar `<h1>` no HTML                    |
| Listas               | System test: clicar em lista, verificar `<ul>`/`<ol>`                  |
| Links                | System test: adicionar link, verificar `<a>`                           |
| Bold/Italic          | System test: selecionar texto, clicar B/I, verificar `<strong>`/`<em>` |
| Underline            | System test: clicar U, verificar `<u>`                                 |
| Undo/Redo            | System test: digitar, undo, verificar conteúdo                         |
| Autosave             | System test: digitar, esperar debounce, verificar PATCH                |
| Word count           | Unit test: calcular word count de HTML                                 |
| Character count      | Unit test: calcular char count                                         |
| Save                 | Request spec: PATCH chapter com content                                |
| Publish              | Request spec: PATCH book publish                                       |
| Persistência do HTML | System test: salvar, recarregar, verificar conteúdo                    |
| Sanitização          | Unit test: HTML malicioso é sanitizado                                 |
| XSS                  | System test: `<script>` não executa                                    |

### 16.3 Estratégia de Testes

1. **Model specs**: Testar `Chapter#word_count` recalculo, `Book#publishable?`, sanitização.
2. **Request specs**: Testar endpoints de chapters e books.
3. **System specs**: Testar interações do editor com Capybara + Playwright.
4. **JS tests**: Testar Stimulus controllers com Vitest + jsdom.
5. **E2E**: Considerar Playwright para fluxos completos.

---

## 17. Proposta de Arquitetura

### 17.1 Avaliação da Implementação Atual

A implementação atual usa **Tiptap 3.29** com **StarterKit**. O Tiptap é uma biblioteca moderna e bem mantida, baseada em ProseMirror. A escolha é adequada para o projeto.

**Não é necessário trocar de editor.** Os problemas encontrados são de **configuração, integração e falta de funcionalidades**, não de arquitetura fundamental.

### 17.2 Recomendações

| Aspecto     | Recomendação                                              |
| ----------- | --------------------------------------------------------- |
| Editor      | Manter Tiptap                                             |
| Extensões   | Adicionar `Underline`, `Placeholder`, `Link`, `TextAlign` |
| Toolbar     | Extrair para partial/componente com estado ativo          |
| Autosave    | Refatorar com deduplicação e retry                        |
| Sanitização | Adicionar no backend (model) e na renderização            |
| Contadores  | Recalcular no backend                                     |
| Publicação  | Gerar HTML válido, não markdown                           |
| Testes      | Criar suite completa                                      |

### 17.3 Por que NÃO trocar de editor

| Editor         | Vantagens                                   | Desvantagens                         | Custo de Migração |
| -------------- | ------------------------------------------- | ------------------------------------ | ----------------- |
| Tiptap (atual) | Moderno, extensível, baseado em ProseMirror | Requer configuração                  | Zero              |
| ProseMirror    | Poderoso, estável                           | API complexa, baixo nível            | Alto              |
| Lexical        | Meta, performático                          | Ecossistema menor, menos integrações | Alto              |
| Quill          | Simples, maduro                             | Menos extensível, formato Delta      | Médio             |
| CKEditor       | Completo, enterprise                        | Pesado, licença GPL/comercial        | Alto              |

**Conclusão:** Manter Tiptap. Os problemas são de configuração e integração, não de escolha de biblioteca.

### 17.4 Arquitetura Proposta

```
app/javascript/controllers/
├── editor_controller.js          # Controlador principal (refatorado)
├── editor_toolbar_controller.js  # NOVO: toolbar com estado ativo
├── editor_link_controller.js     # NOVO: modal de links
├── auto_save_controller.js       # Refatorado: deduplicação, retry
├── chapter_panel_controller.js   # Refatorado: reorder em batch
├── word_count_controller.js      # Refatorado: lógica centralizada
├── publish_controller.js         # Refatorado: focus trap, aria
└── editor_sidebar_controller.js  # Refatorado: focus trap, aria

app/models/
├── book.rb                       # Refatorado: sanitização, word_count
├── chapter.rb                    # Refatorado: sanitização, word_count
└── concerns/
    └── content_sanitizer.rb      # NOVO: concern de sanitização

app/views/books/
├── write.html.erb                # Refatorado: escape de data attributes
├── _toolbar.html.erb             # NOVO: partial da toolbar
├── _publish_modal.html.erb       # Refatorado: aria, focus trap
└── read.html.erb                 # Refatorado: sanitize + typography
```

---

## 18. Plano de Refatoração por Fases

### Fase 1 — Correções Críticas (Prioridade Máxima)

**Objetivo:** Corrigir bugs que impedem funcionalidades principais.

| #   | Tarefa                                                                  | Arquivos                                                 | Estimativa |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------- | ---------- |
| 1   | Importar `@tiptap/extension-underline` e configurar                     | `package.json`, `editor_controller.js`                   | 30min      |
| 2   | Escapar `data-editor-content-value` e `data-editor-chapter-title-value` | `write.html.erb`                                         | 15min      |
| 3   | Corrigir `simple_format` na página de leitura → usar `sanitize`         | `read.html.erb`                                          | 30min      |
| 4   | Corrigir `publish` para gerar HTML válido (não markdown)                | `books_controller.rb`                                    | 30min      |
| 5   | Instalar `@tailwindcss/typography` e configurar                         | `package.json`, `application.tailwind.css`               | 15min      |
| 6   | Adicionar sanitização no backend                                        | `chapter.rb`, `book.rb`, `concerns/content_sanitizer.rb` | 1h         |
| 7   | Corrigir `saveOnBeforeUnload` (remover `preventDefault`)                | `auto_save_controller.js`                                | 15min      |
| 8   | Corrigir `saveOnTurboVisit` (aguardar save)                             | `auto_save_controller.js`                                | 30min      |
| 9   | Verificar ownership em `chapters#index` e `chapters#show`               | `chapters_controller.rb`                                 | 15min      |
| 10  | Verificar retorno de `update` em `books#publish` e `books#unpublish`    | `books_controller.rb`                                    | 15min      |

**Validação:**

- [ ] Clicar em "U" aplica sublinhado
- [ ] Conteúdo com aspas carrega corretamente no editor
- [ ] Página de leitura mostra formatação correta
- [ ] Publicação gera HTML válido
- [ ] `<script>` é removido do conteúdo
- [ ] Navegação não mostra diálogo do browser

### Fase 2 — Funcionalidades do Editor

**Objetivo:** Adicionar funcionalidades esperadas de um editor moderno.

| #   | Tarefa                                            | Arquivos                                                              | Estimativa |
| --- | ------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| 1   | Adicionar `Placeholder` extension                 | `editor_controller.js`, `package.json`                                | 15min      |
| 2   | Adicionar botão "Parágrafo"                       | `write.html.erb`, `editor_controller.js`                              | 30min      |
| 3   | Adicionar botão "Tachado"                         | `write.html.erb`, `editor_controller.js`                              | 30min      |
| 4   | Adicionar suporte a links (extensão + modal)      | `editor_controller.js`, `editor_link_controller.js`, `write.html.erb` | 2h         |
| 5   | Adicionar botão "Code Block"                      | `write.html.erb`, `editor_controller.js`                              | 30min      |
| 6   | Adicionar atalhos de teclado customizados         | `editor_controller.js`                                                | 1h         |
| 7   | Adicionar `onSelectionUpdate` para estado ativo   | `editor_controller.js`                                                | 1h         |
| 8   | Adicionar `onTransaction` para undo/redo disabled | `editor_controller.js`                                                | 30min      |

**Validação:**

- [ ] Placeholder aparece em editor vazio
- [ ] Botão "Parágrafo" volta para texto normal
- [ ] Tachado funciona
- [ ] Links podem ser adicionados e editados
- [ ] Code block funciona
- [ ] Atalhos de teclado funcionam
- [ ] Botões mostram estado ativo

### Fase 3 — Estado e Persistência

**Objetivo:** Tornar o autosave e os contadores confiáveis.

| #   | Tarefa                                            | Arquivos                                                                      | Estimativa |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| 1   | Recalcular `word_count` no backend                | `chapter.rb`                                                                  | 30min      |
| 2   | Adicionar `character_count` (se necessário)       | Migration, `chapter.rb`                                                       | 1h         |
| 3   | Centralizar lógica de word count em um helper     | `word_count_controller.js`, `editor_controller.js`, `auto_save_controller.js` | 1h         |
| 4   | Implementar deduplicação de requests no autosave  | `auto_save_controller.js`                                                     | 1h         |
| 5   | Adicionar retry com backoff                       | `auto_save_controller.js`                                                     | 1h         |
| 6   | Obter `editorController` de forma síncrona        | `auto_save_controller.js`                                                     | 15min      |
| 7   | Adicionar `aria-live="polite"` no status          | `write.html.erb`                                                              | 15min      |
| 8   | Corrigir `updateFromDOM` (remover ou simplificar) | `word_count_controller.js`                                                    | 30min      |

**Validação:**

- [ ] Word count é recalculado no backend
- [ ] Autosave não tem race conditions
- [ ] Falhas de save são retentadas
- [ ] Status de salvamento é anunciado por screen readers

### Fase 4 — UX e Acessibilidade

**Objetivo:** Melhorar a experiência do usuário e acessibilidade.

| #   | Tarefa                                              | Arquivos                                                | Estimativa |
| --- | --------------------------------------------------- | ------------------------------------------------------- | ---------- |
| 1   | Adicionar `role="toolbar"` e `aria-label`           | `write.html.erb`                                        | 15min      |
| 2   | Adicionar `aria-pressed` nos botões toggle          | `write.html.erb`, `editor_controller.js`                | 1h         |
| 3   | Adicionar `aria-label` em todos os botões           | `write.html.erb`                                        | 30min      |
| 4   | Adicionar keyboard navigation na toolbar            | `editor_controller.js`                                  | 1h         |
| 5   | Adicionar `aria-keyshortcuts`                       | `write.html.erb`                                        | 15min      |
| 6   | Adicionar focus trap nos modais                     | `publish_controller.js`, `editor_sidebar_controller.js` | 1h         |
| 7   | Adicionar `role="dialog"` e `aria-modal` nos modais | `_publish_modal.html.erb`, `_delete_modal.html.erb`     | 30min      |
| 8   | Adicionar `aria-label` no editor                    | `editor_controller.js`                                  | 15min      |
| 9   | Extrair toolbar para partial                        | `_toolbar.html.erb`, `write.html.erb`                   | 1h         |
| 10  | Mover `<style>` inline para stylesheet              | `write.html.erb`, `application.tailwind.css`            | 15min      |

**Validação:**

- [ ] Screen reader identifica toolbar e botões
- [ ] Navegação por teclado funciona na toolbar
- [ ] Modais prendem foco
- [ ] Estado ativo é anunciado

### Fase 5 — Testes

**Objetivo:** Criar suite de testes abrangente.

| #   | Tarefa                              | Arquivos                       | Estimativa |
| --- | ----------------------------------- | ------------------------------ | ---------- |
| 1   | Configurar RSpec (ou Minitest)      | `Gemfile`, `spec/`             | 1h         |
| 2   | Model specs para `Chapter` e `Book` | `spec/models/`                 | 2h         |
| 3   | Request specs para chapters e books | `spec/requests/`               | 2h         |
| 4   | System specs para o editor          | `spec/system/`                 | 4h         |
| 5   | JS tests para Stimulus controllers  | `test/javascript/`             | 3h         |
| 6   | Testes de sanitização e XSS         | `spec/models/`, `spec/system/` | 2h         |

**Validação:**

- [ ] `bin/rails test` passa
- [ ] `yarn test` passa
- [ ] Cobertura de pelo menos 70% nas funcionalidades do editor

### Fase 6 — Polimento

**Objetivo:** Performance, organização e documentação.

| #   | Tarefa                                                      | Arquivos                                                | Estimativa |
| --- | ----------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| 1   | Otimizar `reorder` para batch update                        | `chapters_controller.rb`, `chapter_panel_controller.js` | 1h         |
| 2   | Remover código morto (`getChapterData`, `total_word_count`) | `editor_controller.js`, `book.rb`                       | 30min      |
| 3   | Adicionar `published_at` em chapters (se necessário)        | Migration                                               | 1h         |
| 4   | Documentar o editor no README                               | `README.md`                                             | 30min      |
| 5   | Ativar CSP                                                  | `content_security_policy.rb`                            | 1h         |
| 6   | Adicionar `@tailwindcss/typography` styles para o editor    | `application.tailwind.css`                              | 1h         |

**Validação:**

- [ ] Reorder é atômico
- [ ] Código morto removido
- [ ] CSP ativo
- [ ] Documentação atualizada

---

## 19. Matriz de Priorização

| Item | Problema                                       | Causa                                | Impacto                              | Prioridade | Solução sugerida                       |
| ---- | ---------------------------------------------- | ------------------------------------ | ------------------------------------ | ---------- | -------------------------------------- |
| 1    | Sublinhado quebrado                            | Extensão `Underline` não importada   | Botão não funciona, erro no console  | 🔴 Crítico | Importar `@tiptap/extension-underline` |
| 2    | `data-editor-content-value` quebra com aspas   | HTML interpolado sem escape          | Editor não carrega conteúdo          | 🔴 Crítico | Usar `CGI.escapeHTML` ou JSON          |
| 3    | `simple_format` destrói HTML na leitura        | `read.html.erb` usa `simple_format`  | Formatação perdida na página pública | 🔴 Crítico | Usar `sanitize` com tags permitidas    |
| 4    | Conteúdo misto markdown+HTML na publicação     | `publish` concatena `##` + HTML      | Formatação quebrada na publicação    | 🔴 Crítico | Gerar HTML válido                      |
| 5    | Sem `@tailwindcss/typography`                  | Plugin não instalado                 | `prose` classes sem estilo           | 🔴 Crítico | Instalar plugin                        |
| 6    | XSS — sem sanitização no backend               | `chapter_params` aceita HTML cru     | Vulnerabilidade de segurança         | 🔴 Crítico | Sanitizar no model                     |
| 7    | `saveOnBeforeUnload` mostra diálogo            | `event.preventDefault()`             | UX terrível                          | 🔴 Crítico | Remover `preventDefault`               |
| 8    | `chapters#index`/`show` sem ownership          | Sem verificação de autorização       | Qualquer usuário lê capítulos        | 🔴 Crítico | Adicionar `before_action`              |
| 9    | Sem estado ativo na toolbar                    | Sem `onSelectionUpdate`              | Usuário não sabe formato atual       | 🟠 Alto    | Adicionar handler                      |
| 10   | Sem placeholder                                | Extensão `Placeholder` não importada | Editor vazio sem instrução           | 🟠 Alto    | Importar extensão                      |
| 11   | Autosave race conditions                       | `dirty` resetado antes do fetch      | Conteúdo pode ser perdido            | 🟠 Alto    | Deduplicação + in-flight tracking      |
| 12   | `saveOnTurboVisit` não previne navegação       | Beacon async                         | Conteúdo pode ser perdido            | 🟠 Alto    | Aguardar save                          |
| 13   | `publish` publica mesmo se autosave falhar     | Sem verificação de retorno           | Conteúdo stale publicado             | 🟠 Alto    | Bloquear se save falhar                |
| 14   | Word count client-side                         | Backend confia no cliente            | Dados incorretos                     | 🟠 Alto    | Recalcular no backend                  |
| 15   | `publish` não verifica retorno de `update`     | Sem `if @book.update(...)`           | Pode responder sucesso sem persistir | 🟠 Alto    | Verificar retorno                      |
| 16   | `saveNewOrder` requests sequenciais            | Loop de PATCH individuais            | Ineficiente, falhas parciais         | 🟠 Alto    | Batch update                           |
| 17   | Sem suporte a links                            | Sem extensão `Link`                  | Funcionalidade ausente               | 🟡 Médio   | Adicionar extensão + modal             |
| 18   | Sem botão "Parágrafo"                          | Não implementado                     | Usuário não volta a parágrafo        | 🟡 Médio   | Adicionar botão                        |
| 19   | Sem `aria-pressed` nos botões                  | Não implementado                     | Acessibilidade deficiente            | 🟡 Médio   | Adicionar                              |
| 20   | Sem `role="toolbar"`                           | Não implementado                     | Screen readers não identificam       | 🟡 Médio   | Adicionar                              |
| 21   | Sem focus trap nos modais                      | Não implementado                     | Usuários de teclado saem do modal    | 🟡 Médio   | Adicionar                              |
| 22   | Sem `aria-live` no status                      | Não implementado                     | Screen readers não anunciam          | 🟡 Médio   | Adicionar                              |
| 23   | `contentValue` não atualizado após loadChapter | Não atualizado                       | Reconexão restaura conteúdo antigo   | 🟡 Médio   | Atualizar                              |
| 24   | `setTimeout` no connect dispara autosave       | Dispatch no load                     | Autosave desnecessário               | 🟡 Médio   | Remover ou condicionar                 |
| 25   | Sem testes                                     | Nenhum teste existe                  | Sem garantia de funcionamento        | 🟡 Médio   | Criar suite                            |
| 26   | Sem suporte a tachado                          | Não implementado                     | Funcionalidade ausente               | 🟢 Baixo   | Adicionar botão                        |
| 27   | Sem suporte a code block                       | Não implementado                     | Funcionalidade ausente               | 🟢 Baixo   | Adicionar botão                        |
| 28   | Sem suporte a alinhamento                      | Não implementado                     | Funcionalidade ausente               | 🟢 Baixo   | Adicionar extensão                     |
| 29   | Sem suporte a indentação                       | Não implementado                     | Funcionalidade ausente               | 🟢 Baixo   | Adicionar extensão                     |
| 30   | Sem disabled states em undo/redo               | Não implementado                     | Botões sempre habilitados            | 🟢 Baixo   | Adicionar                              |
| 31   | `updateFromDOM` frágil                         | Parseia DOM                          | Quebra se formato mudar              | 🟢 Baixo   | Remover                                |
| 32   | `<style>` inline no template                   | Animações inline                     | Manutenção difícil                   | 🟢 Baixo   | Mover para stylesheet                  |
| 33   | `getChapterData` nunca usado                   | Código morto                         | Confusão                             | 🟢 Baixo   | Remover                                |
| 34   | `total_word_count` nunca usado                 | Código morto                         | Confusão                             | 🟢 Baixo   | Remover                                |
| 35   | CSP desativado                                 | Comentado                            | Sem proteção CSP                     | 🟢 Baixo   | Ativar                                 |

---

## 20. Checklist de Implementação

### Editor Core

- [ ] Corrigir H1 (verificar estado ativo)
- [ ] Corrigir H2 (verificar estado ativo)
- [ ] Corrigir H3 (verificar estado ativo)
- [ ] Corrigir parágrafo (adicionar botão)
- [ ] Corrigir bold (verificar estado ativo)
- [ ] Corrigir italic (verificar estado ativo)
- [ ] Corrigir underline (importar extensão)
- [ ] Adicionar tachado (strike)
- [ ] Adicionar placeholder
- [ ] Adicionar suporte a links
- [ ] Adicionar code block
- [ ] Adicionar alinhamento
- [ ] Adicionar indentação/outdentação

### Lists

- [ ] Lista ordenada (verificar estado ativo)
- [ ] Lista não ordenada (verificar estado ativo)
- [ ] Blockquote (verificar estado ativo)
- [ ] Separador (HR)

### Persistence

- [ ] Validar HTML no backend (sanitização)
- [ ] Validar sanitização na renderização
- [ ] Validar autosave (deduplicação, retry)
- [ ] Validar reload (conteúdo preservado)
- [ ] Validar `data-editor-content-value` com aspas
- [ ] Validar `data-editor-chapter-title-value` com aspas
- [ ] Recalcular word_count no backend
- [ ] Adicionar character_count (se necessário)

### Publishing

- [ ] Corrigir `publish` para gerar HTML válido
- [ ] Corrigir `simple_format` na página de leitura
- [ ] Verificar retorno de `update` em `publish`
- [ ] Bloquear publicação se autosave falhar
- [ ] Validar publicação reversível

### Security

- [ ] Sanitizar HTML no model `Chapter`
- [ ] Sanitizar HTML no model `Book`
- [ ] Verificar ownership em `chapters#index` e `chapters#show`
- [ ] Ativar CSP
- [ ] Validar URLs em links

### Autosave

- [ ] Remover `preventDefault` de `saveOnBeforeUnload`
- [ ] Corrigir `saveOnTurboVisit`
- [ ] Implementar deduplicação de requests
- [ ] Adicionar retry com backoff
- [ ] Obter `editorController` de forma síncrona

### UX

- [ ] Active toolbar state (aria-pressed)
- [ ] Keyboard navigation na toolbar
- [ ] Focus trap nos modais
- [ ] `role="toolbar"` e `aria-label`
- [ ] `aria-live` no status de salvamento
- [ ] `aria-keyshortcuts` nos botões
- [ ] Disabled states em undo/redo
- [ ] Mobile behavior (toolbar scroll)
- [ ] Touch support

### Accessibility

- [ ] `aria-label` em todos os botões
- [ ] `role="dialog"` e `aria-modal` nos modais
- [ ] `aria-label` no editor
- [ ] Focus management no sidebar mobile
- [ ] Screen reader announcements

### Tests

- [ ] Configurar RSpec (ou Minitest)
- [ ] Model specs (Chapter, Book)
- [ ] Request specs (chapters, books)
- [ ] System specs (editor interactions)
- [ ] JS tests (Stimulus controllers)
- [ ] Testes de sanitização e XSS
- [ ] Testes de autosave
- [ ] Testes de word count
- [ ] Testes de publish/unpublish

### Infrastructure

- [ ] Instalar `@tailwindcss/typography`
- [ ] Configurar `@tailwindcss/typography` no CSS
- [ ] Extrair toolbar para partial
- [ ] Mover `<style>` inline para stylesheet
- [ ] Remover código morto
- [ ] Otimizar reorder (batch update)
- [ ] Documentar no README

---

## Resumo Executivo

### O que está errado?

O editor tem **3 bugs críticos** (sublinhado quebrado, `data-editor-content-value` sem escape, `simple_format` destruindo HTML na leitura), **1 vulnerabilidade de segurança** (XSS sem sanitização), **1 problema de arquitetura** (conteúdo misto markdown+HTML na publicação) e **0 testes**.

### Onde está o problema?

- **Frontend:** `editor_controller.js` (extensão faltando), `auto_save_controller.js` (race conditions), `write.html.erb` (escape de atributos, acessibilidade).
- **Backend:** `chapters_controller.rb` (sem sanitização, sem ownership), `books_controller.rb` (publish com formato misto), `chapter.rb` (word_count client-side).
- **Views:** `read.html.erb` (simple_format), `write.html.erb` (escape, acessibilidade).

### Por que está acontecendo?

- **Falta de testes** — nenhum teste existe para detectar regressões.
- **Falta de sanitização** — o backend confia no frontend.
- **Falta de configuração** — extensões do Tiptap não são importadas corretamente.
- **Falta de padronização** — markdown e HTML são misturados.

### Qual é o impacto?

- **Usuários:** Sublinhado não funciona, formatação perdida na leitura, conteúdo pode ser perdido em navegação rápida.
- **Segurança:** XSS vulnerável.
- **Manutenção:** Código duplicado, lógica espalhada, sem testes.

### Como deve ser corrigido?

Seguir o plano de fases: **Fase 1** (críticos) → **Fase 2** (funcionalidades) → **Fase 3** (estado/persistência) → **Fase 4** (UX/acessibilidade) → **Fase 5** (testes) → **Fase 6** (polimento).

### Como validar que a correção funciona?

- Testes automatizados (model, request, system, JS).
- Verificação manual dos fluxos: editar → salvar → recarregar → publicar → ler.
- Verificação de segurança: `<script>` é removido, XSS não executa.
- Verificação de acessibilidade: screen reader, keyboard navigation.

### Quais testes devem ser adicionados?

- Model specs: sanitização, word_count, publishable?
- Request specs: CRUD de chapters, publish/unpublish.
- System specs: interações do editor (H1, bold, lists, autosave, reload).
- JS tests: Stimulus controllers (editor, auto_save, word_count, chapter_panel).

### Qual deve ser a ordem de implementação?

1. **Fase 1** — Correções críticas (bugs, segurança, escape).
2. **Fase 2** — Funcionalidades do editor (links, placeholder, tachado).
3. **Fase 3** — Estado e persistência (autosave, contadores).
4. **Fase 4** — UX e acessibilidade (toolbar, modais, ARIA).
5. **Fase 5** — Testes (suite completa).
6. **Fase 6** — Polimento (performance, organização, documentação).
