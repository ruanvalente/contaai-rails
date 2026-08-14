# Plano de Ação — Importação de Capítulos no Editor (ContaAI)

## Visão Geral

Esta feature permite que usuários importem arquivos de texto (.txt, pdf, .md opcional) para criar capítulos de um livro, seguindo um pipeline estruturado de importação → análise → prévia editável → confirmação → persistência.

O objetivo é **reutilizar o máximo possível** o fluxo existente de edição de capítulos, evitando criar um sistema paralelo. O conteúdo importado deve ser compatível com o contrato atual do Editor (Tiptap HTML).

---

## Fase 1 — Auditoria da Codebase (Concluída)

### Modelos Identificados

| Modelo    | Atributos Relevantes                                  | Associações                                                                 |
| --------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `Book`    | title, author_name, category, status, word_count      | `has_many :chapters` (ordered by position), `has_one_attached :cover_image` |
| `Chapter` | title, content, position, word_count, character_count | `belongs_to :book`, `touch: true`                                           |

### Controllers Identificados

| Controller           | Ações Principais                                     |
| -------------------- | ---------------------------------------------------- |
| `BooksController`    | new, create, update, publish, unpublish, write, read |
| `ChaptersController` | index, show, create, update, destroy, reorder        |

### Rotas

- `resources :books do ... resources :chapters, only: [:index, :show, :create, :update, :destroy] do ... patch :reorder, on: :collection ... end`
- Endpoint `POST /books/:book_id/chapters` para criar capítulo
- Endpoint `PATCH /books/:book_id/chapters/reorder` para reordenar

### Views/Componentes do Editor

- `app/views/books/write.html.erb` - layout principal com sidebar de capítulos e editor Tiptap
- `app/javascript/controllers/editor_controller.js` - controle Stimulus do editor
- `app/javascript/controllers/chapter_panel_controller.js` - drag & drop, add/delete/rename capítulos
- Editor usa `@tiptap/core` + `@tiptap/starter-kit` para formatação rica

### JavaScript/Stimulus/Turbo

- Editor controller gerencia conteúdo, word count, character count, auto-save
- Chapter panel controller gerencia reorder (drag & drop), delete, rename
- Turbo frames para navegação entre capítulos

### Serviços/Concerns Existentes

| Concern                   | Responsabilidade                                                  |
| ------------------------- | ----------------------------------------------------------------- |
| `ContentSanitizer`        | Sanitização HTML - tags e atributos permitidos                    |
| `ChapterWordCountConcern` | Cálculo de word_count e character_count a partir do conteúdo HTML |
| `ApplicationJob`          | Base para jobs background                                         |

### Validações eCallbacks

- **Chapter**: validates :title presence, validates :position numericality >= 0
- **Book**: validates :title, :author_name, :category presence; publishable? check
- **Callbacks**: before_save :sanitize_content, :recalculate_word_and_char_count_from_content; after_save/recalculate_book_word_count; after_destroy :reorder_positions

### Estrutura de Armazenamento no Banco

- `chapters.content` - texto no formato HTML (Tiptap)
- `chapters.word_count` - contador inteiro
- `chapters.character_count` - contador inteiro
- `books.content` - conteúdo completo do livro (montado dos capítulos na publicação)

### Testes Existentes

- `test/models/chapter_test.rb` - validações, word_count, character_count, sanitização XSS
- `test/fixtures/books.yml` e `test/fixtures/chapters.yml` - dados de teste

### Mecanismo de Publicação

- `BooksController#publish` - monta conteúdo: `<h2>#{title}</h2>\n\n#{content}` para cada capítulo ordenado
- Valida que livro tem título, capítulos com word_count > 0 e category definida

### Mecanismo de Auto-save

- Stimulus editor controller dispatches `editor:contentChanged` com wordCount e text
- Auto-save job salva a cada 30 segundos (configurável)

---

## Fase 2 — Definir Formato de Importação

### MVP (Primeira Versão)

| Formato        | Extensão                       | Observações                  |
| -------------- | ------------------------------ | ---------------------------- |
| Texto puro     | `.txt`                         | Ponto de partida recomendado |
| Markdown       | `.md`                          | Opcional - parsing simples   |
| Codificação    | `UTF-8`                        | Obrigatório                  |
| Tamanho máximo | Configurável (ex: 5MB ou 10MB) | Para evitar DDoS             |

### Formato de Arquivo de Exemplo

