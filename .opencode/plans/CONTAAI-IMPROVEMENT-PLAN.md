# Plano de Melhorias — ContaAI Rails

> Auditoria realizada com base nas skills `rails-basecamp-engineer` e `rails-expert`.
> Cada etapa é independente da anterior (não prejudica etapas anteriores ou posteriores).

---

## ETAPA 1 — Correção de Bugs Críticos

> **Prioridade:** Alta | **Dependências:** Nenhuma
> Corrigir erros que causam falhas em runtime ou lógica incorreta.

### 1.1 Corrigir status `:in_progress` inexistente na view de leitura

**Arquivo:** `app/views/reading/index.html.erb:8`

O enum `ReadingProgress` define apenas `:reading`, `:completed`, `:paused`, mas a view usa `:in_progress` que não existe, causando erro na query.

```ruby
# ANTES (linha 8)
.where(status: [:in_progress, :completed])

# DEPOIS
.where(status: [:reading, :completed])
```

### 1.2 Remover guard `defined?(Book)` desnecessário no LandingController

**Arquivo:** `app/controllers/landing_controller.rb`

Em um app Rails, `Book` sempre está definido. Essa checagem é um antipattern.

```ruby
# ANTES
def index
  @featured_books = defined?(Book) ? Book.published.includes(:user).limit(8) : []
  @categories = defined?(Book) ? Book.published.group(:category).count : {}
end

# DEPOIS
def index
  @featured_books = Book.published.includes(:user).limit(8)
  @categories = Book.published.group(:category).count
end
```

### 1.3 Atualizar `mailer_sender` do Devise

**Arquivo:** `config/initializers/devise.rb:27`

O email ainda é o placeholder `please-change-me-at-config-initializers-devise@example.com`.

```ruby
# ANTES
config.mailer_sender = "please-change-me-at-config-initializers-devise@example.com"

# DEPOIS (usar variável de ambiente)
config.mailer_sender = ENV.fetch("MAILER_SENDER", "noreply@contaai.com.br")
```

**Ação:** Adicionar `MAILER_SENDER` ao `.env` e aos ambientes de CI/deploy.

---

## ETAPA 2 — Extração de Lógica de Autorização do BooksController

> **Prioridade:** Alta | **Dependências:** Nenhuma
> Seguindo o padrão Basecamp: controllers enxutos com concerns reutilizáveis.

### 2.1 Criar concern `BookScoped`

**Novo arquivo:** `app/controllers/concerns/book_scoped.rb`

Extrair `set_book` e `authorize_book_owner!` para um concern, eliminando duplicação entre `publish`, `unpublish`, `edit`, `update`, `destroy` e `write`.

```ruby
module BookScoped
  extend ActiveSupport::Concern

  included do
    before_action :set_book
  end

  private

  def set_book
    @book = Book.find(params[:id])
  end

  def authorize_book_owner!
    return true if @book.user == current_user

    respond_to do |f|
      f.html { redirect_to root_path, alert: "Não autorizado." }
      f.json { render json: { error: "Não autorizado." }, status: :forbidden }
    end
    false
  end
end
```

### 2.2 Simplificar `BooksController`

Usar o concern e remover os guard clauses duplicados em `publish` e `unpublish`.

---

## ETAPA 3 — Implementar Controllers Faltantes (Features com Models sem Controller)

> **Prioridade:** Alta | **Dependências:** Nenhuma
> Os models já existem mas não há controllers nem rotas para manipulá-los.

### 3.1 Criar `FavoritesController` (create + destroy)

**Novo arquivo:** `app/controllers/favorites_controller.rb`

O model `Favorite` já existe com validação de unicidade. A view `favorites/index.html.erb` já renderiza a lista.

