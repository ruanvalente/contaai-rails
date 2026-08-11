# ContaAI

Plataforma web para escrita, publicação e leitura de livros. O ContaAI permite que escritores criem obras com um editor rich-text, publiquem-nas para a comunidade e acompanhem métricas de leitura, enquanto leitores podem explorar, ler, favoritar e avaliar livros.

## Visão geral

O ContaAI resolve o problema de conectar escritores e leitores em uma única plataforma:

- **Escritores** criam livros (título, sinopse, capa, categoria), escrevem capítulos em um editor rich-text com salvamento automático, reordenam capítulos via drag-and-drop, e publicam ou despublicam obras quando estiverem prontas.
- **Leitores** exploram livros publicados por categoria, buscam por título, autor ou descrição, leem as obras diretamente no navegador, avaliam com notas de 1 a 5 e marcam favoritos.
- **Autores** podem seguir outros autores e ser seguidos, formando uma rede social de escrita.

A aplicação é um **Rails fullstack** (server-rendered) com **Hotwire** (Turbo + Stimulus) para melhorias progressivas e interações dinâmicas sem a complexidade de um SPA. O frontend e o backend estão integrados no mesmo processo Rails: as views ERB renderizam o HTML, e os Stimulus controllers gerenciam interações como o editor de escrita, busca instantânea e modal de publicação.

## Stack tecnológica

### Backend

| Tecnologia       | Versão                                      | Finalidade                                |
| ---------------- | ------------------------------------------- | ----------------------------------------- |
| Ruby             | 3.4.10 (`.ruby-version`)                    | Linguagem                                 |
| Ruby on Rails    | 8.1.3 (`Gemfile`)                           | Framework web                             |
| PostgreSQL       | 17 (Supabase local, `supabase/config.toml`) | Banco de dados                            |
| Puma             | 8.0 (`Gemfile.lock`)                        | Servidor web                              |
| Devise           | 5.0 (`Gemfile.lock`)                        | Autenticação                              |
| Solid Queue      | 1.4 (`Gemfile.lock`)                        | Background jobs                           |
| Solid Cache      | 1.0 (`Gemfile.lock`)                        | Cache                                     |
| Solid Cable      | 4.0 (`Gemfile.lock`)                        | Action Cable                              |
| Active Storage   | Rails                                       | Upload de arquivos                        |
| image_processing | 1.14 (`Gemfile.lock`)                       | Processamento de imagens                  |
| Kamal            | 2.12 (`Gemfile.lock`)                       | Deploy                                    |
| Thruster         | 0.1 (`Gemfile.lock`)                        | Servidor de produção (assets/compression) |

### Frontend

| Tecnologia                                                 | Versão                | Finalidade                    |
| ---------------------------------------------------------- | --------------------- | ----------------------------- |
| ERB + Turbo Rails                                          | 8.0 (`package.json`)  | Templates server-side + Turbo |
| Stimulus                                                   | 3.2 (`package.json`)  | Interações JavaScript         |
| Hotwire                                                    | —                     | Aceleração de página SPA-like |
| TipTap                                                     | 3.29 (`package.json`) | Editor rich-text              |
| TailwindCSS                                                | 4.3 (`package.json`)  | Estilos                       |
| Flowbite                                                   | 4.0 (`package.json`)  | Componentes UI                |
| esbuild                                                    | 0.28 (`package.json`) | Bundler JavaScript            |
| Google Fonts (Inter, Playfair Display, Cormorant Garamond) | —                     | Tipografia                    |

### Infraestrutura

| Ferramenta       | Finalidade                                            |
| ---------------- | ----------------------------------------------------- |
| Docker           | Containerização (Dockerfile)                          |
| Supabase (local) | Banco PostgreSQL e serviços locais de desenvolvimento |
| GitHub Actions   | CI (`.github/workflows/ci.yml`)                       |
| Kamal            | Deploy em servidores                                  |

## Arquitetura

A aplicação segue a arquitetura **Monolítico Modular** padrão do Rails: controllers → models, com views server-side e JavaScript progressivo via Stimulus.

### Fluxo de uma requisição

```mermaid
sequenceDiagram
    participant Browser
    participant Rails (controller)
    participant Model/DB
    participant View (ERB)

    Browser->>Rails (controller): GET /books/1
    Rails (controller)->>Model/DB: Book.find(1)
    Model/DB-->>Rails (controller): @book
    Rails (controller)->>View (ERB): render "books/show"
    View (ERB)-->>Browser: HTML (com Turbo/Stimulus)
```

### Relação frontend/backend