```
O Mistério da Floresta

Capítulo 1
A chegada

Era uma noite escura...

Capítulo 2
A descoberta

João caminhou pela floresta...

Capítulo 3
O segredo

Depois de algumas horas...
```

### Estrutura Esperada Pós-Parse

```ruby
[
  { title: "Capítulo 1 — A chegada", content: "<p>Era uma noite escura...</p>" },
  { title: "Capítulo 2 — A descoberta", content: "<p>João caminhou...</p>" },
  { title: "Capítulo 3 — O segredo", content: "<p>Depois de algumas horas...</p>" }
]
```

### Padrões de Detecção de Capítulo

O parser deve reconhecer:

```
Capítulo 1         → título "Capítulo 1"
CAPÍTULO 1         → título "CAPÍTULO 1"
Capítulo I         → título "Capítulo I" (romanos)
CAPÍTULO I         → título "CAPÍTULO I" (romanos)
Chapter 1          → título "Chapter 1"
CHAPTER 1          → título "CHAPTER 1"
1                  → se seguido de texto, pode ser capítulo
```

### Informação de Confiança

O parser deve retornar `confidence` para cada capítulo detectado:

```ruby
{
  title: "Capítulo 1 — A chegada",
  content: "<p>Era uma noite escura...</p>",
  confidence: 0.95
}
```

Se a confiança for baixa (< 0.7), o capítulo deve ser marcado para revisão manual.

---

## Fase 3 — Criar o Parser de Capítulos

### Estrutura de Pastas Recomendada

```
app/services/
└── chapter_importer/
    ├── text_parser.rb
    ├── chapter_detector.rb
    └── importer.rb
```

### Responsabilidades

1. **text_parser.rb** - Lê o arquivo, detecta encoding, retorna string bruta
2. **chapter_detector.rb** - Analisa texto procurando padrões de capítulo, retorna array de capítulos com títulos, conteúdo e confidence
3. **importer.rb** - Orquestra o pipeline: parser → detector → estrutura temporária

### API do Parser

```ruby
# Entrada: caminho do arquivo
# Saída: BookImport com dados estruturados (não grava no DB imediatamente)

BookImport.new(
  file: file_object,
  book: book_object
).imported_chapters
# => [
#      { title: "Capítulo 1 — A chegada", content: "<p>...</p>", confidence: 0.98 },
#      { title: "Capítulo 2 — A descoberta", content: "<p>...</p>", confidence: 0.92 }
#    ]
```

### Não criar registros no banco imediatamente

O parser produz apenas dados temporários em memória ou via `BookImport` model (ver Fase 4). A persistência acontece apenas após confirmação na Fase 7.

---

## Fase 4 — Estratégia de Identificação dos Capítulos

### Padrões Conservadores

O detector **não deve assumir** que toda linha inicial de capítulo é realmente um capítulo. Ele deve:

1. Buscar padrões conhecidos no início de linhas
2. Verificar se há conteúdo significativo após o padrão
3. Retornar `confidence` baseada na certeza da detecção

### Exemplos de Padrões

```
Entrada: "Capítulo 1\nA chegada\n\nEra uma noite..."
Saída: { title: "Capítulo 1 — A chegada", confidence: 0.98 }

Entrada: "1\nA chegada\n\nEra uma noite..."
Saída: { title: "1 — A chegada", confidence: 0.6 } → requer revisão

Entrada: "Alguma introdução\n\nCapítulo 1\nA chegada..."
Saída: { title: "Capítulo 1 — A chegada", confidence: 0.95 } (ignora introdução)
```

### Lógica de Confiança

- **Alto (0.8 - 1.0)**: Padrão "Capítulo X" ou "Chapter X" no início da linha
- **Médio (0.5 - 0.7)**: Número seguido de quebra de linha + texto significativo
- **Baixo (< 0.5)**: Não classificar como capítulo, tratar como conteúdo comum

---

## Fase 5 — Criar Etapa de "Import Preview"

### Layout Desktop

```
┌───────────────────────────────────────┐
│ Importar texto                        │
│                                       │
│ ✓ arquivo.txt                         │
│                                       │
│ Encontramos 12 capítulos              │
│                                       │
│ [ Continuar para revisão ]            │
└───────────────────────────────────────┘
```

### Layout da Prévia (Após clicar "Continuar")