```ruby
class FavoritesController < ApplicationController
  before_action :authenticate_user!

  def index
    @favorites = current_user.favorites.includes(book: :user)
  end

  def create
    @book = Book.find(params[:book_id])
    favorite = current_user.favorites.build(book: @book)

    if favorite.save
      respond_to do |f|
        f.html { redirect_back fallback_location: @book, notice: "Adicionado aos favoritos." }
        f.json { render json: { favorited: true }, status: :created }
        f.turbo_stream
      end
    else
      respond_to do |f|
        f.html { redirect_back fallback_location: @book, alert: "Não foi possível favoritar." }
        f.json { render json: { error: favorite.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    @favorite = current_user.favorites.find(params[:id])
    @book = @favorite.book
    @favorite.destroy

    respond_to do |f|
      f.html { redirect_back fallback_location: @book, notice: "Removido dos favoritos." }
      f.json { render json: { favorited: false } }
      f.turbo_stream
    end
  end
end
```

**Rotas:**
```ruby
resources :favorites, only: [:index, :create, :destroy]
```

### 3.2 Criar `RatingsController` (create + update)

**Novo arquivo:** `app/controllers/ratings_controller.rb`

```ruby
class RatingsController < ApplicationController
  before_action :authenticate_user!

  def create
    @book = Book.find(params[:book_id])
    @rating = current_user.ratings.build(rating_params.merge(book: @book))

    if @rating.save
      update_book_average!(@book)
      respond_to do |f|
        f.html { redirect_back fallback_location: @book, notice: "Avaliação registrada." }
        f.json { render json: @rating, status: :created }
        f.turbo_stream
      end
    else
      respond_to do |f|
        f.html { redirect_back fallback_location: @book, alert: @rating.errors.full_messages.first }
        f.json { render json: { error: @rating.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  def update
    @rating = current_user.ratings.find(params[:id])
    if @rating.update(rating_params)
      update_book_average!(@rating.book)
      respond_to do |f|
        f.html { redirect_back fallback_location: @rating.book, notice: "Avaliação atualizada." }
        f.json { render json: @rating }
        f.turbo_stream
      end
    else
      respond_to do |f|
        f.html { redirect_back fallback_location: @rating.book, alert: @rating.errors.full_messages.first }
        f.json { render json: { error: @rating.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  private

  def rating_params
    params.require(:rating).permit(:score, :comment)
  end

  def update_book_average!(book)
    avg = book.ratings.average(:score)&.round(1)
    count = book.ratings.count
    book.update_columns(average_rating: avg, ratings_count: count)
  end
end
```

**Rotas:**
```ruby
resources :books do
  resources :ratings, only: [:create, :update]
end
```

### 3.3 Criar `AuthorFollowsController` (create + destroy)

**Novo arquivo:** `app/controllers/author_follows_controller.rb`

```ruby
class AuthorFollowsController < ApplicationController
  before_action :authenticate_user!

  def create
    @author = User.find(params[:author_id])
    @follow = current_user.active_author_follows.build(author: @author)

    if @follow.save
      respond_to do |f|
        f.html { redirect_back fallback_location: @author, notice: "Seguindo autor." }
        f.json { render json: { following: true }, status: :created }
        f.turbo_stream
      end
    else
      respond_to do |f|
        f.html { redirect_back fallback_location: @author, alert: "Não foi possível seguir." }
        f.json { render json: { error: @follow.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  def destroy
    @follow = current_user.active_author_follows.find(params[:id])
    @author = @follow.author
    @follow.destroy

    respond_to do |f|
      f.html { redirect_back fallback_location: @author, notice: "Deixou de seguir." }
      f.json { render json: { following: false } }
      f.turbo_stream
    end
  end
end
```

**Rotas:**
```ruby
resources :author_follows, only: [:create, :destroy]
```

### 3.4 Criar `ReadingProgressesController` (create + update)

**Novo arquivo:** `app/controllers/reading_progresses_controller.rb`