- **Views ERB** geram o HTML e injetam os dados via instance variables dos controllers.
- **Stimulus controllers** (`app/javascript/controllers/`) se conectam ao DOM via atributos `data-controller`, `data-action` e `data-*` values.
- **Turbo Frames/Streams** são usados para atualizações parciais (ex.: `search/index.html.erb` responde com `format.turbo_stream`).
- **Endpoints JSON** adicionais para o editor de escrita (capítulos) e busca — consumidos via `fetch` nos controllers Stimulus.

### Camada de escrita (Editor)

A funcionalidade mais complexa da aplicação utiliza **TipTap** integrado ao Rails:

1. A view `books/write.html.erb` renderiza o editor com múltiplos Stimulus controllers (`editor`, `chapter-panel`, `auto-save`, `word-count`, `publish`, `editor-sidebar`).
2. O editor TipTap (`editor_controller.js`) gerencia formatação (negrito, itálico, títulos, listas, citações), undo/redo e expõe o conteúdo via eventos customizados (`editor:contentChanged`).
3. O `auto_save_controller.js` salva automaticamente o capítulo via `fetch` (JSON) após 30 segundos de inatividade, ao mudar de capítulo, ao ocultar a aba, ao navegar (Turbo visit) ou ao fechar a página (sendBeacon).
4. O `chapter_panel_controller.js` gerencia a criação, exclusão, renomeação (double-click) e reordenação (drag-and-drop) de capítulos via API JSON.
5. Ao publicar, o `books_controller#publish` consolida todos os capítulos em um único conteúdo (`content` da tabela `books`) no formato Markdown-like (`## Título\n\nConteúdo`).

### Autenticação

Devise gerencia toda a autenticação:

- Módulos: `database_authenticatable`, `registerable`, `recoverable`, `rememberable`, `validatable`, `confirmable`, `lockable`, `trackable`.
- Roles: `reader` (0) e `author` (1), definidos como enum no model `User`.
- Redirecionamento pós-login: `/dashboard`.
- Permissões por controller: `before_action :authenticate_user!` e verificações manuais de ownership (ex.: `authorize_book_owner!` no `BooksController`).
- Layouts dinâmicos: `devise` para controllers Devise, `authenticated` para usuários logados, `application` para visitantes.

### Persistência de dados

PostgreSQL (via adaptador `pg`). No ambiente de desenvolvimento, conecta-se ao Supabase local (porta 54322). Em produção, utiliza `contaai_rails_production` (ou override via `DATABASE_URL`).

### Upload de arquivos

Active Storage com serviço `local` (disco). O `User` tem um avatar (`avatar` attachment) e os `Book` têm uma `cover_image` attachment. O processamento de imagens (variants) é feito com `image_processing` (mini_magick + ruby-vips).

## Estrutura do projeto

```text
app/
├── assets/
│   ├── build/              # Assets compilados (gerado por esbuild/tailwind)
│   ├── stylesheets/        # Tailwind CSS + tema
│   └── tailwind/           # CSS base do Tailwind
├── controllers/
│   ├── books_controller.rb
│   ├── chapters_controller.rb
│   ├── dashboard_controller.rb
│   ├── explore_controller.rb
│   ├── landing_controller.rb
│   ├── library_controller.rb
│   ├── favorites_controller.rb
│   ├── reading_controller.rb
│   ├── downloads_controller.rb
│   ├── settings_controller.rb
│   ├── search_controller.rb
│   ├── categories_controller.rb
│   └── pages_controller.rb
├── helpers/
│   ├── application_helper.rb
│   └── navigation_helper.rb
├── javascript/
│   ├── application.js      # Entry point (Turbo + Stimulus + Flowbite)
│   └── controllers/        # Stimulus controllers
├── jobs/                   # ApplicationJob
├── mailers/                # ApplicationMailer
├── models/
│   ├── user.rb
│   ├── book.rb
│   ├── chapter.rb
│   ├── rating.rb
│   ├── favorite.rb
│   ├── author_follow.rb
│   ├── reading_progress.rb
│   └── user_reading_preference.rb
└── views/
    ├── books/              # CRUD, read, write, modals
    ├── chapters/           # JBuilder + Turbo Stream
    ├── dashboard/
    ├── devise/             # Views Devise
    ├── explore/
    ├── landing/
    ├── library/
    ├── favorites/
    ├── reading/
    ├── downloads/
    ├── settings/
    ├── search/
    ├── categories/
    ├── layouts/            # application, authenticated, devise, mailer
    ├── pages/
    ├── pwa/                # Manifest + Service Worker
    └── shared/             # flash, sidebar, header, footer, modals

bin/
├── dev                    # Inicia servidor + watch (foreman)
├── setup                  # Setup do ambiente
├── ci                     # CI local
├── docker-entrypoint      # Entrypoint Docker
├── kamal                  # Deploy
├── rubocop                # Lint
├── brakeman               # Segurança
└── bundler-audit          # Auditoria de gems

config/
├── routes.rb
├── database.yml
├── deploy.yml             # Configuração Kamal
├── environments/
├── initializers/
├── locales/
├── puma.rb
├── queue.yml              # Solid Queue
├── cache.yml              # Solid Cache
├── cable.yml              # Solid Cable
└── storage.yml            # Active Storage

db/
├── migrate/               # Migrations
├── schema.rb
├── cable_schema.rb
├── cache_schema.rb
├── queue_schema.rb
└── seeds.rb

supabase/                  # Configuração do Supabase local
├── config.toml
└── snippets/

.github/workflows/ci.yml   # GitHub Actions
Dockerfile
Procfile.dev
```

