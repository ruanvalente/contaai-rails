# ContaAI - Plano de Implementação do Dashboard

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Layout Principal](#2-layout-principal)
3. [Sidebar](#3-sidebar)
4. [Header](#4-header)
5. [Área Principal - Dashboard do Autor](#5-área-principal---dashboard-do-autor)
6. [Informações do Usuário Logado](#6-informações-do-usuário-logado)
7. [Roteamento](#7-roteamento)
8. [Identidade Visual](#8-identidade-visual)
9. [Referências](#9-referências)

---

## 1. Visão Geral

O Dashboard é a tela principal apresentada ao usuário após o login. Funciona como hub central de navegação, contendo sidebar, header e área de conteúdo principal.

### 1.1 Fluxo de Acesso

- Usuário realiza login (F-AUTH-002)
- Usuário autenticado é redirecionado para `/dashboard` (descoberta)
- Visitante não autenticado visualiza landing page pública

### 1.2 Funcionalidades Integradas

| ID          | Funcionalidade                        |
| ----------- | ------------------------------------- |
| F-DASH-001  | Estatísticas pessoais do autor        |
| F-DASH-002  | Estatísticas da plataforma            |
| F-DASH-003  | Listagem de livros do autor           |
| F-DASH-004  | Ações rápidas (criar novo livro)      |
| F-LAND-002  | Navegação global (sidebar)            |
| F-LAND-003  | Cabeçalho (header)                    |

---

## 2. Layout Principal

```
┌─────────────────────────────────────────────────────────┐
│  HEADER                                                  │
│  [Logo] [Campo de busca] [Avatar] [Menu dropdown]       │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│  SIDEBAR   │           ÁREA DE CONTEÚDO                 │
│            │                                            │
│  Menu de   │  ┌──────────────────────────────────────┐  │
│  navegação │  │  Dashboard / Estatísticas            │  │
│            │  │                                      │  │
│            │  ├──────────────────────────────────────┤  │
│            │  │                                      │  │
│            │  │  Cards de métricas                   │  │
│            │  │                                      │  │
│            │  ├──────────────────────────────────────┤  │
│            │  │                                      │  │
│            │  │  Listagem de livros                  │  │
│            │  │                                      │  │
│            │  └──────────────────────────────────────┘  │
│            │                                            │
├────────────┴────────────────────────────────────────────┤
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Sidebar

A sidebar contém o menu de navegação principal da aplicação.

### 3.1 Itens do Menu

| Item             | Rota                      | Ícone sugestivo     | Requer Auth | Descrição                        |
| ---------------- | ------------------------- | -------------------- | ----------- | -------------------------------- |
| Dashboard        | `/dashboard`              | Home / Dashboard     | Sim         | Página inicial do dashboard      |
| Explorar         | `/explore`                | Compass / Search     | Não         | Catálogo público de livros       |
| Minha Sessão     | `/reading`                | BookOpen             | Não         | Leitura em andamento             |
| Categorias       | `/categories`             | Grid / Tag           | Não         | Navegação por categoria          |
| Minha Biblioteca | `/library`                | Book / Library       | Sim         | Acervo pessoal de leitura        |
| Downloads        | `/downloads`              | Download / ArrowDown | Sim         | Arquivos baixados                |
| Favoritos        | `/favorites`              | Heart / Star         | Sim         | Livros marcados como favoritos   |
| Configurações    | `/settings`               | Settings / Gear      | Sim         | Preferências do usuário          |
| Sair             | Ação (logout)             | LogOut               | Sim         | Encerrar sessão                  |

### 3.2 Comportamento

- **Item ativo**: Indicador visual de destaque na rota atual (cor `#C2A47E`)
- **Hover**: Fundo escurecido ou borda lateral indicativa
- **Colapso**: Sidebar pode ser recolhida em telas menores (mobile: drawer lateral)
- **Avatar e nome**: Exibidos no topo da sidebar quando autenticado

### 3.3 Estado de Autenticação

- Itens que **requerem autenticação** são ocultados para visitantes
- Para visitantes, sidebar mostra apenas: Explorar, Minha Sessão, Categorias

---

## 4. Header

### 4.1 Elementos

| Elemento          | Descrição                                                  |
| ----------------- | ---------------------------------------------------------- |
| Logo              | Nome da aplicação "ContaAI" com tipografia decorativa      |
| Campo de busca    | Input com placeholder "Buscar livros..."                   |
| Avatar do usuário | Foto de perfil do usuário logado                           |
| Menu dropdown     | Opções: Configurações, Sair                                |

### 4.2 Comportamento

- **Busca global**: Pesquisa por título de livro, busca com debounce (~300ms)
- **Avatar**: Clique abre dropdown com opções de configuração e logout
- **Responsivo**: Em mobile, busca pode colapsar para ícone

---

## 5. Área Principal - Dashboard do Autor

### 5.1 Estatísticas Pessoais (F-DASH-001)

Cards de métricas do autor logado:

| Métrica           | Descrição                                      | Ícone sugerido |
| ----------------- | ---------------------------------------------- | -------------- |
| Total de livros   | Quantidade de livros criados                   | Book           |
| Livros publicados | Quantidade com status "Publicado"              | CheckCircle    |
| Rascunhos         | Quantidade com status "Rascunho"               | Edit           |
| Total de palavras | Soma de palavras de todas as obras             | FileText       |
| Total de leituras | Quantidade de vezes que suas obras foram lidas | Eye            |
| Avaliação média   | Média das avaliações recebidas                 | Star           |

**Layout sugerido**: Grid responsivo de 3 colunas (desktop) / 2 colunas (tablet) / 1 coluna (mobile)

### 5.2 Estatísticas da Plataforma (F-DASH-002)

Métricas gerais da plataforma:

| Métrica           | Descrição                                     |
| ----------------- | --------------------------------------------- |
| Total de autores  | Quantidade de usuários com livros publicados  |
| Total de livros   | Quantidade de livros publicados na plataforma |
| Total de leitores | Quantidade de usuários ativos                 |

**Layout sugerido**: Barra horizontal ou seção separada abaixo das métricas pessoais

### 5.3 Listagem de Livros do Autor (F-DASH-003)

#### Informações por Livro

- Título
- Nome do autor
- Capa (imagem ou cor de fundo)
- Status (Rascunho / Publicado) com indicador visual
- Data de atualização

#### Ações por Livro

| Ação        | Descrição                                        |
| ----------- | ------------------------------------------------ |
| Editar      | Abrir editor de escrita (F-BOOK-002)             |
| Excluir     | Remover livro com confirmação (F-BOOK-005)       |
| Publicar    | Publicar rascunho (F-BOOK-004)                   |

#### Comportamento

- Ordenação por data de atualização (mais recente primeiro)
- Diferenciação visual entre rascunhos (borda tracejada) e publicados (borda sólida)
- Ação rápida: botão "Criar Livro" no topo da listagem

### 5.4 Ações Rápidas (F-DASH-004)

| Ação             | Descrição                               |
| ---------------- | --------------------------------------- |
| Criar novo livro | Abre modal/formulário de criação        |

---

## 6. Informações do Usuário Logado

### 6.1 Dados Exibidos

| Campo     | Localização          | Descrição                        |
| --------- | -------------------- | -------------------------------- |
| Nome      | Sidebar + Header     | Nome de exibição do usuário      |
| Email     | Menu dropdown        | Email para referência            |
| Avatar    | Sidebar + Header     | Foto de perfil (ou iniciais)     |
| Papel     | Sidebar              | Indicador "Autor" se publicou    |

### 6.2 Fonte de Dados

- Dados carregados via sessão do usuário autenticado
- Atualização em tempo real ao editar perfil (F-CONF-001)

---

## 7. Roteamento

### 7.1 Rotas do Dashboard

| Rota                 | Componente              | Autenticado |
| -------------------- | ----------------------- | ----------- |
| `/`                  | Landing Page            | Não         |
| `/login`             | Login                   | Não         |
| `/signup`            | Cadastro                | Não         |
| `/forgot-password`   | Recuperação de senha    | Não         |
| `/dashboard`         | Dashboard Principal     | Sim         |
| `/explore`           | Catálogo de Livros      | Não         |
| `/reading`           | Leitura em Andamento    | Não         |
| `/categories`        | Página de Categorias    | Não         |
| `/library`           | Minha Biblioteca        | Sim         |
| `/downloads`         | Downloads               | Sim         |
| `/favorites`         | Favoritos               | Sim         |
| `/settings`          | Configurações           | Sim         |
| `/books/:id`         | Detalhes do Livro       | Não         |
| `/books/:id/edit`    | Editor de Escrita       | Sim         |
| `/books/:id/read`    | Tela de Leitura         | Não         |

### 7.2 Guardas de Rota

- Rotas com `Autenticado: Sim` devem redirecionar para `/login` se não autenticado
- Usuário já autenticado acessando `/` ou `/login` é redirecionado para `/dashboard`

---

## 8. Identidade Visual

### 8.1 Cores do Dashboard

| Elemento               | Cor           | Código    |
| ---------------------- | ------------- | --------- |
| Sidebar                | Marrom        | `#8B7355` |
| Header                 | Bege claro    | `#F5E6D3` |
| Fundo principal        | Bege claro    | `#F5E6D3` |
| Fundo secundário/cards | Bege          | `#F5F0EB` |
| Hover/destaque         | Dourado       | `#C2A47E` |
| Texto principal        | Marrom escuro | `#2F241C` |
| Texto secundário       | Cinza         | `#6B7280` |

### 8.2 Tipografia

| Elemento          | Família                          | Pesos              |
| ----------------- | -------------------------------- | ------------------ |
| Logo/Brand        | Serif (Playfair Display)         | 600, 700           |
| Navegação         | Sans-serif (Inter)               | 500, 600           |
| Títulos           | Serif (Playfair Display)         | 600, 700           |
| Corpo de texto    | Sans-serif (Inter)               | 400, 500           |
| Métricas/Números  | Sans-serif (Inter)               | 700                |

### 8.3 Ícones

- Usar biblioteca de ícones consistente (ex: Lucide, Heroicons)
- Tamanho padrão: 20px em nav, 24px em cards

---

## 9. Referências

| ID          | Seção do PROJECT_PLAN                         |
| ----------- | --------------------------------------------- |
| F-DASH-001  | Seção 3.2 - Estatísticas Pessoais             |
| F-DASH-002  | Seção 3.2 - Estatísticas da Plataforma        |
| F-DASH-003  | Seção 3.2 - Listagem de Livros do Autor       |
| F-DASH-004  | Seção 3.2 - Ações Rápidas                     |
| F-LAND-002  | Seção 3.10 - Navegação Global (Sidebar)       |
| F-LAND-003  | Seção 3.10 - Cabeçalho (Header)               |
| F-AUTH-002  | Seção 3.1 - Login                             |
| F-CONF-001  | Seção 3.9 - Edição de Perfil                  |

---

_Documento baseado em: PROJECT_PLAN.md v2.0_
_Data de criação: 21/07/2026_
_Versão: 1.0_

---

## Fase 1 - Layout Autenticado (Sidebar + Header) ✅

**Status:** Concluída em 22/07/2026

### Arquivos criados/modificados

| Arquivo | Ação | Descrição |
| --- | --- | --- |
| `app/assets/stylesheets/application.tailwind.css` | Modificado | Adicionadas cores do dashboard ao `@theme`: `--color-sidebar`, `--color-sidebar-hover`, `--color-sidebar-active`, `--color-header`, `--color-header-border` |
| `app/views/layouts/authenticated.html.erb` | Criado | Layout para usuários autenticados com estrutura flex (sidebar + header + conteúdo) |
| `app/views/shared/_sidebar.html.erb` | Criado | Partial da sidebar com menu de navegação, info do usuário e itens condicionais por autenticação |
| `app/views/shared/_header.html.erb` | Criado | Partial do header com campo de busca, avatar e menu dropdown do usuário |
| `app/helpers/navigation_helper.rb` | Criado | Helper `nav_link_class` para estilização do item ativo na sidebar |
| `app/javascript/controllers/sidebar_controller.js` | Criado | Stimulus controller para toggle da sidebar em mobile |
| `app/javascript/controllers/dropdown_controller.js` | Criado | Stimulus controller para menu dropdown do avatar no header |
| `app/javascript/controllers/index.js` | Modificado | Registrados os controllers `sidebar` e `dropdown` |
| `app/controllers/application_controller.rb` | Modificado | `set_layout` agora retorna `authenticated` para usuários logados |
| `app/controllers/dashboard_controller.rb` | Criado | Controller do dashboard com cálculo de estatísticas do autor |
| `app/controllers/explore_controller.rb` | Criado | Stub controller para rota `/explore` |
| `app/controllers/reading_controller.rb` | Criado | Stub controller para rota `/reading` |
| `app/controllers/categories_controller.rb` | Criado | Stub controller para rota `/categories` |
| `app/controllers/library_controller.rb` | Criado | Stub controller para rota `/library` (autenticado) |
| `app/controllers/downloads_controller.rb` | Criado | Stub controller para rota `/downloads` (autenticado) |
| `app/controllers/favorites_controller.rb` | Criado | Stub controller para rota `/favorites` (autenticado) |
| `app/controllers/settings_controller.rb` | Criado | Stub controller para rota `/settings` (autenticado) |
| `config/routes.rb` | Modificado | Adicionadas rotas para dashboard, explore, reading, categories, library, downloads, favorites, settings |
| `app/views/dashboard/index.html.erb` | Criado | View placeholder do dashboard |
| `app/views/explore/index.html.erb` | Criado | View placeholder |
| `app/views/reading/index.html.erb` | Criado | View placeholder |
| `app/views/categories/index.html.erb` | Criado | View placeholder |
| `app/views/library/index.html.erb` | Criado | View placeholder |
| `app/views/downloads/index.html.erb` | Criado | View placeholder |
| `app/views/favorites/index.html.erb` | Criado | View placeholder |
| `app/views/settings/index.html.erb` | Criado | View placeholder |
| `app/models/reading_progress.rb` | Criado | Model necessário para DashboardController |
| `app/models/rating.rb` | Criado | Model faltante (tabela existia no DB) |
| `app/models/favorite.rb` | Criado | Model faltante (tabela existia no DB) |
| `app/models/author_follow.rb` | Criado | Model faltante (tabela existia no DB) |
| `app/models/user_reading_preference.rb` | Criado | Model faltante (tabela existia no DB) |

### Funcionalidades implementadas

1. **Sidebar responsiva** (F-LAND-002):
   - Itens de menu conforme especificação (Explorar, Minha Sessão, Categorias, Dashboard, Biblioteca, Downloads, Favoritos, Configurações, Sair)
   - Ícones SVG inline para cada item
   - Indicador visual de rota ativa (cor `#C2A47E`)
   - Avatar e nome do usuário no topo quando autenticado
   - Itens autenticados ocultos para visitantes
   - Toggle mobile com drawer lateral

2. **Header** (F-LAND-003):
   - Logo "ContaAI" com tipografia serif
   - Campo de busca global com placeholder "Buscar livros..."
   - Avatar do usuário com menu dropdown (Configurações, Sair)
   - Menu hamburger mobile para toggle da sidebar

3. **Layout autenticado**:
   - Estrutura flex com sidebar fixa + área de conteúdo scrollável
   - Separação clara entre layout público (landing) e autenticado (dashboard)
   - ApplicationController seleciona layout baseado no estado de autenticação

4. **Models faltantes**:
   - Criados 5 models que tinham tabela no DB mas não tinham arquivo Ruby

### Pendências para próximas fases

- [x] Implementar conteúdo real do Dashboard (estatísticas F-DASH-001, F-DASH-002)
- [x] Implementar listagem de livros do autor (F-DASH-003)
- [x] Implementar ações rápidas - criar livro (F-DASH-004)
- [x] Implementar busca global com debounce
- [x] Estilizar views stub (explore, reading, categories, etc.)
- [x] Adicionar estado de colapso da sidebar em desktop

---

## Fase 2 - Implementação do Conteúdo do Dashboard ✅

**Status:** Concluída em 22/07/2026

### Arquivos criados/modificados

| Arquivo | Ação | Descrição |
| --- | --- | --- |
| `app/controllers/dashboard_controller.rb` | Modificado | Adicionadas estatísticas da plataforma (`@platform_stats`) |
| `app/views/dashboard/index.html.erb` | Modificado | Implementado conteúdo real com cards de métricas, estatísticas da plataforma e listagem de livros |
| `config/routes.rb` | Modificado | Adicionadas rotas para resources books com ações publish e read, e rota de busca |
| `app/controllers/books_controller.rb` | Criado | Controller completo para CRUD de livros com ações publish e read |
| `app/views/books/index.html.erb` | Criado | View de catálogo público de livros |
| `app/views/books/show.html.erb` | Criado | View de detalhes do livro |
| `app/views/books/new.html.erb` | Criado | View de criação de livro |
| `app/views/books/edit.html.erb` | Criado | View de edição de livro |
| `app/views/books/read.html.erb` | Criado | View de leitura do livro |
| `app/controllers/explore_controller.rb` | Modificado | Adicionada busca de livros em destaque e categorias |
| `app/views/explore/index.html.erb` | Modificado | Implementado catálogo com categorias e livros em destaque |
| `app/controllers/reading_controller.rb` | Modificado | Adicionada busca de leituras em andamento |
| `app/views/reading/index.html.erb` | Modificado | Implementado acompanhamento de leituras com barra de progresso |
| `app/controllers/categories_controller.rb` | Modificado | Adicionada busca de livros por categoria |
| `app/views/categories/index.html.erb` | Modificado | Implementado filtro por categorias com grid de livros |
| `app/controllers/library_controller.rb` | Modificado | Adicionada busca de livros do usuário |
| `app/views/library/index.html.erb` | Modificado | Implementado acervo pessoal com status dos livros |
| `app/controllers/favorites_controller.rb` | Modificado | Adicionada busca de livros favoritos |
| `app/views/favorites/index.html.erb` | Modificado | Implementado grid de livros favoritos |
| `app/views/downloads/index.html.erb` | Modificado | Mensagem informativa sobre downloads |
| `app/views/settings/index.html.erb` | Modificado | Implementado formulário de configurações básicas |
| `app/javascript/controllers/search_controller.js` | Criado | Stimulus controller para busca global com debounce |
| `app/javascript/controllers/index.js` | Modificado | Registrado controller `search` |
| `app/views/shared/_header.html.erb` | Modificado | Adicionado controller de busca ao campo de busca e botão de colapso da sidebar |
| `app/javascript/controllers/sidebar_controller.js` | Modificado | Adicionada funcionalidade de colapso em desktop com persistência no localStorage |
| `app/views/shared/_sidebar.html.erb` | Modificado | Atualizada transição para incluir largura |
| `app/controllers/search_controller.rb` | Criado | Controller para busca global de livros |
| `app/views/search/_results.html.erb` | Criado | Partial para resultados da busca |

### Funcionalidades implementadas

1. **Dashboard com estatísticas** (F-DASH-001, F-DASH-002):
   - Cards de métricas pessoais (total de livros, publicados, rascunhos, palavras, leituras, avaliação média)
   - Estatísticas da plataforma (autores, livros publicados, leitores)
   - Grid responsivo de 3 colunas (desktop) / 2 colunas (tablet) / 1 coluna (mobile)

2. **Listagem de livros do autor** (F-DASH-003):
   - Grid de livros com capa, título, autor, status e data de atualização
   - Ações: Editar, Publicar (para rascunhos), Excluir (com confirmação)
   - Diferenciação visual entre rascunhos e publicados
   - Botão "Criar Livro" no topo

3. **Ações rápidas** (F-DASH-004):
   - Botão "Criar Livro" no dashboard que redireciona para formulário de criação

4. **Busca global com debounce**:
   - Campo de busca no header com debounce de 300ms
   - Controller Stimulus para busca assíncrona
   - Endpoint de busca com ILIKE em título, autor e descrição
   - Partial de resultados com preview dos livros

5. **Estilização das views stub**:
   - Explore: Catálogo com categorias e livros em destaque
   - Reading: Acompanhamento de leituras com barra de progresso
   - Categories: Filtro por categorias com grid de livros
   - Library: Acervo pessoal com status dos livros
   - Favorites: Grid de livros favoritos
   - Downloads: Mensagem informativa
   - Settings: Formulário de configurações básicas

6. **Colapso da sidebar em desktop**:
   - Botão de colapso no header
   - Sidebar colapsa para 80px (w-20) escondendo texto
   - Persistência no localStorage
   - Transição suave

### Pendências para próximas fases

- [ ] Implementar modal de criação de livro (em vez de página separada)
- [ ] Adicionar paginação na listagem de livros
- [ ] Implementar filtros avançados na busca
- [ ] Adicionar notificações em tempo real
- [ ] Implementar sistema de comentários nos livros
- [ ] Adicionar gráficos de estatísticas no dashboard