```ruby
class ReadingProgressesController < ApplicationController
  before_action :authenticate_user!

  def create
    @book = Book.find(params[:book_id])
    @progress = current_user.reading_progresses.find_or_initialize_by(book: @book)

    if @progress.update(reading_progress_params.merge(status: :reading, started_at: @progress.started_at || Time.current))
      respond_to do |f|
        f.html { redirect_to read_book_path(@book) }
        f.json { render json: @progress }
        f.turbo_stream
      end
    else
      respond_to do |f|
        f.html { redirect_to read_book_path(@book), alert: "Erro ao salvar progresso." }
        f.json { render json: { error: @progress.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  def update
    @progress = current_user.reading_progresses.find(params[:id])

    attrs = reading_progress_params
    attrs[:completed_at] = Time.current if attrs[:status] == "completed" && @progress.completed_at.nil?

    if @progress.update(attrs)
      respond_to do |f|
        f.html { redirect_to read_book_path(@progress.book) }
        f.json { render json: @progress }
        f.turbo_stream
      end
    else
      respond_to do |f|
        f.html { redirect_to read_book_path(@progress.book), alert: "Erro ao atualizar progresso." }
        f.json { render json: { error: @progress.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  private

  def reading_progress_params
    params.require(:reading_progress).permit(:percentage, :status, :current_position)
  end
end
```

**Rotas:**
```ruby
resources :books do
  resources :reading_progresses, only: [:create, :update]
end
```

### 3.5 Criar `UserReadingPreferencesController` (update)

**Novo arquivo:** `app/controllers/user_reading_preferences_controller.rb`

```ruby
class UserReadingPreferencesController < ApplicationController
  before_action :authenticate_user!

  def update
    @preference = current_user.user_reading_preference || current_user.build_user_reading_preference

    if @preference.update(preference_params)
      respond_to do |f|
        f.html { redirect_to settings_path, notice: "Preferências salvas." }
        f.json { render json: @preference }
        f.turbo_stream
      end
    else
      respond_to do |f|
        f.html { redirect_to settings_path, alert: "Erro ao salvar preferências." }
        f.json { render json: { error: @preference.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  private

  def preference_params
    params.require(:user_reading_preference).permit(:font_size, :night_mode)
  end
end
```

**Rotas:**
```ruby
resource :user_reading_preference, only: [:update]
```

---

## ETAPA 4 — Prevenção de N+1 Queries e Otimização de Performance

> **Prioridade:** Média | **Dependências:** Nenhuma
> Seguindo rails-expert: "Prevent N+1 queries with includes/eager_load on every collection query involving associations."

### 4.1 Corrigir N+1 no `DashboardController`

**Arquivo:** `app/controllers/dashboard_controller.rb`

```ruby
# ANTES
@books = @user.books.order(updated_at: :desc)

# DEPOIS
@books = @user.books.includes(:chapters, :ratings).order(updated_at: :desc)
```

### 4.2 Adicionar `counter_cache` nos models

**Novas migrações:**
- `books` → adicionar `ratings_count:integer default 0`
- `books` → adicionar `favorites_count:integer default 0`
- `users` → adicionar `books_count:integer default 0`

**Alterações nos models:**

```ruby
# app/models/book.rb
has_many :ratings, dependent: :destroy
has_many :favorites, dependent: :destroy

# app/models/user.rb
has_many :books, dependent: :destroy
```

### 4.3 Adicionar índices para colunas de busca e ordenação

**Nova migração:**
```ruby
add_index :books, :status
add_index :books, [:status, :published_at]
add_index :books, [:user_id, :status]
add_index :reading_progresses, [:user_id, :status]
add_index :ratings, [:book_id, :user_id], unique: true
add_index :favorites, [:user_id, :book_id], unique: true
add_index :author_follows, [:follower_id, :author_id], unique: true
```

### 4.4 Corrigir N+1 na `BooksController#index`