```
┌───────────────────────────────────────────────┐
│ Revisar importação                                │
│                                                   │
│ 12 capítulos encontrados                         │
│                                                   │
│ ┌─────────────────────────────────────────┐   │
│ │ 1. A chegada                         ⋮ │   │
│ │                                     │   │
│ │ [editor de conteúdo]                    │   │
│ └─────────────────────────────────────────┘   │
│                                                   │
│ ┌─────────────────────────────────────────┐   │
│ │ 2. A descoberta                      ⋮ │   │
│ │                                     │   │
│ │ [editor de conteúdo]                    │   │
│ └─────────────────────────────────────────┘   │
│                                                   │
│ [Cancelar]                [Confirmar]           │
└───────────────────────────────────────────────┘
```

### Requisitos da Prévia

1. Mostrar lista de capítulos detectados com títulos e preview de conteúdo
2. Cada capítulo deve ser editável usando o **mesmo Editor Tiptap** do fluxo normal
3. Permitir reordenar por drag & drop
4. Permitir excluir capítulos
5. Permitir adicionar novos capítulos
6. Mobile-first: layout coluna única em dispositivos menores

---

## Fase 6 — Prévia deve ser Realmente Editável

### Reutilização do Editor Existente

O componente de preview deve usar o mesmo `Editor` Stimulus controller já presente em `write.html.erb`. Isso evita ter dois editores diferentes e garante consistência.

### Como reutilizar

1. Cada capítulo na preview terá seu próprio `data-editor-...` attributes
2. O controller já sabe lidar com `chapterId`, `chapterTitle`, `content` values
3. Ao salvar um capítulo na preview, usa-se o mesmo endpoint `PATCH /books/:book_id/chapters/:id`

### Formato de Conteúdo

O conteúdo importado deve ser convertido para o formato HTML compatível com o Editor atual (Tiptap). O parser deve produzir HTML limpo usando as tags permitidas do `ContentSanitizer`.

---

## Fase 7 — Operações Disponíveis na Prévia

| Operação      | Descrição                                                    |
| ------------- | ------------------------------------------------------------ |
| **Editar**    | Alterar título e conteúdo do capítulo usando o Editor Tiptap |
| **Reordenar** | Drag & drop para mover capítulos entre posições              |
| **Excluir**   | Remover capítulo da lista                                    |
| **Adicionar** | + Botão para adicionar capítulo em branco                    |
| **Dividir**   | (Futuro) Dividir um capítulo em dois                         |

### Drag & Drop

- Interfaces desktop: lista lateral com drag & drop
- Mobile: botão "reordenar" ou swipe para reordenar

---

## Fase 8 — Persistência Temporária

### Estrutura `BookImport`

```ruby
class BookImport < ApplicationRecord
  belongs_to :book
  belongs_to :user

  enum status: { pending: 0, processing: 1, ready: 2, confirmed: 3, failed: 4 }

  filename: string
  parsed_data: json  # Armazena o array de capítulos detectados
  error_message: text
  created_at: datetime
  updated_at: datetime
end
```

### Opção Recomendada: BookImport Model

Fornece mais controle sobre o fluxo:

```
Upload
  ↓
Parser
  ↓
BookImport (status: pending, parsed_data salvo)
  ↓
Preview UI
  │       ↑
  │ Editar  │
  │       │
  └── Confirma → Transaction → Chapters no DB
```

### Status do BookImport

- `pending` - Aguardando processamento
- `processing` - Parser está rodando
- `ready` - Parsing concluído, preview disponível
- `confirmed` - Chapters salvos no banco
- `failed` - Erro durante importação

---

## Fase 9 — Fluxo Definitivo

```
                 Upload
                    │
                    ▼
           Import Controller
                    │
                    ▼
              Import Service
                    │
                    ▼
               Text Parser
                    │
                    ▼
           Chapter Detection
                    │
                    ▼
              BookImport ──────┐
                    │           │
                    ▼           │
           Preview UI    │ Editar  │
                    │           │
                    └───────┬───────┘
                            │
                            ▼
                      Confirmar
                            │
                            ▼
                   Transaction Rails
                    │           │
            ┌───────────┴───────┐
            ▼                   ▼
         Chapters           Book data
```

---

## Fase 10 — Transação no Momento da Confirmação

A confirmação deve ser feita dentro de uma transação ActiveRecord:

```ruby
ActiveRecord::Base.transaction do
  # 1. Criar capítulos
  parsed_chapters.each do |chapter_data|
    book.chapters.create!(
      title: chapter_data[:title],
      content: chapter_data[:content],
      position: next_position
    )
  end

  # 2. Atualizar posições se necessário
  # 3. Atualizar contadores do livro (word_count, etc.)
end
```

### Comportamento Desejado

