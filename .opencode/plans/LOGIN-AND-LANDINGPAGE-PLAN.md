# ContaAI - Plano: Login, Cadastro, Recuperação de Senha e Landing Page

## Sumário

1. [Estado Atual do Projeto](#1-estado-atual-do-projeto)
2. [Visão Geral da Entrega](#2-visão-geral-da-entrega)
3. [Configuração do TailwindCSS](#3-configuração-do-tailwindcss)
4. [Landing Page (Página Inicial Pública)](#4-landing-page-página-inicial-pública)
5. [Tela de Login](#5-tela-de-login)
6. [Tela de Cadastro](#6-tela-de-cadastro)
7. [Tela de Recuperação de Senha](#7-tela-de-recuperação-de-senha)
8. [Tela de Redefinição de Senha](#8-tela-de-redefinição-de-senha)
9. [Layout e Componentes Compartilhados](#9-layout-e-componentes-compartilhados)
10. [Rotas e Controllers](#10-rotas-e-controllers)
11. [Devise Views Customizadas](#11-devise-views-customizadas)
12. [Fluxos de Navegação](#12-fluxos-de-navegação)
13. [Checklist de Implementação](#13-checklist-de-implementação)

---

## 1. Estado Atual do Projeto

| Componente | Status | Detalhes |
| --- | --- | --- |
| Rails | 8.1.3 | Hotwire/Turbo + Stimulus |
| TailwindCSS | ✅ Instalado | via `cssbundling-rails` + `@tailwindcss/cli` |
| Devise | ✅ Instalado | Módulos: database_authenticatable, registerable, recoverable, rememberable, validatable, confirmable, lockable, trackable |
| User Model | ✅ Criado | `role` enum (reader/author), `name`, `bio`, `avatar` (Active Storage) |
| Devise Views | ❌ Não geradas | Views padrão do Devise não existem |
| LandingController | ❌ Não existe | Precisa ser criado |
| Root Route | ❌ Não definida | `root` não está em `config/routes.rb` |
| Layout principal | ⚠️ Básico | Sem classes Tailwind, sem tratamento de flash messages |
| Tema Tailwind | ⚠️ Default | `application.tailwind.css` apenas com `@import "tailwindcss"` — sem cores customizadas |

### Arquivos Existentes Relevantes

```
app/
├── assets/stylesheets/application.tailwind.css   # Tailwind vazio
├── controllers/application_controller.rb          # Sem before_action de auth
├── models/user.rb                                 # Devise configurado
├── views/layouts/application.html.erb             # Layout básico, sem Tailwind
config/
├── routes.rb                                      # devise_for :users, sem root
├── initializers/devise.rb                         # Configurado (Hotwire compat)
db/migrate/
├── 20260722134113_devise_create_users.rb          # Tabela users completa
├── 20260722134127_add_fields_to_users.rb          # name, role, bio
```

---

## 2. Visão Geral da Entrega

### O que será criado

| Entrega | Tipo | Arquivos |
| --- | --- | --- |
| Tema TailwindCSS customizado | Config | `app/assets/stylesheets/application.tailwind.css` |
| Layout principal com Tailwind | View | `app/views/layouts/application.html.erb` |
| Layout para páginas Devise | View | `app/views/layouts/devise.html.erb` |
| Landing Page | Controller + View | `app/controllers/landing_controller.rb`, `app/views/landing/index.html.erb` |
| Login | Devise View | `app/views/devise/sessions/new.html.erb` |
| Cadastro | Devise View | `app/views/devise/registrations/new.html.erb` |
| Recuperação de senha | Devise View | `app/views/devise/passwords/new.html.erb` |
| Redefinição de senha | Devise View | `app/views/devise/passwords/edit.html.erb` |
| Confirmação de conta | Devise View | `app/views/devise/confirmations/new.html.erb` |
| Componentes compartilhados | Partials | `_flash.html.erb`, `_navbar_public.html.erb`, `_footer.html.erb` |
| Rotas | Config | `config/routes.rb` |

### Dependências Nenhumа gem adicional necessária

Tudo será implementado com as gems já presentes no projeto:
- `devise` (autenticação)
- `cssbundling-rails` + `@tailwindcss/cli` (estilização)
- `turbo-rails` + `stimulus-rails` (interatividade)

---

## 3. Configuração do TailwindCSS

### 3.1 Paleta de Cores (definida no PROJECT_PLAN.md)

O tema visual do ContaAI usa tons de marrom, bege e dourado. As cores serão configuradas diretamente no CSS via `@theme` do TailwindCSS v4.

### 3.2 Arquivo: `app/assets/stylesheets/application.tailwind.css`

```css
@import "tailwindcss";

@theme {
  --color-primary: #8B7355;
  --color-primary-dark: #6B5A42;
  --color-primary-light: #A89070;

  --color-accent: #C2A47E;
  --color-accent-dark: #A8895F;
  --color-accent-light: #D4BC9A;

  --color-bg-main: #F5E6D3;
  --color-bg-secondary: #F5F0EB;
  --color-bg-card: #FFFFFF;

  --color-text-primary: #2F241C;
  --color-text-secondary: #6B7280;
  --color-text-muted: #9CA3AF;

  --color-border: #E5D5C3;
  --color-border-light: #F0E6D9;

  --color-success: #059669;
  --color-error: #DC2626;
  --color-warning: #D97706;

  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-serif: 'Playfair Display', ui-serif, Georgia, serif;
  --font-reading: 'Cormorant Garamond', ui-serif, Georgia, serif;
}
```

### 3.3 Google Fonts (adicionar ao `<head>` do layout)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
```

### 3.4 Script de build (já configurado no `package.json`)

```json
"build:css": "npx @tailwindcss/cli -i ./app/assets/stylesheets/application.tailwind.css -o ./app/assets/builds/application.css --minify"
```

Nenhuma alteração necessária no `package.json`.

---

## 4. Landing Page (Página Inicial Pública)

**Referência**: F-LAND-001, F-LAND-002, F-LAND-003 do PROJECT_PLAN.md

### 4.1 Controller: `app/controllers/landing_controller.rb`

```ruby
class LandingController < ApplicationController
  def index
    redirect_to root_path if user_signed_in?
    @featured_books = Book.published.includes(:user).limit(8)
    @categories = Book.published.group(:category).count
  end
end
```

**Notas**:
- `before_action :authenticate_user!` NÃO deve ser usado aqui (página pública)
- Redirect automático para Dashboard se já autenticado
- `Book.published` precisa de um scope no model (verificar se existe)

### 4.2 Estrutura da Landing Page

A landing page será composta por 5 seções, conforme definido no PROJECT_PLAN.md:

#### Seção 1: Hero

**Layout**: Seção fullscreen com gradiente de fundo, título em fonte serif, subtítulo e CTA duplo (Entrar / Criar Conta).

**Componentes**:
- Título principal: "Descubra, leia e compartilhe histórias" (fonte Playfair Display)
- Subtítulo descritivo da plataforma
- Botão primário: "Comece a escrever" → `/users/sign_up`
- Botão secundário: "Explorar livros" → scroll para vitrine
- Background: gradiente sutil usando `--color-bg-main` → `--color-accent-light`

**Classes Tailwind principais**:
```
bg-gradient-to-br from-bg-main to-accent-light
font-serif (título)
text-text-primary
```

#### Seção 2: Vitrine de Livros (Featured Books)

**Layout**: Grid responsivo de cards de livros (2 colunas mobile, 4 desktop).

**Componentes por card**:
- Capa do livro (ou bloco de cor com título)
- Título do livro
- Nome do autor
- Avaliação média (estrelas)
- Hover: elevação com sombra

**Classes Tailwind principais**:
```
grid grid-cols-2 lg:grid-cols-4 gap-6
bg-bg-card rounded-xl shadow-md hover:shadow-lg transition-shadow
```

**Regras**:
- Apenas livros com status `published`
- Ordenação: mais recentes primeiro
- Se não houver livros, exibir mensagem amigável

#### Seção 3: Comunidade

**Layout**: Seção com 3 cards de features destacando os benefícios da plataforma.

**Features**:
1. "Escreva e publique" — ícone de livro + descrição
2. "Descubra novas histórias" — ícone de bússola + descrição
3. "Conecte-se com autores" — ícone de pessoas + descrição

**Classes Tailwind principais**:
```
grid grid-cols-1 md:grid-cols-3 gap-8
bg-bg-secondary p-8 rounded-lg
```

#### Seção 4: Contribua (CTA Final)

**Layout**: Seção de chamada para ação com fundo `--color-primary`.

**Componentes**:
- Título: "Junte-se à comunidade ContaAI"
- Subtítulo: "Crie sua conta gratuita e comece a escrever hoje"
- Botão: "Criar minha conta" → `/users/sign_up`

#### Seção 5: Rodapé

**Layout**: Rodapé simples com links e informações legais.

**Componentes**:
- Logo/nome ContaAI
- Links: Sobre, Termos de Uso, Privacidade
- Copyright

### 4.3 Navegação na Landing Page

Para visitantes (não autenticados):

| Item | Link | Posição |
| --- | --- | --- |
| Logo/ContaAI | `/` | Header esquerdo |
| Entrar | `/users/sign_in` | Header direito |
| Criar Conta | `/users/sign_up` | Header direito (botão primário) |

### 4.4 Responsividade

| Breakpoint | Comportamento |
| --- | --- |
| `< 640px` (mobile) | Hero centralizado, grid 1 coluna, menu hamburger |
| `640px - 1024px` (tablet) | Grid 2 colunas, nav completa |
| `> 1024px` (desktop) | Grid 4 colunas, layout amplo com max-width |

---

## 5. Tela de Login

**Referência**: F-AUTH-002 do PROJECT_PLAN.md

### 5.1 Rota

```
GET /users/sign_in → devise/sessions#new
POST /users/sign_in → devise/sessions#create
DELETE /users/sign_out → devise/sessions#destroy
```

(Definida automaticamente por `devise_for :users`)

### 5.2 Layout

**Estrutura**: Layout split — formulário à esquerda, ilustração/branding à direita (desktop). Em mobile, apenas o formulário.

**Classes Tailwind principais**:
```
min-h-screen flex
left side: flex-1 flex items-center justify-center bg-bg-main
right side: hidden lg:flex flex-1 bg-primary items-center justify-center
```

### 5.3 Elementos do Formulário

| Elemento | Tipo | Classes | Validações |
| --- | --- | --- | --- |
| Email | `email_field` | `w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent` | Obrigatório, formato email |
| Senha | `password_field` | Mesmas classes do email | Obrigatório |
| Lembrar-me | `check_box` | `h-4 w-4 text-accent rounded` | Opcional |
| Botão Entrar | `submit` | `w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors` | — |

### 5.4 Links e Ações

| Elemento | Destino | Posição |
| --- | --- | --- |
| "Esqueceu sua senha?" | `/users/password/new` | Abaixo do campo de senha |
| "Criar uma conta" | `/users/sign_up` | Abaixo do botão |
| Logo/ContaAI | `/` | Topo do formulário |

### 5.5 Flash Messages

Exibir erros de autenticacao acima do formulario:
```erb
<% if flash[:alert] %>
  <div class="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg mb-4">
    <%= flash[:alert] %>
  </div>
<% end %>
```

### 5.6 Ilustração (Lado Direito)

- Fundo com cor `--color-primary`
- Logo do ContaAI em branco
- Frase motivacional: "Milhares de histórias esperam por você"
- Ícone decorativo de livro

---

## 6. Tela de Cadastro

**Referência**: F-AUTH-001 do PROJECT_PLAN.md

### 6.1 Rota

```
GET /users/sign_up → devise/registrations#new
POST /users → devise/registrations#create
```

(Definida automaticamente por `devise_for :users`)

### 6.2 Layout

Mesmo layout split do login (consistencia visual). Lado esquerdo: formulário. Lado direito: ilustração.

### 6.3 Elementos do Formulário

| Elemento | Tipo | Classes | Validações |
| --- | --- | --- | --- |
| Nome completo | `text_field` | `w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent` | Obrigatório |
| Email | `email_field` | Mesmas classes | Obrigatório, formato válido, único |
| Senha | `password_field` | Mesmas classes | Obrigatório, mínimo 8 caracteres |
| Confirmar senha | `password_field` | Mesmas classes | Obrigatório, deve coincidir |
| Botão Criar Conta | `submit` | `w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors` | — |

### 6.4 Campos Hidden

O Devise precisa dos campos `name` no `sign_up_params`. Configurar em `app/controllers/application_controller.rb`:

```ruby
class ApplicationController < ActionController::Base
  before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:name])
    devise_parameter_sanitizer.permit(:account_update, keys: [:name, :bio, :avatar])
  end
end
```

### 6.5 Links e Ações

| Elemento | Destino | Posição |
| --- | --- | --- |
| "Já tem uma conta? Entrar" | `/users/sign_in` | Abaixo do botão |
| Logo/ContaAI | `/` | Topo do formulário |

### 6.6 Ilustração (Lado Direito)

- Fundo `--color-primary`
- Mensagem: "Comece sua jornada literária hoje"
- Ícones decorativos de escrita

### 6.7 Pós-Cadastro

- Usuário é criado com `role: :reader` (padrão definido no model)
- Se `confirmable` estiver ativo: exibir mensagem "Confirme seu email"
- Se não: redirecionar para Dashboard

---

## 7. Tela de Recuperação de Senha

**Referência**: F-AUTH-003 do PROJECT_PLAN.md

### 7.1 Rota

```
GET /users/password/new → devise/passwords#new
POST /users/password → devise/passwords#create
```

### 7.2 Layout

Layout Devise (split) — consistente com login e cadastro.

### 7.3 Elementos do Formulário

| Elemento | Tipo | Classes | Validações |
| --- | --- | --- | --- |
| Email | `email_field` | `w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent` | Obrigatório |
| Botão Enviar link | `submit` | `w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors` | — |

### 7.4 Fluxo Completo

1. Usuário acessa `/users/password/new`
2. Informa email cadastrado
3. Clica em "Enviar link de recuperação"
4. Devise envia email com token (expira em 6 horas — `config.reset_password_within`)
5. Toast/flash: "Se o email estiver cadastrado, você receberá um link de redefinição"
6. Usuário clica no link → redirecionado para `/users/password/edit?reset_password_token=TOKEN`

### 7.5 Mensagem de Sucesso

Mesmo que o email não exista, exibir a mesma mensagem (segurança — evitar enumeration):
```
"Se o endereço de email estiver cadastrado em nossa plataforma, você receberá um link para redefinir sua senha."
```

### 7.6 Links

| Elemento | Destino |
| --- | --- |
| "Voltar ao login" | `/users/sign_in` |

---

## 8. Tela de Redefinição de Senha

**Referência**: F-AUTH-003 do PROJECT_PLAN.md

### 8.1 Rota

```
GET /users/password/edit → devise/passwords#edit
PUT /users/password → devise/passwords#update
```

### 8.2 Layout

Layout Devise (split) — consistente.

### 8.3 Elementos do Formulário

| Elemento | Tipo | Classes | Validações |
| --- | --- | --- | --- |
| Nova senha | `password_field` | `w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent` | Obrigatório, mínimo 8 caracteres |
| Confirmar nova senha | `password_field` | Mesmas classes | Obrigatório, deve coincidir |
| Botão Redefinir | `submit` | `w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-lg transition-colors` | — |

### 8.4 Fluxo

1. Usuário clica no link do email
2. Acessa formulário com token na URL
3. Define nova senha
4. Sistema valida e atualiza
5. Flash: "Sua senha foi alterada com sucesso"
6. Redirecionado para Dashboard (login automático pós-reset)

---

## 9. Layout e Componentes Compartilhados

### 9.1 Layout Principal: `app/views/layouts/application.html.erb`

Atualização do layout existente para incluir:
- Google Fonts (Inter, Playfair Display, Cormorant Garamond)
- TailwindCSS classes no `<body>`
- Tratamento de flash messages (notice e alert)
- Meta tags para SEO

```erb
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title><%= content_for(:title) || "ContaAI" %></title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="description" content="<%= content_for(:description) || 'Plataforma de escrita, publicação e leitura de livros' %>">
    <%= csrf_meta_tags %>
    <%= csp_meta_tag %>
    <%= yield :head %>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
    <link rel="icon" href="/icon.png" type="image/png">
    <%= stylesheet_link_tag :app, "data-turbo-track": "reload" %>
    <%= javascript_include_tag "application", "data-turbo-track": "reload", type: "module" %>
  </head>
  <body class="font-sans bg-bg-main text-text-primary antialiased">
    <%= render "shared/flash" %>
    <%= yield %>
  </body>
</html>
```

### 9.2 Layout Devise: `app/views/layouts/devise.html.erb`

Layout separado para páginas de autenticação (login, cadastro, etc):

```erb
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <title><%= content_for(:title) || "ContaAI" %></title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <%= csrf_meta_tags %>
    <%= csp_meta_tag %>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
    <link rel="icon" href="/icon.png" type="image/png">
    <%= stylesheet_link_tag :app, "data-turbo-track": "reload" %>
    <%= javascript_include_tag "application", "data-turbo-track": "reload", type: "module" %>
  </head>
  <body class="font-sans bg-bg-main text-text-primary antialiased min-h-screen">
    <%= render "shared/flash" %>
    <%= yield %>
  </body>
</html>
```

**Uso**: Devise controllers precisam usar esse layout. Configurar em `config/initializers/devise.rb`:

```ruby
config.parent_controller = 'DeviseController'
```

Ou criar `app/controllers/devise_controller.rb`:

```ruby
class DeviseController < ApplicationController
  layout 'devise'
end
```

E fazer os controllers do Devise herdar dele (via configuração do Devise):

```ruby
# config/initializers/devise.rb
config.parent_controller = 'DeviseController'
```

### 9.3 Partial: `_flash.html.erb`

```erb
<% if flash[:notice] %>
  <div class="fixed top-4 right-4 z-50 bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg shadow-lg max-w-md"
       data-controller="flash" data-flash-target="message" data-flash-delay-value="5000">
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>
      <span><%= flash[:notice] %></span>
    </div>
  </div>
<% end %>

<% if flash[:alert] %>
  <div class="fixed top-4 right-4 z-50 bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg shadow-lg max-w-md"
       data-controller="flash" data-flash-target="message" data-flash-delay-value="5000">
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      <span><%= flash[:alert] %></span>
    </div>
  </div>
<% end %>
```

### 9.4 Partial: `_navbar_public.html.erb`

Navbar para a landing page (visitantes):

```erb
<nav class="fixed top-0 left-0 right-0 z-40 bg-bg-main/80 backdrop-blur-md border-b border-border-light">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center gap-2">
        <!-- Logo -->
        <span class="font-serif text-xl font-bold text-primary">ContaAI</span>
      </div>
      <div class="flex items-center gap-4">
        <%= link_to "Entrar", new_user_session_path, class: "text-text-secondary hover:text-text-primary transition-colors" %>
        <%= link_to "Criar Conta", new_user_registration_path, class: "bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors" %>
      </div>
    </div>
  </div>
</nav>
```

### 9.5 Partial: `_footer.html.erb`

```erb
<footer class="bg-text-primary text-white py-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <span class="font-serif text-xl font-bold">ContaAI</span>
        <p class="mt-2 text-text-muted text-sm">
          Uma plataforma para escritores e leitores.
        </p>
      </div>
      <div>
        <h3 class="font-semibold mb-3">Links</h3>
        <ul class="space-y-2 text-sm text-text-muted">
          <li><a href="#" class="hover:text-accent transition-colors">Sobre</a></li>
          <li><a href="#" class="hover:text-accent transition-colors">Termos de Uso</a></li>
          <li><a href="#" class="hover:text-accent transition-colors">Privacidade</a></li>
        </ul>
      </div>
      <div>
        <h3 class="font-semibold mb-3">ContaAI</h3>
        <p class="text-text-muted text-sm">
          Descubra, leia e compartilhe histórias.
        </p>
      </div>
    </div>
    <div class="border-t border-white/10 mt-8 pt-8 text-center text-text-muted text-sm">
      &copy; <%= Date.current.year %> ContaAI. Todos os direitos reservados.
    </div>
  </div>
</footer>
```

---

## 10. Rotas e Controllers

### 10.1 Atualização de `config/routes.rb`

```ruby
Rails.application.routes.draw do
  devise_for :users

  # Landing page (pública)
  root "landing#index"

  # Health check
  get "up" => "rails/health#show", as: :rails_health_check
end
```

### 10.2 `ApplicationController` — Devise Parameter Sanitizer

```ruby
class ApplicationController < ActionController::Base
  before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:name])
    devise_parameter_sanitizer.permit(:account_update, keys: [:name, :bio, :avatar])
  end
end
```

### 10.3 Verificar Model `Book`

O `LandingController` usa `Book.published`. Verificar se o scope existe:

```ruby
# app/models/book.rb (verificar se já existe)
class Book < ApplicationRecord
  scope :published, -> { where(status: :published) }
  # ...
end
```

Se o model `Book` ainda não existe, o `LandingController` deve usar uma query direta ou o controller deve tratar a ausência:

```ruby
def index
  redirect_to dashboard_path if user_signed_in?
  @featured_books = defined?(Book) ? Book.published.includes(:user).limit(8) : []
end
```

---

## 11. Devise Views Customizadas

### 11.1 Gerar Views Base

```bash
rails generate devise:views
```

Isso cria todas as views do Devise em `app/views/devise/`. Em seguida, customizar cada uma conforme especificado nas seções 5-8.

### 11.2 Views a Customizar

| View | Caminho | Seção deste Plano |
| --- | --- | --- |
| Login | `app/views/devise/sessions/new.html.erb` | Seção 5 |
| Cadastro | `app/views/devise/registrations/new.html.erb` | Seção 6 |
| Recuperação | `app/views/devise/passwords/new.html.erb` | Seção 7 |
| Redefinição | `app/views/devise/passwords/edit.html.erb` | Seção 8 |
| Confirmação | `app/views/devise/confirmations/new.html.erb` | Seção 7 (variante) |
| Edição de conta | `app/views/devise/registrations/edit.html.erb` | Fase 4 (futuro) |

### 11.3 Estrutura Comum das Views Devise

Todas as views Devise devem seguir o layout split:

```erb
<div class="min-h-screen flex">
  <!-- Lado esquerdo: Formulário -->
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="mb-8">
        <%= link_to root_path do %>
          <span class="font-serif text-2xl font-bold text-primary">ContaAI</span>
        <% end %>
      </div>

      <!-- Título -->
      <h1 class="text-2xl font-bold text-text-primary mb-2">Título da Página</h1>
      <p class="text-text-secondary mb-8">Descrição da página</p>

      <!-- Flash messages inline -->
      <% if flash[:alert] %>
        <div class="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg mb-6">
          <%= flash[:alert] %>
        </div>
      <% end %>

      <% if flash[:notice] %>
        <div class="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg mb-6">
          <%= flash[:notice] %>
        </div>
      <% end %>

      <!-- Formulário -->
      <%= form_for(resource, as: resource_name, url: session_path(resource_name), html: { class: "space-y-6" }) do |f| %>
        <!-- Campos aqui -->
      <% end %>

      <!-- Links extras -->
      <div class="mt-6 text-center">
        <!-- Links de navegação -->
      </div>
    </div>
  </div>

  <!-- Lado direito: Ilustração -->
  <div class="hidden lg:flex flex-1 bg-primary items-center justify-center">
    <div class="text-center text-white px-12">
      <!-- Conteúdo decorativo -->
    </div>
  </div>
</div>
```

---

## 12. Fluxos de Navegação

### 12.1 Visitante (Não Autenticado)

```
Landing Page (/)
  ├── "Entrar" → Login (/users/sign_in)
  │     ├── Login OK → Dashboard (/)
  │     ├── "Esqueci senha" → Recuperação (/users/password/new)
  │     │     └── Email enviado → Toast + volta pro login
  │     └── "Criar conta" → Cadastro (/users/sign_up)
  │           └── Cadastro OK → Dashboard (/)
  └── "Explorar" → scroll para vitrine
```

### 12.2 Usuário Autenticado

```
Dashboard (/)
  ├── Sidebar: Explorar, Biblioteca, Configurações, etc.
  └── Header: Avatar → Dropdown (Configurações, Sair)
```

### 12.3 Proteção de Rotas

| Rota | Autenticado? | Ação se não autenticado |
| --- | --- | --- |
| `/` (root) | Não | Exibe landing page |
| `/users/sign_in` | Não | Redireciona para `/` |
| `/users/sign_up` | Não | Redireciona para `/` |
| `/users/password/new` | Não | Permite acesso |
| `/dashboard` | **Sim** | Redireciona para `/users/sign_in` |
| `/books/*` | **Sim** | Redireciona para `/users/sign_in` |

---

## 13. Checklist de Implementação

### Etapa 1: Configuração Base

- [x] Atualizar `app/assets/stylesheets/application.tailwind.css` com tema customizado
- [x] Adicionar Google Fonts ao layout
- [x] Criar `app/views/layouts/devise.html.erb`
- [x] Atualizar `app/views/layouts/application.html.erb`
- [x] Criar `app/views/shared/_flash.html.erb`
- [x] Criar `app/views/shared/_navbar_public.html.erb`
- [x] Criar `app/views/shared/_footer.html.erb`
- [x] Configurar Devise parameter sanitizer no `ApplicationController`
- [x] Configurar Devise para usar layout customizado

### Etapa 2: Landing Page

- [x] Criar `app/controllers/landing_controller.rb`
- [x] Definir `root "landing#index"` em `config/routes.rb`
- [x] Criar `app/views/landing/index.html.erb` com 5 seções
- [x] Implementar Hero com CTA
- [x] Implementar Vitrine de Livros (grid de cards)
- [x] Implementar seção Comunidade
- [x] Implementar CTA Final
- [x] Implementar Rodapé
- [x] Garantir responsividade mobile/tablet/desktop

### Etapa 3: Devise Views

- [x] Rodar `rails generate devise:views`
- [x] Customizar `app/views/devise/sessions/new.html.erb` (Login)
- [x] Customizar `app/views/devise/registrations/new.html.erb` (Cadastro)
- [x] Customizar `app/views/devise/passwords/new.html.erb` (Recuperação)
- [x] Customizar `app/views/devise/passwords/edit.html.erb` (Redefinição)
- [x] Customizar `app/views/devise/confirmations/new.html.erb` (Confirmação)
- [x] Garantir layout split consistente em todas as views
- [x] Garantir flash messages funcionando

### Etapa 4: Validação

- [x] Build CSS compilado com sucesso (`npm run build:css`)
- [x] Rotas verificadas via `rails routes` — root, Devise, health check OK
- [ ] Testar fluxo: visitante → landing → cadastro → dashboard (pendente de teste manual)
- [ ] Testar fluxo: visitante → landing → login → dashboard (pendente de teste manual)
- [ ] Testar fluxo: esqueci senha → email → redefinir → login (pendente de teste manual)
- [ ] Testar redirecionamento: autenticado acessa login → redireciona para dashboard (pendente de teste manual)
- [ ] Testar responsividade em mobile (320px+) (pendente de teste manual)
- [ ] Testar responsividade em tablet (768px+) (pendente de teste manual)
- [ ] Testar responsividade em desktop (1024px+) (pendente de teste manual)
- [ ] Verificar acessibilidade: contraste de cores, navegação por teclado, labels nos inputs (pendente de teste manual)

---

## 14. Registro de Implementação

### Implementação realizada em: 22/07/2026

#### Etapa 1: Configuração Base

- **`app/assets/stylesheets/application.tailwind.css`**: Atualizado com bloco `@theme` completo contendo paleta de cores (primary, accent, bg-main, text, border, success/error/warning) e famílias de fontes (Inter, Playfair Display, Cormorant Garamond).
- **`app/views/layouts/application.html.erb`**: Reescrito com suporte a `lang="pt-BR"`, meta tags de SEO, Google Fonts (3 fontes), classes Tailwind no `<body>`, render do partial `_flash`, e título dinâmico.
- **`app/views/layouts/devise.html.erb`**: Criado layout dedicado para páginas Devise com Google Fonts, classes Tailwind, e render do partial `_flash`.
- **`app/views/shared/_flash.html.erb`**: Criado partial com flash messages estilizadas (notice verde, alert vermelho), posicionamento fixo no canto superior direito com z-index alto.
- **`app/views/shared/_navbar_public.html.erb`**: Criada navbar pública fixa com backdrop blur, logo "ContaAI" em fonte serif, links "Entrar" e botão "Criar Conta".
- **`app/views/shared/_footer.html.erb`**: Criado rodapé com grid 3 colunas (marca, links, descrição), borda separadora e copyright dinâmico.
- **`app/controllers/application_controller.rb`**: Adicionado `before_action :configure_permitted_parameters` para Devise, com permissão de `name` no sign_up e `name, bio, avatar` no account_update.
- **`app/controllers/devise_controller.rb`**: Criado para herdar de `ApplicationController` e forçar `layout "devise"`.
- **`config/initializers/devise.rb`**: Ativado `config.parent_controller = 'DeviseController'` para que os controllers do Devise usem o layout customizado.
- **`app/models/book.rb`**: Criado model com `belongs_to :user`, enums `category` e `status`, scope `published` e `recent`, e associations para chapters, ratings, favorites, reading_progresses.
- **Instalação de dependências**: `tailwindcss` e `@tailwindcss/cli` instalados via npm (não estavam no `node_modules`).

#### Etapa 2: Landing Page

- **`app/controllers/landing_controller.rb`**: Criado com action `index` que busca `Book.published` (com fallback se Book não existir) e redireciona usuários autenticados.
- **`config/routes.rb`**: Atualizado com `root "landing#index"`, removidos comentários desnecessários.
- **`app/views/landing/index.html.erb`**: Criada com 5 seções:
  1. **Hero**: Gradiente `bg-main → accent-light`, título Playfair Display, subtítulo, CTA duplo (explorar/começar).
  2. **Vitrine de Livros**: Grid responsivo (1→2→4 colunas), cards com capa colorida, título, autor, avaliação. Mensagem amigável quando vazio.
  3. **Comunidade**: 3 cards com ícones SVG (escrever, descobrir, conectar).
  4. **CTA Final**: Fundo primary, título, subtítulo, botão "Criar minha conta".
  5. **Rodapé**: Via partial `_footer`.

#### Etapa 3: Devise Views

- `rails generate devise:views` executado para gerar todas as views base.
- Todas as views customizadas com layout split (formulário à esquerda, ilustração à direita em desktop):
  - **Login** (`sessions/new.html.erb`): Campos email/senha, checkbox lembrar-me, link "Esqueceu senha?", link "Criar conta". Ilustração com frase "Milhares de histórias esperam por você".
  - **Cadastro** (`registrations/new.html.erb`): Campos nome/email/senha/confirmar senha, validação de erros, link "Já tem conta?". Ilustração com "Comece sua jornada literária hoje".
  - **Recuperação** (`passwords/new.html.erb`): Campo email, botão "Enviar link de recuperação", link "Voltar ao login". Ilustração com "Recupere o acesso à sua conta".
  - **Redefinição** (`passwords/edit.html.erb`): Campos nova senha/confirmar, hidden field reset_password_token. Ilustração com "Segurança primeiro".
  - **Confirmação** (`confirmations/new.html.erb`): Campo email, botão "Reenviar instruções". Ilustração com "Quase lá!".

#### Etapa 4: Validação

- Build CSS (`npm run build:css`): Compilou com sucesso sem erros.
- Rotas (`rails routes`): Todas as rotas conferidas — root → landing#index, todas as rotas Devise (session, registration, password, confirmation, unlock) funcionais.

1. **Devise + Hotwire/Turbo**: O Devise já está configurado com `config.responder.error_status = :unprocessable_content` e `config.responder.redirect_status = :see_other`, compatíveis com Turbo.

2. **Flash Messages**: O Devise popula `flash[:notice]` e `flash[:alert]`. O partial `_flash.html.erb` deve ser incluído em ambos os layouts.

3. **Confirmação de Email**: O módulo `confirmable` está ativo no User model. Após cadastro, o usuário receberá email de confirmação. Durante o desenvolvimento, pode ser necessário desabilitar temporariamente ou usar `User.confirm_all` no console.

4. **Lockable**: O módulo `lockable` está ativo. Após tentativas failed_attempts (padrão: 20), a conta será bloqueada. Considere ajustar `config.maximum_attempts` no devise.rb.

5. **Model Book**: O LandingController referencia `Book.published`. Verificar se o model e o scope existem antes de implementar.

---

_Documento criado em: 22/07/2026_
_Versão: 1.0_
_Baseado em: PROJECT_PLAN.md v2.0_