```ruby
# ANTES
@books = Book.published.includes(:user).order(published_at: :desc)

# DEPOIS
@books = Book.published.includes(:user, cover_image_attachment: :blob).order(published_at: :desc)
```

---

## ETAPA 5 — Configuração de Mailer e Envio de Emails

> **Prioridade:** Média | **Dependências:** ETAPA 1.3 (mailer_sender)
> Seguindo rails-basecamp-engineer: "Bundled notifications" e padrão mínimo de mailers.

### 5.1 Configurar `ActionMailer` para produção

**Arquivo:** `config/environments/production.rb`

```ruby
config.action_mailer.delivery_method = :smtp
config.action_mailer.default_url_options = { host: ENV.fetch("APP_HOST", "contaai.com.br"), protocol: "https" }
config.action_mailer.smtp_settings = {
  address: ENV.fetch("SMTP_ADDRESS", "smtp.gmail.com"),
  port: ENV.fetch("SMTP_PORT", 587).to_i,
  domain: ENV.fetch("SMTP_DOMAIN", "contaai.com.br"),
  user_name: ENV["SMTP_USERNAME"],
  password: ENV["SMTP_PASSWORD"],
  authentication: :plain,
  enable_starttls_auto: true
}
```

### 5.2 Criar mailer de boas-vindas

**Novo arquivo:** `app/mailers/user_mailer.rb`

```ruby
class UserMailer < ApplicationMailer
  def welcome_email(user)
    @user = user
    mail(to: @user.email, subject: "Bem-vindo ao ContaAI!")
  end
end
```

### 5.3 Criar view do email de boas-vindas

**Novo arquivo:** `app/views/user_mailer/welcome_email.html.erb`

### 5.4 Disparar email no cadastro (via callback ou concern)

Usar `after_create` no User ou concern `Notifiable` para disparar o email via `UserMailer.welcome_email(user).deliver_later`.

---

## ETAPA 6 — Settings Page Funcional

> **Prioridade:** Média | **Dependências:** ETAPA 3.5 (UserReadingPreferencesController)
> A view `settings/index.html.erb` já tem UI mas não está conectada ao backend.

### 6.1 Conectar formulário de preferências de leitura

**Arquivo:** `app/views/settings/index.html.erb`

Substituir os elementos estáticos por `form_with` apontando para `user_reading_preference_path`:

```erb
<%= form_with model: current_user.user_reading_preference || current_user.build_user_reading_preference,
              url: user_reading_preference_path, method: :patch do |f| %>
  <%= f.select :font_size, [10, 12, 14, 16, 18, 20, 24, 32] %>
  <%= f.check_box :night_mode %>
  <%= f.submit "Salvar" %>
<% end %>
```

### 6.2 Criar `UserReadingPreference` para novos usuários

**Arquivo:** `app/models/user.rb`

Adicionar callback para criar preferência padrão:

```ruby
after_create :create_default_reading_preference

private

def create_default_reading_preference
  create_user_reading_preference(font_size: 16, night_mode: false)
end
```

---

## ETAPA 7 — Padronização de Design System nos Views

> **Prioridade:** Baixa | **Dependências:** Nenhuma
> Seguindo rails-basecamp-engineer: "Explicit over implicit" e design system consistente.

### 7.1 Substituir hex colors hardcoded por classes Tailwind

Vários arquivos de view usam classes como `bg-[#C2A47E]/10`, `bg-[#8B7355]` ao invés dos design tokens definidos no `@theme`.

**Arquivos afetados:**
- `app/views/books/show.html.erb`
- `app/views/books/write.html.erb`
- `app/views/dashboard/index.html.erb`
- `app/views/shared/_sidebar.html.erb`

**Ação:** Mapear cada hex hardcoded para o token equivalente (`primary`, `bg-card`, `text-muted`, etc.) e substituir.

### 7.2 Consolidar entry points CSS