- **Sucesso**: Todos os capítulos salvos → usuário levado ao Editor
- **Erro**: Rollback completo → nenhum capítulo criado, mostrar mensagem de erro

---

## Fase 11 — Integração com o Editor Existente

### Verificar no Código Atual

1. **Como o conteúdo do capítulo é armazenado**: `chapters.content` como texto HTML
2. **Qual formato HTML é utilizado**: Tiptap HTML com tags permitidas pelo `ContentSanitizer`
3. **Como o Editor salva**: Stimulus controller envia conteúdo via PATCH para `/books/:book_id/chapters/:id`
4. **Autosave**: Já implementado no editor controller
5. **Word count / Character count**: Já implementado via `ChapterWordCountConcern`
6. **Sanitização HTML**: Já implementada via `ContentSanitizer` concern
7. **Publicação**: `BooksController#publish` monta conteúdo dos capítulos
8. **Status do capítulo**: `status` enum no book (draft/published/archived)
9. **Ordenação**: `position` integer no chapter, order ASC
10. **Criação/edição de capítulos**: `ChaptersController#create/update`

### Contrato do Importador

O importador deve produzir conteúdo que satisfaça:

- Tags HTML permitidas: `h1-h6, p, strong, em, u, s, ul, ol, li, blockquote, a, code, pre, hr, br`
- Atributos permitidos: `href, title, target, rel, align`
- Word count e character count calculados automaticamente pelos callbacks

---

## Fase 12 — Segurança

### Validações Obrigatórias

| Tipo                               | Descrição                                           |
| ---------------------------------- | --------------------------------------------------- |
| **Extensão**                       | Apenas `.txt` e `.md` permitidos                    |
| **MIME type**                      | Validar do lado do servidor, não confiar no cliente |
| **Tamanho máximo**                 | Configurável (ex: 5MB)                              |
| **Encoding**                       | Forçar UTF-8                                        |
| **Conteúdo vazio**                 | Rejeitar arquivos sem conteúdo                      |
| **Caracteres inválidos**           | Verificar BOM, encoding inválido                    |
| **Conteúdo excessivamente grande** | Limite de tamanho após parsing                      |

### Sanitização

- Nunca confiar em `params[:file].original_filename` ou MIME do cliente
- Validar conteúdo após o upload
- Usar `ContentSanitizer` para limpar qualquer HTML no conteúdo importado
- Limitar tamanho máximo de texto por capítulo

---

## Fase 13 — UX / Mobile First

### Desktop

```
┌──────────────┬────────────────────────────┐
│ Capítulos    │ Editor                     │
│              │                            │
│ 1. Capítulo 1│ Conteúdo                   │
│ 2. Capítulo 2│                            │
│ 3. Capítulo 3│                            │
└──────────────┴────────────────────────────┘
```

### Mobile

```
┌───────────────────────┐
│ Revisar importação    │
│                       │
│ 12 capítulos          │
│                       │
│ ┌───────────────────┐ │
│ │ Capítulo 1        │ │
│ │                   │ │
│ │ Editor            │ │
│ │                   │ │
│ └───────────────────┘ │
│                       │
│ [ Confirmar ]         │
└───────────────────────┘
```

### Princípios

- Evitar interface excessivamente complexa no mobile
- Toques e gestos devem ser intuitivos
- Botões grandes o suficiente para touch
- Scroll suave entre capítulos

---

## Fase 14 — Feedback durante Processamento

### Para Arquivos Pequenos

```
Importando arquivo...
✓ Arquivo recebido
✓ Conteúdo analisado
✓ Capítulos identificados

12 capítulos encontrados
```

### Para Arquivos Grandes

```
Importando arquivo...
✓ Arquivo recebido
✓ Conteúdo analisado
✓ Capítulos identificados

12 capítulos encontrados
```

### Em Caso de Erro

```
Não conseguimos identificar automaticamente
os capítulos desse arquivo.

Você pode revisar a estrutura manualmente.
```

---

## Fase 15 — Testes

### Testes Unitários do Parser

| Cenário               | Descrição                                    |
| --------------------- | -------------------------------------------- |
| Caso básico           | Capítulo 1 + Capítulo 2 em arquivo TXT       |
| Maiúsculas            | "CAPÍTULO 1" detectado                       |
| Algoritmos romanos    | "CAPÍTULO I" detectado                       |
| Arquivo sem capítulos | "Era uma vez..." → nenhum capítulo detectado |
| Capítulo sem conteúdo | "Capítulo 1" + vazio                         |
| Arquivo vazio         | Nenhum capítulo, erro ou empty state         |
| Arquivo muito grande  | Testar limite de tamanho                     |
| Encoding              | Caracteres acentuados (á, ç, ã, é)           |
| Conteúdo malformado   | Textos sem estrutura clara                   |