### Responsabilidades dos diretórios

| Diretório          | Responsabilidade                                               |
| ------------------ | -------------------------------------------------------------- |
| `app/controllers/` | Recebe requisições, autentica, autoriza e renderiza respostas  |
| `app/models/`      | Regras de negócio, validações, enums e associações             |
| `app/views/`       | Templates ERB (HTML), JBuilder (JSON), Turbo Stream            |
| `app/javascript/`  | Stimulus controllers e entry point do frontend                 |
| `app/helpers/`     | Helpers de view (ex.: ícones de sidebar, classes de navegação) |
| `app/jobs/`        | Background jobs (Atualmente somente ApplicationJob)            |
| `app/mailers/`     | Mailers (Atualmente somente ApplicationMailer)                 |
| `config/`          | Rotas, banco, ambientes, inicializers, deploy                  |
| `db/`              | Migrations, schema, seeds, schemas de solid adapters           |
| `supabase/`        | PostgreSQL local e serviços Supabase para desenvolvimento      |

## Pré-requisitos

Versões identificadas na codebase:

- **Ruby** 3.4.10 (`.ruby-version`)
- **Rails** 8.1.3 (Gemfile)
- **Bundler** 4.0.17 (Gemfile.lock)
- **Node.js** 22.20.0 (`.node-version`)
- **Yarn** 1.22.22 (package.json `packageManager`)
- **PostgreSQL** 17 (Supabase local config)
- **Docker** (para produção via Kamal)

Ferramentas necessárias:

- [Ruby](https://www.ruby-lang.org/) (via rbenv/asdf/qualquer gerenciador)
- [Node.js](https://nodejs.org/) (via nvm/qualquer gerenciador)
- [Yarn](https://yarnpkg.com/)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (para o banco local)
- [Docker](https://www.docker.com/) (para produção)

## Configuração do ambiente

### 1. Clone do repositório

```bash
git clone git@github.com:ruanvalente/contaai-rails.git
cd contaai-rails
```

### 2. Instalação das dependências Ruby

```bash
bundle install
```

### 3. Instalação das dependências JavaScript

```bash
yarn install --check-files
```

### 4. Configuração do banco de dados (Supabase local)

O banco de desenvolvimento utiliza o PostgreSQL do Supabase local rodando na porta **54322** (configurado em `config/database.yml` e `supabase/config.toml`).

```bash
supabase start
```

Isso inicia os serviços do Supabase (Postgres, Studio, Auth, Storage) na porta 54322.

### 5. Criação do banco e migrations

```bash
bin/rails db:create
bin/rails db:migrate
```

Ou, para setup completo em um único comando:

```bash
bin/rails db:setup
```

### 6. Seeds

```bash
bin/rails db:seed
```

Cria um usuário administrador:

| Campo | Valor               |
| ----- | ------------------- |
| Email | `admin@contaai.com` |
| Senha | `password123`       |

> **Atenção:** altere a senha do usuário admin antes de usar em produção.

### 7. Chave mestra (credentials)

O Rails precisa da chave mestra para descriptografar `config/credentials.yml.enc`. Em desenvolvimento, ela fica em `config/master.key` (ignorada pelo git). Se não existir, crie:

```bash
bin/rails credentials:edit
```

### 8. Inicialização da aplicação

O modo mais simples é usar o script de setup que instala dependências, prepara o banco e inicia o servidor:

```bash
bin/setup
```

Ou, manualmente:

```bash
bin/dev
```

O `bin/dev` inicia três processos via Foreman (definidos em `Procfile.dev`):

| Processo | Comando                       | Finalidade                   |
| -------- | ----------------------------- | ---------------------------- |
| `web`    | `bin/rails server`            | Servidor Rails               |
| `js`     | `yarn build --watch`          | Bundler esbuild em watch     |
| `css`    | `bin/rails tailwindcss:watch` | Compilação Tailwind em watch |

A aplicação ficará disponível em **http://localhost:3000**.

## Variáveis de ambiente

As seguintes variáveis de ambiente são utilizadas pela aplicação:

| Variável                          | Finalidade                                                        | Obrigatória      | Exemplo                                                     |
| --------------------------------- | ----------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| `CONTAAI_RAILS_DATABASE_PASSWORD` | Senha do banco PostgreSQL em produção                             | Produção         | `<secreta>`                                                 |
| `DATABASE_URL`                    | URL completa de conexão ao banco (faz override no `database.yml`) | Opcional         | `postgresql://user:password@localhost:5432/app_development` |
| `RAILS_MASTER_KEY`                | Chave mestra para credentials (usada em produção/Kamal)           | Produção         | `<secreta>`                                                 |
| `SECRET_KEY_BASE`                 | Chave secreta base do Rails (gerada a partir do master key)       | Produção         | `<secreta>`                                                 |
| `RAILS_MAX_THREADS`               | Número máximo de threads por worker Puma / conexões do pool       | Opcional         | `5`                                                         |
| `RAILS_LOG_LEVEL`                 | Nível de log em produção                                          | Opcional         | `info`                                                      |
| `PORT`                            | Porta do servidor Puma                                            | Opcional         | `3000`                                                      |
| `SOLID_QUEUE_IN_PUMA`             | Executa o supervisor Solid Queue dentro do Puma (produção)        | Produção (Kamal) | `true`                                                      |
| `JOB_CONCURRENCY`                 | Número de processos para Solid Queue workers                      | Opcional         | `1`                                                         |
| `WEB_CONCURRENCY`                 | Número de processos Puma                                          | Opcional         | `2`                                                         |
| `PIDFILE`                         | Caminho do arquivo PID                                            | Opcional         | `tmp/pids/server.pid`                                       |
| `CI`                              | Indica ambiente CI (altera eager load no ambiente de teste)       | Opcional         | `true`                                                      |

> **Importante:** Nunca commite arquivos `.env` (ignorados pelo `.gitignore`) ou exponha a `config/master.key`.

## Executando o projeto

### Servidor de desenvolvimento

```bash
bin/dev
```

Inicia Rails (porta 3000), esbuild (watch) e Tailwind (watch) simultaneamente.

### Apenas servidor Rails

```bash
bin/rails server
```

### Compilar assets (produção)

```bash
bin/rails assets:precompile
```

### Console Rails

```bash
bin/rails console
```

### Docker (produção)

```bash
docker build -t contaai_rails .
docker run -d -p 80:80 -e RAILS_MASTER_KEY=<value from config/master.key> --name contaai_rails contaai_rails
```

## Banco de dados

### Banco utilizado

PostgreSQL versão 17 (local via Supabase). Em desenvolvimento, a conexão é:

```yaml
host: 127.0.0.1
port: 54322
database: postgres
username: postgres
password: postgres
```

Em produção, o banco principal é `contaai_rails_production`, com bancos separados para cache, fila (queue) e cable:

| Uso                 | Banco (produção)                 |
| ------------------- | -------------------------------- |
| Aplicação           | `contaai_rails_production`       |
| Cache (Solid Cache) | `contaai_rails_production_cache` |
| Fila (Solid Queue)  | `contaai_rails_production_queue` |
| Cable (Solid Cable) | `contaai_rails_production_cable` |

### Entidades e relacionamentos

```mermaid
erDiagram
    User ||--o{ Book : "author"
    User ||--o{ Rating : "gives"
    User ||--o{ Favorite : "marks"
    User ||--o{ ReadingProgress : "tracks"
    User ||--o{ UserReadingPreference : "has one"
    User ||--o{ AuthorFollow : "follows (follower)"
    User ||--o{ AuthorFollow : "is followed (author)"
    Book ||--o{ Chapter : "contains"
    Book ||--o{ Rating : "receives"
    Book ||--o{ Favorite : "has"
    Book ||--o{ ReadingProgress : "has"
```

| Entidade                   | Descrição                        | Campos chave                                                                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                    | Usuários autenticados via Devise | `email`, `name`, `role` (reader/author), `bio`, `avatar` (attachment)                                                                                                                                                                                                            |
| `books`                    | Livros                           | `title`, `author_name`, `description`, `category` (fiction/non_fiction/poetry/essay/short_story/other), `status` (draft/published/archived), `cover_color`, `cover_image` (attachment), `word_count`, `page_count`, `average_rating`, `ratings_count`, `published_at`, `content` |
| `chapters`                 | Capítulos de um livro            | `title`, `content` (HTML), `position`, `word_count`                                                                                                                                                                                                                              |
| `ratings`                  | Avaliações de livros (1-5)       | `score` (1-5, check constraint), `comment`                                                                                                                                                                                                                                       |
| `favorites`                | Favoritos de livros              | Unicidade (`user_id`, `book_id`)                                                                                                                                                                                                                                                 |
| `author_follows`           | Seguir autores                   | `follower_id`, `author_id` (check constraint impede auto-seguir)                                                                                                                                                                                                                 |
| `reading_progresses`       | Progresso de leitura             | `status` (reading/completed/paused), `percentage` (0-100), `current_position`                                                                                                                                                                                                    |
| `user_reading_preferences` | Preferências de leitura          | `font_size` (10-32), `night_mode`                                                                                                                                                                                                                                                |

### Migrations

```bash
bin/rails db:migrate        # Executa migrations pendentes
bin/rails db:rollback       # Reverte última migration
bin/rails db:migrate:status # Mostra status das migrations
```

### Seeds

```bash
bin/rails db:seed
```

## Rotas e API

### Rotas principais (públicas)

| Método | Rota              | Controller#Action     | Descrição                                       |
| ------ | ----------------- | --------------------- | ----------------------------------------------- |
| GET    | `/`               | `landing#index`       | Landing page pública com livros em destaque     |
| GET    | `/explore`        | `explore#index`       | Explorar livros publicados e categorias         |
| GET    | `/categories`     | `categories#index`    | Lista livros por categoria (param `?category=`) |
| GET    | `/search`         | `search#index`        | Busca por livros (param `?q=`)                  |
| GET    | `/books`          | `books#index`         | Lista livros publicados                         |
| GET    | `/books/:id`      | `books#show`          | Detalhes de um livro                            |
| GET    | `/books/:id/read` | `books#read`          | Tela de leitura                                 |
| GET    | `/flowbite-test`  | `pages#flowbite_test` | Página de teste Flowbite                        |
| GET    | `/up`             | `rails/health#show`   | Health check                                    |

### Rotas de autenticação (Devise)

| Método        | Rota                  | Descrição            |
| ------------- | --------------------- | -------------------- |
| GET/POST      | `/users/sign_in`      | Login                |
| DELETE        | `/users/sign_out`     | Logout               |
| GET/POST      | `/users/sign_up`      | Registro             |
| GET/POST      | `/users/password`     | Recuperação de senha |
| GET/POST      | `/users/confirmation` | Confirmação de email |
| GET/POST      | `/users/unlock`       | Desbloqueio de conta |
| GET/PATCH/PUT | `/users/edit`         | Edição de perfil     |

### Rotas autenticadas

| Método | Rota         | Controller#Action | Descrição                                        |
| ------ | ------------ | ----------------- | ------------------------------------------------ |
| GET    | `/dashboard` | `dashboard#index` | Painel com estatísticas pessoais e da plataforma |
| GET    | `/library`   | `library#index`   | Biblioteca do usuário                            |
| GET    | `/downloads` | `downloads#index` | Downloads do usuário (placeholder)               |
| GET    | `/favorites` | `favorites#index` | Livros favoritos                                 |
| GET    | `/reading`   | `reading#index`   | Leitura em andamento (placeholder)               |
| GET    | `/settings`  | `settings#index`  | Configurações do usuário                         |

### Rotas de livros (CRUD + ações)

| Método    | Rota                   | Descrição                                      |
| --------- | ---------------------- | ---------------------------------------------- |
| GET       | `/books/new`           | Novo livro                                     |
| POST      | `/books`               | Criar livro                                    |
| GET       | `/books/:id/edit`      | Editar livro                                   |
| PATCH/PUT | `/books/:id`           | Atualizar livro                                |
| DELETE    | `/books/:id`           | Excluir livro                                  |
| PATCH     | `/books/:id/publish`   | Publicar livro                                 |
| PATCH     | `/books/:id/unpublish` | Despublicar livro                              |
| GET       | `/books/:id/write`     | Editor de escrita (autenticado, somente owner) |
| GET       | `/books/:id/read`      | Tela de leitura                                |

### Rotas de capítulos (API JSON)

| Método | Rota                                   | Descrição                                   | Autenticação   |
| ------ | -------------------------------------- | ------------------------------------------- | -------------- |
| GET    | `/books/:book_id/chapters`             | Lista capítulos (JSON)                      | Requer login   |
| GET    | `/books/:book_id/chapters/:id`         | Detalhe capítulo (JSON)                     | Requer login   |
| POST   | `/books/:book_id/chapters`             | Criar capítulo (JSON)                       | Owner do livro |
| PATCH  | `/books/:book_id/chapters/:id`         | Atualizar capítulo (JSON)                   | Owner do livro |
| DELETE | `/books/:book_id/chapters/:id`         | Excluir capítulo (JSON)                     | Owner do livro |
| PATCH  | `/books/:book_id/chapters/:id/reorder` | Reordenar capítulo (JSON, param `position`) | Owner do livro |

### Exemplo de request/response (capítulos)

**Criar capítulo:**

```bash
curl -X POST http://localhost:3000/books/1/chapters \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token>" \
  -d '{"chapter":{"title":"Capítulo 1","position":0}}'
```

**Response (201 Created):**

```json
{
  "id": 1,
  "title": "Capítulo 1",
  "content": null,
  "position": 0,
  "word_count": 0,
  "book_id": 1,
  "created_at": "2026-07-26T00:00:00.000Z",
  "updated_at": "2026-07-26T00:00:00.000Z"
}
```

## Autenticação e autorização

### Autenticação

O sistema usa **Devise** com os seguintes módulos para o model `User`:

- `database_authenticatable` — login com email + senha (bcrypt)
- `registerable` — registro de novos usuários
- `recoverable` — recuperação de senha
- `rememberable` — "lembrar-me" via cookie
- `validatable` — validações de email e senha (mínimo 6 caracteres)
- `confirmable` — confirmação de email (com `reconfirmable`)
- `lockable` — bloqueio de conta após tentativas falhas (via `failed_attempts`)
- `trackable` — rastreamento de login (sign_in_count, IPs, timestamps)

### Papéis (Roles)

O model `User` possui um enum `role`:

| Valor | Constante | Descrição |
| ----- | --------- | --------- |
| 0     | `reader`  | Leitor    |
| 1     | `author`  | Escritor  |

### Autorização

Não há gem de autorização (como Pundit/CanCanCan). A autorização é feita manualmente nos controllers:

- `before_action :authenticate_user!` — exige login (usado em todos os controllers autenticados).
- `authorize_book_owner!` — verifica se `@book.user == current_user` para ações de edição, exclusão e escrita.
- `publish`/`unpublish` — verificam se `@book.user == current_user` e respondem `403 Forbidden` em JSON ou redirect com `alert` em HTML.

### Sessão

- Redireciona para `/dashboard` após login (`after_sign_in_path_for`).
- Layout `authenticated` com sidebar é usado para usuários logados.
- Layout `devise` para páginas de autenticação.

## Principais funcionalidades

### Escrita e publicação de livros

- **CRUD completo de livros** com título, sinopse, categoria, cor da capa e upload de imagem.
- **Editor rich-text** (TipTap) com formatação de texto (B/I/U), títulos (H1-H3), listas, citações, separador, undo/redo.
- **Gerenciamento de capítulos**: criação, renomeação (double-click), exclusão, reordenação (drag-and-drop).
- **Salvamento automático**: auto-save via fetch (30s debounce), sendBeacon ao fechar a página, salvamento ao trocar de aba e ao navegar com Turbo.
- **Contador de palavras e caracteres** em tempo real.
- **Publicação**: valida pré-requisitos (título, pelo menos um capítulo com conteúdo, categoria) e consolida capítulos em um conteúdo único.
- **Despublicação**: retorna o livro ao status `draft`.
- **Modal de exclusão**: exige digitar o título do livro para confirmar.

### Exploração e descoberta

- **Landing page** com hero, livros em destaque, seções de comunidade e CTA.
- **Explorar**: livros publicados recentes + categorias.
- **Busca**: busca instantânea (debounce 300ms) por título, nome do autor ou descrição, com resultados em dropdown (Turbo Stream / HTML).
- **Categorias**: filtro por categoria (fiction, non_fiction, poetry, essay, short_story, other).
- **Leitura**: tela dedicada de leitura (`/books/:id/read`) com conteúdo do livro em fonte serifada.

### Rede social

- **Favoritos**: marcar livros como favoritos (lista em `/favorites`).
- **Seguir autores**: relacionamento de follow entre usuários (AuthorFollow).
- **Avaliações**: nota de 1 a 5 com comentário (estrutura existente em model/schema).

### Dashboard

- **Estatísticas pessoais**: total de livros, publicados, rascunhos, palavras, leituras e avaliação média.
- **Estatísticas da plataforma**: total de autores, livros publicados e leitores.
- **Lista dos livros do autor** com ações rápidas (editar, publicar, excluir).

### Configurações

- **Perfil**: visualização de nome e email (somente leitura).
- **Preferências de leitura**: modo noturno e tamanho de fonte (UI exibida, persistência via model `UserReadingPreference`).
- **Segurança**: link para alterar senha.

## Testes

A aplicação **não possui suíte de testes** atualmente. Não existem diretórios `test/` ou `spec/` nem gemas de teste (RSpec, FactoryBot, etc.) no `Gemfile`.

O framework padrão do Rails (Minitest) está disponível, mas `config.generators.system_tests = nil` desabilita a geração de system tests.

## Qualidade de código

### RuboCop

```bash
bin/rubocop
```

Usa o estilo **`rubocop-rails-omakase`** (configurado em `.rubocop.yml`). Para autocorreção:

```bash
bin/rubocop -a
```

Para formatar output GitHub Actions:

```bash
bin/rubocop -f github
```

### Brakeman (análise estática de segurança)

```bash
bin/brakeman --no-pager
```

### Bundler Audit (segurança de gems)

```bash
bin/bundler-audit
```

### Yarn Audit (segurança de dependências JS)

```bash
yarn audit
```

### CI local

O projeto inclui um script de CI local (`bin/ci`) que executa todas as verificações de forma sequencial:

```bash
bin/ci
```

Etapas:

1. **Setup** — `bin/setup --skip-server`
2. **Style: Ruby** — `bin/rubocop`
3. **Security: Gem audit** — `bin/bundler-audit`
4. **Security: Yarn vulnerability audit** — `yarn audit`
5. **Security: Brakeman code analysis** — `bin/brakeman --quiet --no-pager --exit-on-warn --exit-on-error`

### CI (GitHub Actions)

O workflow `.github/workflows/ci.yml` roda em **pull requests** e **pushes na branch `main`**:

1. **scan_ruby**: Brakeman + Bundler Audit
2. **lint**: RuboCop

## Background jobs

A aplicação utiliza **Solid Queue** como adaptador de filas (produção).

- Configuração: `config/queue.yml`
- Execução local/desenvolvimento: integrado ao Puma via `plugin :solid_queue if ENV["SOLID_QUEUE_IN_PUMA"]` (habilitado pelo Kamal em produção)
- Jobs: o projeto contém apenas `ApplicationJob` (base). Nenhum job específico foi implementado.
- **Recurring tasks**: `config/recurring.yml` define uma tarefa em produção que limpa jobs finalizados do Solid Queue a cada hora (`SolidQueue::Job.clear_finished_in_batches`).

Para executar os workers localmente:

```bash
bin/jobs
```

## Integrações externas

| Serviço              | Finalidade                                               | Onde é usado                                               | Configuração           |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| **Supabase** (local) | PostgreSQL local para desenvolvimento                    | `config/database.yml`, `supabase/config.toml`              | `supabase start`       |
| **Google Fonts**     | Tipografia (Inter, Playfair Display, Cormorant Garamond) | Layouts (`application.html.erb`, `authenticated.html.erb`) | CDN público, sem chave |

> **Nota:** Não há integrações com serviços externos pagos (AWS S3, SMTP, etc.) ativas na codebase. O armazenamento usa disco local, e o SMTP de produção está comentado no `production.rb`.

## Upload e armazenamento

### Sistema

**Active Storage** com serviço `local` (disco):

| Ambiente    | Serviço | Caminho                                            |
| ----------- | ------- | -------------------------------------------------- |
| development | `local` | `storage/`                                         |
| production  | `local` | `storage/` (volume Docker `contaai_rails_storage`) |
| test        | `test`  | `tmp/storage/`                                     |

### Arquivos

| Model  | Attachment    | Tipos esperados |
| ------ | ------------- | --------------- |
| `User` | `avatar`      | Imagem          |
| `Book` | `cover_image` | Imagem          |

### Fluxo básico

1. O formulário (ex.: `books/edit`, `devise/registrations`) faz upload do arquivo via multipart form.
2. O Rails salva o blob e anexa ao record via Active Storage.
3. As views exibem a imagem com variants (`resize_to_fill`) usando `image_processing`.
4. Na edição do livro, é possível remover a capa (`handle_cover_removal` no `BooksController`).

## Deploy

### Docker

O projeto possui um **Dockerfile** multi-stage otimizado para produção:

- Ruby 3.4.10 (slim)
- Node.js 22.20.0 (build stage)
- Yarn (build stage)
- Pacotes: `libjemalloc2`, `libvips`, `postgresql-client`
- Usuário não-root (`rails` uid/gid 1000)
- Entrypoint prepara o banco (`bin/docker-entrypoint`)
- Serve via **Thruster** (proxy + assets + compressão) na porta 80

```bash
docker build -t contaai_rails .
docker run -d -p 80:80 -e RAILS_MASTER_KEY=<value from config/master.key> --name contaai_rails contaai_rails
```

### Kamal

O **Kamal** está configurado em `config/deploy.yml` com:

- Serviço: `contaai_rails`
- Servidor web: `192.168.0.1` (placeholder)
- Registry: `localhost:5555` (placeholder)
- Secrets: `RAILS_MASTER_KEY`
- Variável clara: `SOLID_QUEUE_IN_PUMA: true`
- Aliases: `console`, `shell`, `logs`, `dbc`
- Volume persistente: `contaai_rails_storage:/rails/storage`
- Builder: `arch: amd64`

Comandos:

```bash
bin/kamal setup       # Configura servidores
bin/kamal deploy      # Deploy
bin/kamal logs        # Logs
bin/kamal console     # Rails console no servidor
bin/kamal shell       # Shell no servidor
bin/kamal dbc         # DB console no servidor
```

> **Nota:** Os valores de `servers.web`, `registry.server` e a senha do registry em `config/deploy.yml` são placeholders. Ajuste-os antes de um deploy real.

## Troubleshooting

### Dependências não instaladas

**Sintoma:** `bundle: command not found` ou `LoadError: cannot load such file`.

**Solução:**

```bash
bundle install
yarn install --check-files
```

### Banco não configurado

**Sintoma:** `PG::ConnectionBad` ou `connection refused` na porta 54322.

**Solução:** O banco de desenvolvimento usa o Supabase local. Inicie-o:

```bash
supabase start
```

Verifique a conexão em `config/database.yml` (host `127.0.0.1`, porta `54322`).

### Migrations pendentes

**Sintoma:** `ActiveRecord::PendingMigrationError` ou aviso de migrations pendentes na página.

**Solução:**

```bash
bin/rails db:migrate
```

### Variáveis de ambiente ausentes

**Sintoma:** `ActiveSupport::MessageEncryptor::InvalidMessage` ou erro ao acessar credentials.

**Solução:** Certifique-se de que `config/master.key` existe (ou `RAILS_MASTER_KEY` está definida). Crie se necessário:

```bash
bin/rails credentials:edit
```

### Asset/frontend não compilado

**Sintoma:** Página sem estilos ou sem JavaScript.

**Solução:** Rode o build dos assets em watch (parte do `bin/dev`):

```bash
yarn build --watch
bin/rails tailwindcss:watch
```

Ou compile uma vez:

```bash
bin/rails assets:precompile
```

### Porta 3000 em uso

**Sintoma:** `Address already in use` ou falha ao iniciar o servidor.

**Solução:** Use outra porta:

```bash
PORT=3001 bin/dev
```

### Supabase não iniciado

**Sintoma:** Falha ao conectar no banco quando `supabase start` não foi executado.

**Solução:**

```bash
supabase start
```

Para parar:

```bash
supabase stop
```

### CI falhando no RuboCop

**Sintoma:** CI GitHub Actions falha na etapa `lint` com violações de estilo.

**Solução:**

```bash
bin/rubocop -a   # autocorrige violações automáticas
bin/rubocop      # verifica restantes manualmente
```

### Erro de permissão no Docker

**Sintoma:** Falha ao rodar `docker build` com `permission denied`.

**Solução:** Verifique se o usuário está no grupo `docker` ou use `sudo docker build` (menos recomendado).

## Comandos úteis

### Setup e desenvolvimento

```bash
bin/setup                        # Setup completo do ambiente
bin/dev                          # Inicia servidor + esbuild + tailwind em watch
bin/rails server                 # Apenas servidor Rails
bin/rails console                # Console Rails
bin/rails routes                 # Lista todas as rotas
```

### Banco de dados

```bash
bin/rails db:create              # Cria bancos
bin/rails db:setup               # Cria, carrega schema e seeds
bin/rails db:migrate             # Executa migrations
bin/rails db:rollback            # Reverte última migration
bin/rails db:seed                # Executa seeds
bin/rails db:reset               # Drop, create, migrate, seed
bin/rails db:migrate:status      # Status das migrations
```

### Qualidade de código

```bash
bin/rubocop                      # Lint Ruby
bin/rubocop -a                   # Lint + autocorreção
bin/brakeman --no-pager          # Análise de segurança
bin/bundler-audit                # Auditoria de gems
yarn audit                       # Auditoria de dependências JS
bin/ci                           # CI local completo
```

### Assets

```bash
yarn build                       # Build esbuild (produção)
yarn build --watch               # Build esbuild em watch
bin/rails tailwindcss:watch      # Tailwind em watch
bin/rails assets:precompile      # Precompila assets (produção)
```

### Jobs

```bash
bin/jobs                         # Inicia Solid Queue workers
```

### Deploy

```bash
bin/kamal setup                  # Configura servidores
bin/kamal deploy                 # Deploy
bin/kamal logs                   # Logs
bin/kamal console                # Rails console remoto
bin/kamal shell                  # Shell remoto
bin/kamal dbc                    # DB console remoto
```

### Migrations

```bash
bin/rails generate migration NomeDaMigration
bin/rails generate model NomeDoModel
bin/rails generate controller NomeDoController
bin/rails generate stimulus NomeDoController
```