**Situação:** Existem dois arquivos CSS de entrada:
- `app/assets/stylesheets/application.tailwind.css` (principal)
- `app/assets/tailwind/application.css` (contém apenas `.drag-over`)

**Ação:** Mover o estilo `.drag-over` para o `application.tailwind.css` e remover o segundo arquivo se não forreferenciado em nenhum lugar.

---

## ETAPA 8 — Testes e Cobertura

> **Prioridade:** Média | **Dependências:** ETAPA 3 (controllers precisam existir antes de testar)
> Seguindo rails-expert: "Write comprehensive specs targeting >95% coverage."

### 8.1 Criar testes para controllers novos

**Novos arquivos:**
- `test/controllers/favorites_controller_test.rb`
- `test/controllers/ratings_controller_test.rb`
- `test/controllers/author_follows_controller_test.rb`
- `test/controllers/reading_progresses_controller_test.rb`
- `test/controllers/user_reading_preferences_controller_test.rb`

Cada arquivo deve testar:
- Autenticação (redirect para login se não autenticado)
- Autorização (apropriado para o recurso)
- Happy path (create/update com parâmetros válidos)
- Unhappy path (parâmetros inválidos)
- Resposta JSON e HTML

### 8.2 Criar testes para o `ReadingProgressesController` atualizar progresso de leitura

Testar cenários:
- Criar progresso para livro inexistente → erro
- Atualizar percentage de 0% para 50%
- Marcar como `completed` → `completed_at` deve ser preenchido
- Progresso duplicado (mesmo user+book) → deve atualizar, não criar

### 8.3 Criar fixtures para novos models

**Arquivo:** `test/fixtures/ratings.yml`
```yaml
one:
  user: author
  book: published_book
  score: 5
  comment: "Excelente!"

two:
  user: reader
  book: published_book
  score: 4
  comment: "Muito bom"
```

---

## ETAPA 9 — Segurança e Boas Práticas

> **Prioridade:** Baixa | **Dependências:** Nenhuma

### 9.1 Sanitizar parâmetros no `RatingsController`

Já implementado via `rating_params`, mas adicionar validação de range no controller:

```ruby
before_action :validate_score, only: [:create, :update]

def validate_score
  score = params.dig(:rating, :score).to_i
  unless (1..5).include?(score)
    render json: { error: "Score deve ser entre 1 e 5" }, status: :unprocessable_entity
  end
end
```

### 9.2 Rate limiting na ação de busca

O `SearchController` usa `ILIKE` direto, que pode ser explorado com queries complexas. Implementar:

```ruby
# app/controllers/search_controller.rb
MAX_SEARCH_LENGTH = 100

def index
  query = params[:q]&.strip&.truncate(MAX_SEARCH_LENGTH)
  @books = Book.published.search(query).includes(:user).limit(20) if query.present?
end
```

### 9.3 Adicionar `dependent: :destroy` nas associações que faltam

Verificar se todas as associações `has_many` têm `dependent` definido para evitar registros órfãos.

---

## Resumo das Etapas

| Etapa | Descrição | Prioridade | Dependências |
|-------|-----------|------------|--------------|
| 1 | Correção de Bugs Críticos | Alta | Nenhuma |
| 2 | Extração de Lógica (BookScoped) | Alta | Nenhuma |
| 3 | Controllers Faltantes | Alta | Nenhuma |
| 4 | N+1 Queries e Performance | Média | Nenhuma |
| 5 | Mailer e Envio de Emails | Média | 1.3 |
| 6 | Settings Page Funcional | Média | 3.5 |
| 7 | Padronização Design System | Baixa | Nenhuma |
| 8 | Testes e Cobertura | Média | 3 |
| 9 | Segurança e Boas Práticas | Baixa | Nenhuma |

---

> **Nota:** Cada etapa pode ser implementada de forma isolada. Não existe bloqueio entre elas — apenas uma dependência lógica entre ETAPA 1.3 → 5 e ETAPA 3.5 → 6.
