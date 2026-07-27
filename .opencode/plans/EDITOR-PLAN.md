# Plano: Editor de Escrita de Livros

## Sumário

1. [Escopo](#1-escopo)
2. [Estado Atual](#2-estado-atual)
3. [Arquitetura](#3-arquitetura)
4. [Modelo de Domínio](#4-modelo-de-domínio)
5. [Especificação das Funcionalidades](#5-especificação-das-funcionalidades)
6. [Identidade Visual do Editor](#6-identidade-visual-do-editor)
7. [Plano de Implementação](#7-plano-de-implementação)
8. [Critérios de Aceite](#8-critérios-de-aceite)

---

## 1. Escopo

Este plano detalha a criação do **componente de editor de escrita** do ContaAI, abrangendo:

- Editor de texto rico para escrita de capítulos
- Sistema de capítulos (criar, reordenar, renomear, excluir)
- Salvamento automático
- Contagem de palavras e caracteres em tempo real
- Upload de capa com preview
- Fluxo de publicação
- Exclusão de livro

**Fora do escopo**: Leitura de livros (Fase 2), favoritos, avaliações, exports.

---

## 2. Estado Atual

### O que já existe

| Componente | Status | Observação |
|---|---|---|
| Model `Book` | ✅ Criado | Campos: `title`, `author_name`, `content`, `category`, `status`, `cover_color`, `word_count` |
| `has_many :chapters` | ⚠️ Declarado | Referência no model, mas **não existe migration nem model Chapter** |
| `has_one_attached :cover_image` | ✅ Criado | Active Storage configurado |
| Controller `BooksController` | ✅ Criado | CRUD básico, `publish`, `read` — sem auto-save |
| View `new.html.erb` | ✅ Criado | Formulário sem upload de imagem |
| View `edit.html.erb` | ✅ Criado | Formulário de metadados, **sem editor de texto** |
| Rotas | ✅ Criadas | `resources :books` com `publish` e `read` |

### O que falta

- [ ] Model e migration `Chapter`
- [ ] Rich text editor (nenhuma lib incluída no Gemfile)
- [ ] Controller de capítulos
- [ ] Endpoint de auto-save (PATCH async)
- [ ] View do editor (escrita)
- [ ] Upload de capa na criação/edição
- [ ] Contagem de palavras automática
- [ ] UI de gerenciamento de capítulos

---

## 3. Arquitetura

### Stack do Editor

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Rich Text Editor | **TipTap** (via CDN) | Extensível, leve, headless, bom suporte a extensões |
| Frontend交互 | **Stimulus** | Já no projeto, padrão Rails hotwire |
| Comunicação | **Turbo Streams** | Salvamento async sem refresh |
| Storage | **Active Storage** | Já configurado para capa |
| Backend | **Rails 8 + PostgreSQL** | Stack existente |

### Por que TipTap?

- Framework headless: controle total sobre UI e estilo
- Baseado em ProseMirror: padronizado, robusto
- Extensões modulares: negrito, itálico, títulos, listas, citações
- Fácil integração com Stimulus via eventos DOM
- Sem dependência de jQuery ou plugins legados

### Alternativa considerada

| Lib | Prós | Contras | Veredicto |
|---|---|---|---|
| Quill | Simples, bem documentado | Menos extensível, UI rígida | ❌ |
| Trix | Nativo Rails | Limitado para escrita longa, sem capítulos | ❌ |
| TipTap | Extensível, headless, ProseMirror | Precisa de setup manual | ✅ |
| CodeMirror | Poderoso | Overkill para rich text | ❌ |

---

## 4. Modelo de Domínio

### 4.1 Capítulo (Chapter)

| Atributo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | UUID/Integer | Sim | Identificador único |
| `book_id` | Integer | Sim | FK para Book |
| `title` | String | Sim | Nome do capítulo |
| `content` | Text | Não | Conteúdo HTML/JSON do capítulo |
| `position` | Integer | Sim | Ordem do capítulo (default: 0) |
| `word_count` | Integer | Sim | Contagem de palavras (default: 0) |
| `created_at` | DateTime | Sim | Timestamp criação |
| `updated_at` | DateTime | Sim | Timestamp atualização |

**Índices:**
- `[:book_id, :position]` — ordenação eficiente
- `[:book_id]` — lookup por livro

### 4.2 Mudanças no Model Book

```ruby
# Adicionar/atualizar:
has_many :chapters, -> { order(position: :asc) }, dependent: :destroy

# Campo existente `content` continua existindo como fallback
# para livros sem capítulos (escrita contínua)
```

### 4.3 Regras de Negócio

| Regra | Descrição |
|---|---|
| RN-ED-001 | Um livro pode ter capítulos ou conteúdo contínuo (mutuamente exclusivos no UI) |
| RN-ED-002 | Capítulos são ordenados por `position` (0-based) |
| RN-ED-003 | Ao excluir um capítulo, positions são recalculadas |
| RN-ED-004 | word_count do Book é a soma dos word_count dos chapters (ou do campo content) |
| RN-ED-005 | Salvamento automático ocorre a cada 30 segundos de inatividade |
| RN-ED-006 | Apenas o proprietário pode editar o conteúdo |
| RN-ED-007 | Um livro só pode ser publicado se tiver título e pelo menos um capítulo com conteúdo |

---

## 5. Especificação das Funcionalidades

### 5.1 F-ED-001: Criar Novo Livro (atualização)

**Objetivo**: Formulário de criação com upload de capa.

**Campos do Formulário:**

| Campo | Tipo | Obrigatório | Padrão |
|---|---|---|---|
| Título | Texto | Sim | — |
| Autor | Texto | Sim | Nome do usuário logado |
| Categoria | Seleção | Sim | — |
| Capa (imagem) | Upload | Não | — |
| Cor da capa | Color picker | Não | `#8B4513` |

**Fluxo:**

1. Usuário preenche campos
2. Opcionalmente faz upload de imagem (preview imediato)
3. Escolhe cor de fundo (usada quando não há imagem)
4. Clica em "Criar"
5. Livro é criado em status `draft`
6. Usuário é redirecionado para o editor de escrita

**Validações:**
- Formatos de imagem: JPG, PNG, WebP
- Tamanho máximo: 5MB
- Dimensões recomendadas: 600x900px (2:3)

---

### 5.2 F-ED-002: Editor de Escrita

**Objetivo**: Interface de escrita com rich text e sistema de capítulos.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ [← Voltar]  Título do Livro            [Publicar]   │
├──────────┬──────────────────────────────────────────┤
│          │  ┌────────────────────────────────────┐  │
│ CAPÍTULOS│  │  Toolbar de formatação              │  │
│          │  ├────────────────────────────────────┤  │
│ Cap 1  ✎ │  │                                    │  │
│ Cap 2    │  │  Área de escrita                   │  │
│ Cap 3    │  │  (contenteditable)                 │  │
│          │  │                                    │  │
│ + Novo   │  │                                    │  │
│          │  │                                    │  │
│          │  └────────────────────────────────────┘  │
│          │  ┌────────────────────────────────────┐  │
│          │  │ 1.234 palavras · 7.890 caracteres  │  │
│          │  │ Salvo automaticamente 12:34         │  │
│          │  └────────────────────────────────────┘  │
├──────────┴──────────────────────────────────────────┤
│ [Metadados]  [Excluir]                              │
└─────────────────────────────────────────────────────┘
```

**Componentes:**

#### a) Toolbar de Formatação

| Botão | Ação | Atalho |
|---|---|---|
| **B** | Negrito | `Ctrl+B` |
| *I* | Itálico | `Ctrl+I` |
| <u>U</u> | Sublinhado | `Ctrl+U` |
| H1 | Título 1 | `Ctrl+1` |
| H2 | Título 2 | `Ctrl+2` |
| H3 | Título 3 | `Ctrl+3` |
| — | Lista ordenada | — |
| — | Lista não ordenada | — |
| " | Citação | — |
| — | Separador horizontal | — |
| — | Desfazer | `Ctrl+Z` |
| — | Refazer | `Ctrl+Y` |

#### b) Painel de Capítulos (sidebar)

- Lista ordenada de capítulos com drag-and-drop para reordenar
- Duplo-clique para renomear inline
- Botão "+" para adicionar novo capítulo
- Menu contextual (clique direito): Renomear, Mover para cima/baixo, Excluir
- Indicador visual do capítulo ativo
- Contagem de palavras por capítulo

#### c) Barra de Status (footer)

- Contagem de palavras do capítulo atual
- Contagem de caracteres
- Indicador de salvamento: "Salvo automaticamente às HH:MM" / "Salvando..." / "Não salvo"
- Timestamp da última edição

#### d) Área de Escrita

- `contenteditable="true"` com TipTap
- Fonte: serif (Cormorant Garamond) para experiência de escrita
- Largura máxima do conteúdo: ~700px (comfortable reading width)
- Padding generoso para respiração visual
- Placeholder no primeiro capítulo: "Comece a escrever sua história..."

---

### 5.3 F-ED-003: Salvamento Automático

**Objetivo**: Nunca perder conteúdo.

**Mecanismo:**

| Trigger | Comportamento |
|---|---|
| Inatividade de 30s | PATCH `/books/:id/chapters/:chapter_id` com conteúdo |
| Mudança de capítulo | Salva capítulo anterior antes de trocar |
| Visibilidade da aba perde foco | Salva imediatamente |
| Fechar navegação | `beforeunload` salva via beacon API |

**Endpoints:**

```
PATCH /books/:book_id/chapters/:chapter_id
  Body: { chapter: { content: "...", word_count: 123 } }
  Response: { saved_at: "12:34:56" }

POST /books/:book_id/chapters
  Body: { chapter: { title: "Novo Capítulo", position: 3 } }
  Response: { id: 42, title: "...", position: 3 }
```

**Indicadores visuais:**
- `Salvando...` → ícone de loading
- `Salvo às 12:34` → texto verde sutil
- `Erro ao salvar` → toast de erro com retry

---

### 5.4 F-ED-004: Upload de Capa

**Objetivo**: Personalização visual do livro.

**Fluxo:**

1. Na criação ou no painel de metadados do editor
2. Área de drop com ícone de upload
3. Preview imediato ao selecionar
4. Opção de remover ou trocar
5. Crop simples (proporção 2:3 fixa)
6. Salvamento via Active Storage

**Restrições:**
- Formatos: JPG, PNG, WebP
- Máximo: 5MB
- Proporção: 2:3 (600x900px recomendado)

---

### 5.5 F-ED-005: Publicar Livro

**Objetivo**: Tornar o livro disponível publicamente.

**Pré-condições (validações):**
- Título não pode estar vazio
- Pelo menos um capítulo com conteúdo (word_count > 0)
- Categoria deve estar definida

**Fluxo:**

1. Usuário clica em "Publicar" no header do editor
2. Modal de confirmação com preview da capa e sinopse
3. Checklist visual:
   - [x] Título definido
   - [ ] Pelo menos um capítulo com conteúdo
   - [x] Categoria definida
4. Usuário confirma
5. Status muda para `published`
6. `published_at` é definido
7. Toast de sucesso
8. Link público gerado para compartilhamento

**Regras:**
- Ação reversível (despublicar → volta para draft)
- Se for primeira publicação do usuário, seu papel muda para Autor

---

### 5.6 F-ED-006: Excluir Livro

**Objetivo**: Remover livro permanentemente.

**Fluxo:**

1. Usuário clica em "Excluir" (no painel de metadados)
2. Modal de confirmação: "Tem certeza? Esta ação não pode ser desfeita."
3. Campo de confirmação: digitar o título do livro
4. Livro e todos os capítulos são excluídos
5. Redirecionamento para dashboard
6. Toast de confirmação

**Regras:**
- Irreversível
- Apenas o proprietário pode excluir
- Avaliações e favoritos associados são removidos (via `dependent: :destroy`)
- Se for último livro publicado, autor volta a ser leitor

---

## 6. Identidade Visual do Editor

### Paleta (resumo do PROJECT_PLAN)

| Elemento | Cor | Uso no Editor |
|---|---|---|
| Fundo do editor | `#F5F0EB` | Background da área de escrita |
| Toolbar | `#FFFFFF` | Fundo da barra de formatação |
| Sidebar capítulos | `#F5E6D3` | Painel lateral |
| Texto principal | `#2F241C` | Conteúdo escrito |
| Texto secundário | `#6B7280` | Labels, contadores |
| Destaque/Hover | `#C2A47E` | Capítulo ativo, botões |
| Primary (botão) | `#8B7355` | Botão publicar |
| Error | `#DC2626` | Excluir, erros |

### Tipografia no Editor

| Elemento | Fonte | Peso | Tamanho |
|---|---|---|---|
| Conteúdo escrito | Cormorant Garamond | 400 | 18px |
| Toolbar | Inter | 500 | 14px |
| Sidebar capítulos | Inter | 400 | 14px |
| Título do livro (header) | Playfair Display | 600 | 20px |
| Contadores (footer) | Inter | 400 | 12px |

### Micro-interações

| Elemento | Comportamento |
|---|---|
| Capítulo ativo | Background `#C2A47E` com 10% opacidade, borda esquerda 3px |
| Hover no capítulo | Background `#C2A47E` com 5% opacidade |
| Botão salvar | Animação de checkmark ao confirmar |
| Indicador de salvamento | Fade-in/out suave |
| Adicionar capítulo | Slide-down com animação |
| Excluir capítulo | Slide-up + fade-out |

---

## 7. Plano de Implementação

### Etapa 1: Infraestrutura de Capítulos ✅

**Arquivos:** 5 arquivos (3 novos, 2 atualizados)

| # | Arquivo | Ação | Status |
|---|---|---|---|
| 1.1 | `app/models/chapter.rb` | Criar model com validações | ✅ |
| 1.2 | `db/migrate/20260726000001_create_chapters.rb` | Migration com índices | ✅ |
| 1.3 | `app/controllers/chapters_controller.rb` | CRUD + reordenação | ✅ |
| 1.4 | `config/routes.rb` | Adicionar `resources :chapters` nested em books | ✅ |
| 1.5 | `app/models/book.rb` | Atualizar associations e adicionar validações | ✅ |

**Dependências:** Nenhuma (pode ser feito isoladamente)

---

### Etapa 2: Editor de Texto Rico (TipTap) ✅

**Arquivos:** 5 arquivos

| # | Arquivo | Ação |
|---|---|---|
| 2.1 | `app/javascript/controllers/editor_controller.js` | Stimulus controller para TipTap |
| 2.2 | `app/javascript/controllers/chapter_panel_controller.js` | Painel lateral de capítulos |
| 2.3 | `app/views/books/write.html.erb` | View principal do editor |
| 2.4 | `app/views/chapters/_chapter.json.jbuilder` | Partial JSON para Turbo |
| 2.5 | `app/views/chapters/create.turbo_stream.erb` | Resposta Turbo Stream |

**Dependências:** Etapa 1

---

### Etapa 3: Salvamento Automático e Contadores

**Arquivos:** 3 arquivos

| # | Arquivo | Ação |
|---|---|---|
| 3.1 | `app/javascript/controllers/auto_save_controller.js` | Lógica de debounce + beacon |
| 3.2 | `app/javascript/controllers/word_count_controller.js` | Contadores em tempo real |
| 3.3 | Atualizar `editor_controller.js` | Integrar auto-save e contadores |

**Dependências:** Etapa 2

---

### Etapa 4: Upload de Capa e Metadados

**Arquivos:** 3 arquivos

| # | Arquivo | Ação |
|---|---|---|
| 4.1 | `app/javascript/controllers/cover_upload_controller.js` | Preview, drag-and-drop |
| 4.2 | Atualizar `new.html.erb` | Adicionar upload de capa |
| 4.3 | Atualizar `edit.html.erb` | Adicionar upload + link para editor |

**Dependências:** Etapa 2

---

### Etapa 5: Publicação e Exclusão

**Arquivos:** 3 arquivos

| # | Arquivo | Ação |
|---|---|---|
| 5.1 | `app/views/books/_publish_modal.html.erb` | Modal de confirmação |
| 5.2 | `app/javascript/controllers/publish_controller.js` | Lógica do modal + validação |
| 5.3 | Atualizar `books_controller.rb` | Reforçar validações no `publish` |

**Dependências:** Etapas 1-4

---

### Ordem de Execução Recomendada

```
Etapa 1 ──→ Etapa 2 ──→ Etapa 3
                           │
                     Etapa 4 ──→ Etapa 5
```

**Total de arquivos:** ~18 (8 novos, 5 atualizados, 5 de suporte)

---

## 8. Critérios de Aceite

### Funcionais

- [ ] Autor consegue criar um novo livro com título, autor, categoria e capa
- [ ] Autor é redirecionado para o editor após criar livro
- [ ] Editor carrega com TipTap funcional e toolbar completa
- [ ] Autor consegue criar, renomear, reordenar e excluir capítulos
- [ ] Conteúdo é formatado corretamente (negrito, itálico, títulos, listas, citações)
- [ ] Salvamento automático funciona a cada 30s de inatividade
- [ ] Conteúdo é salvo ao mudar de aba ou fechar navegador
- [ ] Contagem de palavras e caracteres é exibida em tempo real
- [ ] Indicador de salvamento mostra status corretamente
- [ ] Upload de capa funciona com preview
- [ ] Publicação valida pré-condições e mostra modal de confirmação
- [ ] Exclusão pede confirmação com digitação do título
- [ ] Apenas o proprietário pode editar/publicar/excluir

### Não-funcionais

- [ ] Editor carrega em menos de 2 segundos
- [ ] Salvamento automático não causa lag durante escrita
- [ ] Interface é responsiva (funciona em tablets)
- [ ] Atalhos de teclado funcionam (Ctrl+B, Ctrl+I, etc.)
- [ ] Experiência de escrita é confortável (fonte serif, largura adequada)
- [ ] Sidebar de capítulos pode ser expandida/recolhida em mobile

### Acessibilidade

- [ ] Toolbar é navegável por teclado
- [ ] Capítulos são acessíveis via screen reader
- [ ] Indicadores de status têm `aria-live`
- [ ] Contraste de cores atende WCAG AA

---

## Referências

| Documento | Seção |
|---|---|
| `PROJECT_PLAN.md` | F-BOOK-001, F-BOOK-002, F-BOOK-003, F-BOOK-004, F-BOOK-005 |
| `PROJECT_PLAN.md` | Fase 1: Core de Criação |
| `PROJECT_PLAN.md` | §4 Identidade Visual |
| `AGENTS.md` | Skills e convenções do projeto |

---

## 9. Registro de Implementação

### Etapa 1: Infraestrutura de Capítulos ✅

**Status:** Concluída em 26/07/2026

**Arquivos criados:**

| Arquivo | Descrição |
|---|---|
| `app/models/chapter.rb` | Model com validações, callbacks de posição e contagem de palavras |
| `db/migrate/20260726000001_create_chapters.rb` | Migration com índices `book_id` e `[book_id, position]` |
| `app/controllers/chapters_controller.rb` | CRUD completo + endpoint `reorder` com transação |

**Arquivos atualizados:**

| Arquivo | Mudança |
|---|---|
| `config/routes.rb` | Adicionado `resources :chapters` nested em `books` com rota `reorder` |
| `app/models/book.rb` | Adicionado escopo `ordered` no `has_many :chapters`, validações, métodos `total_word_count`, `has_chapters?`, `publishable?` |

**Decisões tomadas:**

1. **Position management**: Usa `update_all` em transação para reordenação eficiente (O(n) ao invés de O(n²))
2. **Word count automático**: Callback `after_save` e `after_destroy` recalcula total do livro
3. **Touch no book**: `belongs_to :book, touch: true` para invalidar cache quando capítulo é modificado
4. **Rota `reorder`**: Endpoint dedicado (PATCH) para operação de reordenação isolada

**Pendente:**

- [ ] Rodar migration (PostgreSQL indisponível neste ambiente)
- [ ] Criar records de teste para validar comportamento

---

### Etapa 2: Editor de Texto Rico (TipTap) ✅

**Status:** Concluída em 26/07/2026

**Arquivos criados:**

| Arquivo | Descrição |
|---|---|
| `app/javascript/controllers/editor_controller.js` | Stimulus controller para TipTap com toolbar, auto-save e contadores |
| `app/javascript/controllers/chapter_panel_controller.js` | Painel lateral com CRUD de capítulos, drag-and-drop e renomeação inline |
| `app/views/books/write.html.erb` | View principal do editor com layout completo |
| `app/views/chapters/_chapter.json.jbuilder` | Partial JSON para serialização de capítulos |
| `app/views/chapters/create.turbo_stream.erb` | Resposta Turbo Stream para criação de capítulos |

**Arquivos atualizados:**

| Arquivo | Mudança |
|---|---|
| `app/controllers/books_controller.rb` | Adicionada action `write` com carregamento de capítulos |
| `config/routes.rb` | Adicionada rota `get :write` em member do resource books |
| `app/javascript/controllers/index.js` | Registrados controllers `editor` e `chapter-panel` |
| `package.json` | Adicionadas dependências `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/pm` |
| `app/views/books/show.html.erb` | Adicionado link "Escrever" para acessar o editor |

**Dependências npm instaladas:**

- `@tiptap/core` - Core do TipTap
- `@tiptap/starter-kit` - Extensões básicas (bold, italic, headings, lists, blockquote, etc.)
- `@tiptap/pm` - ProseMirror dependencies

**Funcionalidades implementadas:**

1. **Rich Text Editor (TipTap)**
   - Toolbar completa: Bold, Italic, Underline, H1-H3, Listas, Citação, Separador, Undo/Redo
   - Fonte serif (Cormorant Garamond) para experiência de escrita
   - Largura máxima do conteúdo: ~700px
   - Placeholder no primeiro capítulo

2. **Painel de Capítulos (Sidebar)**
   - Lista ordenada de capítulos com drag-and-drop para reordenar
   - Duplo-clique para renomear inline
   - Botão "+" para adicionar novo capítulo
   - Menu de exclusão com confirmação
   - Indicador visual do capítulo ativo (borda esquerda + background)
   - Contagem de palavras por capítulo
   - Animações de slide-down/slide-up para adicionar/excluir

3. **Integração com Backend**
   - Carregamento de conteúdo do capítulo via fetch API
   - Troca de capítulo com salvamento automático do anterior
   - Evento customizado `chapter:selected` para comunicação entre controllers

4. **Design**
   - Paleta de cores conforme especificação: fundo `#F5F0EB`, sidebar `#F5E6D3`, toolbar branca
   - Tipografia: Inter para UI, Cormorant Garamond para conteúdo
   - Micro-interações: hover nos capítulos, animações de entrada/saída

**Decisões tomadas:**

1. **TipTap via npm**: Instalado via npm (não CDN) para melhor integração com esbuild
2. **Comunicação via Custom Events**: Chapter panel dispara `chapter:selected`, editor escuta e carrega conteúdo
3. **Conteúdo inicial via data attribute**: `data-editor-content-value` passa o conteúdo do capítulo ativo para o editor
4. **Salvamento manual**: Auto-save será implementado na Etapa 3 (atualmente apenas UI pronta)

**Correções pós-review:**

1. **`saveChapter` retorna booleano**: Agora retorna `true`/`false` para indicar sucesso/falha
2. **`loadChapter` aborta se save falhar**: Evita perda de conteúdo ao trocar de capítulo com erro de rede
3. **`rename` só atualiza estado local com sucesso do servidor**: Evita dessincronização UI/dados

**Pendente:**

- [ ] Testar em ambiente com PostgreSQL
- [ ] Implementar salvamento automático (Etapa 3)
- [ ] Implementar contadores em tempo real (Etapa 3)
- [ ] Adicionar suporte a mobile (sidebar colapsável)

---

_Criado em: 26/07/2026_
_Versão: 1.2_