### Testes do Controller

- `POST /books/:book_id/import` - upload e processamento
- `GET /books/:book_id/import/preview` - mostrar preview
- `PATCH /books/:book_id/import/confirm` - confirmar e persistir

### Testes de Serviço

- `BookImporter.import` - pipeline completo
- `ChapterDetector.detect` - padrões de capítulo
- `TextParser.parse` - leitura e normalização

### Testes de Integração/E2E

Fluxo completo:

```
Usuário
  ↓
abre importação
  ↓
seleciona arquivo
  ↓
upload
  ↓
preview
  ↓
edita capítulo
  ↓
reordena
  ↓
remove capítulo
  ↓
confirma
  ↓
abre Editor
  ↓
verifica capítulos
```

---

## Fase 16 — Testes de Integração/E2E

### Cenário Completo

1. Usuário abre página de um livro em rascunho
2. Clica em "Importar texto"
3. Seleciona arquivo `.txt` com capítulos
4. Upload acontece e capítulos são detectados
5. Tela de preview é mostrada com 12 capítulos
6. Usuário edita título do Capítulo 3
7. Usuário reordena capítulos (drag & drop)
8. Usuário remove Capítulo 2
9. Usuário confirma importação
10. Sistema cria capítulos no banco de dados
11. Usuário é direcionado ao Editor
12. Verifica-se que capítulos foram criados com conteúdo correto

### Evitar Regressões

- Certificar-se de que editor existente ainda funciona após a feature
- Testar que word count e character count são atualizados corretamente
- Testar publicação após importação

---

## Fase 17 — Observabilidade

### Logs de Erro

```ruby
BookImport.create!(
  book: book,
  user: current_user,
  filename: file.original_filename,
  status: "failed",
  error: "Unable to detect chapters"
)
```

### Não Salvar Conteúdo Completo em Logs

- Nunca logar o conteúdo completo do arquivo ou dos capítulos
- Apenas logar metadados: filename, status, error type

### Métricas Interessantes

| Métrica             | Descrição                                         |
| ------------------- | ------------------------------------------------- |
| `imports_started`   | Quantidade de imports iniciados                   |
| `imports_completed` | Quantidade de imports que chegaram ao fim         |
| `imports_failed`    | Quantidade de imports com erro                    |
| `chapters_detected` | Total de capítulos detectados em todos os imports |

---

## Roadmap Recomendado

| Fase | Objetivo               | Prioridade |
| ---- | ---------------------- | ---------- |
| 1    | Auditoria do Editor    | 🔴 Alta    |
| 2    | Definição do formato   | 🔴 Alta    |
| 3    | Parser TXT             | 🔴 Alta    |
| 4    | Detecção de capítulos  | 🔴 Alta    |
| 5    | BookImport model       | 🔴 Alta    |
| 6    | Upload                 | 🔴 Alta    |
| 7    | Preview UI             | 🔴 Alta    |
| 8    | Edição dos capítulos   | 🔴 Alta    |
| 9    | Reordenação            | 🟠 Média   |
| 10   | Confirmação/transação  | 🔴 Alta    |
| 11   | Integração com Editor  | 🔴 Alta    |
| 12   | Segurança              | 🔴 Alta    |
| 13   | Mobile UX              | 🟠 Média   |
| 14   | Testes                 | 🔴 Alta    |
| 15   | E2E                    | 🟠 Média   |
| 16   | Observabilidade        | 🟡 Baixa   |
| 17   | DOCX/Markdown avançado | 🟡 Futuro  |

### MVP Fechado

TXT → Parser → Detecção → Preview → Edição → Reordenação → Confirmação → Chapters

### Segunda Etapa

DOCX → Markdown → PDF → divisão/mesclagem inteligente → IA para identificação de capítulos.

---

## Detalhe Importante para o ContaAI

**Evitar IA como requisito inicial.** O parser determinístico resolve grande parte dos arquivos estruturados e é mais previsível. A plataforma poderia oferecer:

> "Não conseguimos identificar claramente os capítulos. Deseja que o ContaAI tente organizar automaticamente o texto?"

A IA atua como camada complementar, não básica. A etapa de preview permite corrigir problemas de parsing antes de alterar capítulos reais do livro, o que se encaixa perfeitamente no fluxo atual do Editor.
