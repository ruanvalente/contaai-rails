# ContaAI - Plano de Database

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Dependências](#2-dependências)
3. [Tabelas e Migrations](#3-tabelas-e-migrations)
4. [Enums](#4-enums)
5. [Diagrama de Relacionamentos](#5-diagrama-de-relacionamentos)
6. [Regras de Negócio no BD](#6-regras-de-negócio-no-bd)
7. [Ordem de Execução](#7-ordem-de-execução)
8. [Registro de Execução](#8-registro-de-execução)

---

## 1. Visão Geral

Projeto **ContaAI** — Rails 8.1.3 + PostgreSQL. Projeto novo, sem migrations existentes.

| Componente | Status |
| --- | --- |
| `db/schema.rb` | ✅ Criado (175 linhas) |
| Migrations | ✅ 9 migrations criadas e executadas |
| Models | ✅ `ApplicationRecord`, `User` (com Devise) |
| Gemfile | ✅ `pg`, `image_processing`, `bcrypt`, `devise` presentes |

---

## 2. Dependências

### Gemfile — Alterações Necessárias

```ruby
# Descomentar (necessário para Devise):
gem "bcrypt", "~> 3.1.7"

# Já presentes (não alterar):
gem "pg", "~> 1.1"
gem "image_processing", "~> 1.2"
```

### Gems Adicionais a Instalar

```bash
bundle add devise
```

---

## 3. Tabelas e Migrations

### Migration 1: `devise_create_users`

Cria a tabela base de usuários com autenticação Devise.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `email` | varchar(255) | NOT NULL, UNIQUE, INDEX |
| `encrypted_password` | varchar(255) | NOT NULL |
| `name` | varchar(255) | |
| `role` | integer | DEFAULT 0, NOT NULL |
| `bio` | text | |
| `reset_password_token` | varchar(255) | UNIQUE, INDEX |
| `reset_password_sent_at` | datetime | |
| `remember_created_at` | datetime | |
| `sign_in_count` | integer | DEFAULT 0 |
| `current_sign_in_at` | datetime | |
| `last_sign_in_at` | datetime | |
| `current_sign_in_ip` | inet | |
| `last_sign_in_ip` | inet | |
| `confirmation_token` | varchar(255) | UNIQUE, INDEX |
| `confirmed_at` | datetime | |
| `confirmation_sent_at` | datetime | |
| `unconfirmed_email` | varchar(255) | |
| `failed_attempts` | integer | DEFAULT 0 |
| `locked_at` | datetime | |
| `created_at` | datetime | NOT NULL |
| `updated_at` | datetime | NOT NULL |

**Índices**:
- `index_users_on_email` (unique)
- `index_users_on_reset_password_token` (unique)
- `index_users_on_confirmation_token` (unique)

---

### Migration 2: `create_books`

Cria a tabela de livros com relacionamento ao autor (user).

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `user_id` | bigint | FK → users, NOT NULL, INDEX |
| `title` | varchar(255) | NOT NULL |
| `author_name` | varchar(255) | NOT NULL |
| `cover_color` | varchar(7) | DEFAULT '#8B4513', NOT NULL |
| `description` | text | |
| `content` | text | |
| `category` | integer | NOT NULL |
| `status` | integer | DEFAULT 0, NOT NULL |
| `word_count` | integer | DEFAULT 0, NOT NULL |
| `page_count` | integer | |
| `average_rating` | decimal(3,2) | DEFAULT 0.0 |
| `ratings_count` | integer | DEFAULT 0 |
| `published_at` | datetime | |
| `created_at` | datetime | NOT NULL |
| `updated_at` | datetime | NOT NULL |

**Índices**:
- `index_books_on_user_id`
- `index_books_on_user_id_and_status`
- `index_books_on_category`
- `index_books_on_status` (para catálogo público)

---

### Migration 3: `create_ratings`

Cria a tabela de avaliações de livros.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `book_id` | bigint | FK → books, NOT NULL |
| `user_id` | bigint | FK → users, NOT NULL |
| `score` | integer | NOT NULL (CHECK: score >= 1 AND score <= 5) |
| `comment` | text | |
| `created_at` | datetime | NOT NULL |
| `updated_at` | datetime | NOT NULL |

**Constraints**:
- UNIQUE `[book_id, user_id]` — RN-005: um usuário avalia um livro apenas uma vez

**Índices**:
- `index_ratings_on_book_id`
- `index_ratings_on_user_id`
- `index_ratings_on_book_id_and_user_id` (unique)

---

### Migration 4: `create_favorites`

Cria a tabela de favoritos.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `user_id` | bigint | FK → users, NOT NULL |
| `book_id` | bigint | FK → books, NOT NULL |
| `created_at` | datetime | NOT NULL |
| `updated_at` | datetime | NOT NULL |

**Constraints**:
- UNIQUE `[user_id, book_id]`

**Índices**:
- `index_favorites_on_user_id`
- `index_favorites_on_book_id`
- `index_favorites_on_user_id_and_book_id` (unique)

---

### Migration 5: `create_author_follows`

Cria a tabela de seguidores de autor.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `follower_id` | bigint | FK → users, NOT NULL |
| `author_id` | bigint | FK → users, NOT NULL |
| `created_at` | datetime | NOT NULL |
| `updated_at` | datetime | NOT NULL |

**Constraints**:
- UNIQUE `[follower_id, author_id]`
- CHECK `follower_id != author_id`

**Índices**:
- `index_author_follows_on_follower_id`
- `index_author_follows_on_author_id`
- `index_author_follows_on_follower_id_and_author_id` (unique)

---

### Migration 6: `create_reading_progresses`

Cria a tabela de progresso de leitura.

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `user_id` | bigint | FK → users, NOT NULL |
| `book_id` | bigint | FK → books, NOT NULL |
| `current_position` | text | DEFAULT '' |
| `percentage` | integer | DEFAULT 0, NOT NULL (CHECK: 0-100) |
| `status` | integer | DEFAULT 0, NOT NULL |
| `started_at` | datetime | |
| `completed_at` | datetime | |
| `created_at` | datetime | NOT NULL |
| `updated_at` | datetime | NOT NULL |

**Constraints**:
- UNIQUE `[user_id, book_id]` — RN-006

**Índices**:
- `index_reading_progresses_on_user_id`
- `index_reading_progresses_on_book_id`
- `index_reading_progresses_on_user_id_and_book_id` (unique)

---

### Migration 7: `create_user_reading_preferences`

Cria a tabela de preferências de leitura (1:1 com user).

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `user_id` | bigint | FK → users, UNIQUE, NOT NULL |
| `font_size` | integer | DEFAULT 14 |
| `night_mode` | boolean | DEFAULT false |
| `created_at` | datetime | NOT NULL |
| `updated_at` | datetime | NOT NULL |

**Constraints**:
- UNIQUE `user_id`

---

### Migration 8: `add_devise_to_users`

Colunas adicionais do Devise (caso não incluídas na migration 1). Esta migration é gerada automaticamente pelo `rails generate devise User` e inclui trackable, confirmable e lockable.

---

### Migration 9: `create_active_storage_tables`

Tabelas padrão do Active Storage para uploads.

**Tabelas criadas**:

#### `active_storage_blobs`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `key` | varchar(255) | NOT NULL, UNIQUE |
| `filename` | varchar(255) | NOT NULL |
| `content_type` | varchar(255) | |
| `metadata` | text | |
| `service_name` | varchar(255) | NOT NULL |
| `byte_size` | bigint | NOT NULL |
| `checksum` | varchar(255) | NOT NULL |
| `created_at` | datetime | NOT NULL |

#### `active_storage_attachments`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `name` | varchar(255) | NOT NULL |
| `record_type` | varchar(255) | NOT NULL |
| `record_id` | bigint | NOT NULL |
| `blob_id` | bigint | FK → active_storage_blobs, NOT NULL |
| `created_at` | datetime | NOT NULL |

**Constraints**: UNIQUE `[name, record_type, record_id, blob_id]`

#### `active_storage_variant_records`

| Coluna | Tipo | Constraints |
| --- | --- | --- |
| `id` | bigint (PK) | AUTO INCREMENT |
| `blob_id` | bigint | FK → active_storage_blobs, NOT NULL |
| `variation_digest` | varchar(255) | NOT NULL |

**Uso no projeto**:
- `Book` → `has_one_attached :cover_image`
- `User` → `has_one_attached :avatar`

---

## 4. Enums

```ruby
# app/models/user.rb
class User < ApplicationRecord
  enum :role, { reader: 0, author: 1 }
end

# app/models/book.rb
class Book < ApplicationRecord
  enum :status, { draft: 0, published: 1 }
  enum :category, {
    sci_fi: 0,
    fantasy: 1,
    drama: 2,
    business: 3,
    education: 4,
    geography: 5
  }
end

# app/models/reading_progress.rb
class ReadingProgress < ApplicationRecord
  enum :status, { not_started: 0, reading: 1, completed: 2 }
end
```

---

## 5. Diagrama de Relacionamentos

```
┌──────────┐       ┌──────────────┐       ┌──────────┐
│   User   │──1:N──│     Book     │──1:N──│  Rating  │
│          │       │              │       │          │
│          │──1:N──│   Favorite   │       └──────────┘
│          │       │              │
│          │──1:N──│ReadingProgress│
│          │       └──────────────┘
│          │
│          │──1:N──┐ (as follower)
│          │       │  AuthorFollow
│          │──1:N──┘ (as author)
│          │
│          │──1:1──│ UserReadingPreference │
└──────────┘

User (1) ──< (N) Book
User (1) ──< (N) Rating
User (1) ──< (N) Favorite
User (1) ──< (N) ReadingProgress
User (1) ──< (N) AuthorFollow (as follower)
User (1) ──< (N) AuthorFollow (as author)
User (1) ─── (1) UserReadingPreference
Book  (1) ──< (N) Rating
Book  (1) ──< (N) Favorite
Book  (1) ──< (N) ReadingProgress
```

---

## 6. Regras de Negócio no BD

| Regra | Descrição | Implementação |
| --- | --- | --- |
| RN-001 | Usuário começa como Leitor, torna-se Autor ao publicar | Enum `role` no User. Callback no Book `after_save` :update_user_role |
| RN-002 | Autor que exclui todos os livros volta a ser Leitor | Callback no Book `after_destroy` :check_author_role |
| RN-003 | Livro só aparece no catálogo quando publicado | Scope `Book.published` filtra por `status: :published` |
| RN-004 | Avaliação média recalculada a cada nova avaliação | Callback no Rating `after_save`/`after_destroy` :recalculate_book_rating |
| RN-005 | Um usuário avalia um livro apenas uma vez | Unique index `[book_id, user_id]` na tabela ratings |
| RN-006 | Progresso mantido por livro e por usuário | Unique index `[user_id, book_id]` na tabela reading_progresses |
| RN-007 | Sessões anônimas com identificador único | Devise session store ou tabela `sessions` para tracking |

---

## 7. Ordeção de Execução

### Passo 1: Instalar e configurar Devise

```bash
bundle add devise
rails generate devise:install
```

### Passo 2: Gerar migration do User

```bash
rails generate devise User
```

### Passo 3: Adicionar campos extras ao User

```bash
rails generate migration AddFieldsToUsers name:string role:integer bio:text
```

### Passo 4: Gerar migrations das entidades

```bash
rails generate migration CreateBooks user:references title:string author_name:string cover_color:string description:text content:text category:integer status:integer word_count:integer page_count:integer average_rating:decimal ratings_count:integer published_at:datetime

rails generate migration CreateRatings book:references user:references score:integer comment:text

rails generate migration CreateFavorites user:references book:references

rails generate migration CreateAuthorFollows follower:references author:references

rails generate migration CreateReadingProgresses user:references book:references current_position:text percentage:integer status:integer started_at:datetime completed_at:datetime

rails generate migration CreateUserReadingPreferences user:references font_size:integer night_mode:boolean
```

### Passo 5: Instalar Active Storage

```bash
rails active_storage:install
```

### Passo 6: Rodar migrations

```bash
rails db:migrate
```

### Passo 7: Criar seeds (opcional)

```ruby
# db/seeds.rb
User.create!(
  name: "Admin",
  email: "admin@contaai.com",
  password: "password123",
  password_confirmation: "password123",
  role: :reader
)
```

---

_Data: 22/07/2026_
_Versão: 1.0_
_Baseado em: PROJECT_PLAN.md v2.0_

---

## 8. Registro de Execução

### Fase 1: Configuração do Banco de Dados (22/07/2026)

**Status:** ✅ Concluída

#### 8.1 Dependências Instaladas

| Gem | Ação | Status |
| --- | --- | --- |
| `bcrypt` | Descomentado no Gemfile | ✅ |
| `devise` | Adicionado e instalado (`bundle add devise`) | ✅ |
| `pg` | Já presente | — |
| `image_processing` | Já presente | — |

#### 8.2 Configuração do Devise

- Rodado `rails generate devise:install` — gerou:
  - `config/initializers/devise.rb`
  - `config/locales/devise.en.yml`
- Rodado `rails generate devise User --trackable --confirmable --lockable` — gerou:
  - `db/migrate/20260722134113_devise_create_users.rb`
  - `app/models/user.rb`
  - Rota `devise_for :users` em `config/routes.rb`

#### 8.3 Migrations Criadas e Customizadas

| # | Migration | Arquivo | Customizações |
| --- | --- | --- | --- |
| 1 | `devise_create_users` | `20260722134113_devise_create_users.rb` | Descomentadas colunas de Trackable, Confirmable e Lockable; adicionados índices únicos para `confirmation_token` e `unlock_token` |
| 2 | `add_fields_to_users` | `20260722134127_add_fields_to_users.rb` | Adicionado `default: 0, null: false` na coluna `role` |
| 3 | `create_books` | `20260722134147_create_books.rb` | Adicionados `null: false` em `title`, `author_name`, `category`; defaults para `cover_color` (`#8B4513`), `status` (0), `word_count` (0); `average_rating` com `precision: 3, scale: 2, default: 0.0`; índices em `[user_id, status]`, `category`, `status` |
| 4 | `create_ratings` | `20260722134149_create_ratings.rb` | Adicionado `null: false` em `score`; CHECK constraint `score >= 1 AND score <= 5`; índice único em `[book_id, user_id]` |
| 5 | `create_favorites` | `20260722134150_create_favorites.rb` | Adicionado índice único em `[user_id, book_id]` |
| 6 | `create_author_follows` | `20260722134151_create_author_follows.rb` | Foreign keys apontando para tabela `users` (não para referências automáticas); CHECK constraint `follower_id != author_id`; índice único em `[follower_id, author_id]` |
| 7 | `create_reading_progresses` | `20260722134152_create_reading_progresses.rb` | Defaults para `current_position` (`""`), `percentage` (0), `status` (0); CHECK constraint `percentage >= 0 AND percentage <= 100`; índice único em `[user_id, book_id]` |
| 8 | `create_user_reading_preferences` | `20260722134153_create_user_reading_preferences.rb` | Defaults para `font_size` (14) e `night_mode` (false); índice único em `user_id` |
| 9 | `create_active_storage_tables` | `20260722134216_create_active_storage_tables.active_storage.rb` | Gerado por `rails active_storage:install` — sem customizações |

#### 8.4 Models Atualizados

**`app/models/user.rb`** — Configurado com:
- Módulos Devise: `database_authenticatable`, `registerable`, `recoverable`, `rememberable`, `validatable`, `confirmable`, `lockable`, `trackable`
- Enum: `role` → `{ reader: 0, author: 1 }`
- Associações: `has_one_attached :avatar`, `has_many :books`, `has_many :ratings`, `has_many :favorites`, `has_many :reading_progresses`, `has_one :user_reading_preference`, `has_many :active_author_follows` / `following_authors`, `has_many :passive_author_follows` / `followers`

#### 8.5 Seeds

- Atualizado `db/seeds.rb` com usuário admin padrão (`admin@contaai.com` / `password123`)
- Executado `rails db:seed` com sucesso

#### 8.6 Schema Final

- Arquivo `db/schema.rb` gerado automaticamente com 175 linhas
- Todas as 9 tabelas criadas com constraints e índices conforme especificado no plano
- Todas as foreign keys configuradas

#### 8.7 Comandos Executados

```bash
bundle install                                    # Instalar gems
rails generate devise:install                     # Configurar Devise
rails generate devise User --trackable --confirmable --lockable  # Gerar User
rails generate migration AddFieldsToUsers ...     # Campos extras
rails generate migration CreateBooks ...          # Tabela books
rails generate migration CreateRatings ...        # Tabela ratings
rails generate migration CreateFavorites ...      # Tabela favorites
rails generate migration CreateAuthorFollows ...  # Tabela author_follows
rails generate migration CreateReadingProgresses ... # Tabela reading_progresses
rails generate migration CreateUserReadingPreferences ... # Tabela user_reading_preferences
rails active_storage:install                      # Active Storage
rails db:migrate                                  # Rodar todas as migrations
rails db:seed                                     # Popular dados iniciais
```
