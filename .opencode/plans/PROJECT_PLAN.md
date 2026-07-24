# ContaAI - Especificação Funcional

## Sumário

1. [Descrição do Projeto](#1-descrição-do-projeto)
2. [Modelo de Domínio](#2-modelo-de-domínio)
3. [Funcionalidades do Sistema](#3-funcionalidades-do-sistema)
4. [Identidade Visual](#4-identidade-visual)
5. [Plano de Evolução](#5-plano-de-evolução)

---

## 1. Descrição do Projeto

O **ContaAI** é uma plataforma de escrita, publicação e leitura de livros, contos e histórias. A aplicação permite que usuários criem suas obras literárias, publiquem para outros leitores e consumam conteúdo de outros autores.

### 1.1 Perfis de Usuário

A plataforma suporta dois perfis principais que podem coexistir para um mesmo usuário:

| Perfil     | Descrição                                                |
| ---------- | -------------------------------------------------------- |
| **Leitor** | Consome conteúdo, segue autores, avalia e favorita obras |
| **Autor**  | Cria, edita e publica suas próprias obras literárias     |

A transição entre os perfis acontece automaticamente: um leitor torna-se autor ao publicar sua primeira obra.

### 1.2 Proposta de Valor

**Para Autores**:

- Ambiente simplificado para criação e publicação de obras
- Estatísticas de engajamento e contagem de palavras
- Acompanhamento de seguidores

**Para Leitores**:

- Descoberta de novas obras por categoria
- Possibilidade de seguir autores favoritos
- Avaliar e comentar obras
- Manter uma lista de favoritos

### 1.3 Modelo de Acesso

| Nível de Acesso             | Funcionalidades Disponíveis                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| Visitante (não autenticado) | Explorar catálogo de livros publicados, visualizar detalhes            |
| Usuário autenticado         | Criar livros, seguir autores, favoritar, avaliar, gerenciar biblioteca |
| Sessão anônima              | Interações limitadas com rastreamento por identificador de sessão      |

---

## 2. Modelo de Domínio

### 2.1 Entidades Principais

#### Usuário (User)

| Atributo        | Descrição                      | Obrigatório          |
| --------------- | ------------------------------ | -------------------- |
| Identificador   | Identificador único do usuário | Sim                  |
| Email           | Email para autenticação        | Sim                  |
| Nome            | Nome de exibição               | Não                  |
| Foto            | URL da imagem de perfil        | Não                  |
| Biografia       | Descrição pessoal              | Não                  |
| Papel           | Leitor ou Autor                | Sim (padrão: Leitor) |
| Data de criação | Quando a conta foi criada      | Sim                  |

#### Livro (Book)

| Atributo             | Descrição                         | Obrigatório            |
| -------------------- | --------------------------------- | ---------------------- |
| Identificador        | Identificador único do livro      | Sim                    |
| Título               | Nome da obra                      | Sim                    |
| Autor                | Nome do autor                     | Sim                    |
| Proprietário         | Usuário que criou o livro         | Sim                    |
| Capa (imagem)        | URL da imagem de capa             | Não                    |
| Cor da capa          | Cor de fundo quando não há imagem | Sim (padrão)           |
| Descrição            | Sinopse ou resumo                 | Não                    |
| Conteúdo             | Texto completo da obra            | Não                    |
| Categoria            | Classificação temática            | Sim                    |
| Status               | Rascunho ou Publicado             | Sim (padrão: Rascunho) |
| Contagem de palavras | Total de palavras escritas        | Sim (padrão: 0)        |
| Número de páginas    | Quantidade estimada de páginas    | Não                    |
| Avaliação média      | Média das notas recebidas         | Calculado              |
| Total de avaliações  | Quantidade de avaliações          | Calculado              |
| Data de criação      | Quando foi criado                 | Sim                    |
| Data de publicação   | Quando foi publicado              | Não                    |
| Data de atualização  | Última modificação                | Sim                    |

#### Categoria

| Valor     | Descrição         |
| --------- | ----------------- |
| Sci-Fi    | Ficção científica |
| Fantasy   | Fantasia          |
| Drama     | Drama             |
| Business  | Negócios          |
| Education | Educação          |
| Geography | Geografia         |

#### Avaliação (Rating)

| Atributo      | Descrição                    | Obrigatório |
| ------------- | ---------------------------- | ----------- |
| Identificador | Identificador único          | Sim         |
| Livro         | Referência ao livro avaliado | Sim         |
| Usuário       | Quem avaliou                 | Sim         |
| Nota          | Valor de 1 a 5 estrelas      | Sim         |
| Comentário    | Texto da avaliação           | Não         |
| Data          | Quando foi avaliado          | Sim         |

#### Favorito

| Atributo      | Descrição             | Obrigatório |
| ------------- | --------------------- | ----------- |
| Identificador | Identificador único   | Sim         |
| Usuário       | Quem favoritou        | Sim         |
| Livro         | Livro favoritado      | Sim         |
| Data          | Quando foi favoritado | Sim         |

#### Seguidor de Autor (AuthorFollow)

| Atributo      | Descrição               | Obrigatório |
| ------------- | ----------------------- | ----------- |
| Identificador | Identificador único     | Sim         |
| Seguidor      | Usuário que segue       | Sim         |
| Autor         | Nome do autor seguido   | Sim         |
| Data          | Quando começou a seguir | Sim         |

#### Progresso de Leitura

| Atributo          | Descrição                      | Obrigatório |
| ----------------- | ------------------------------ | ----------- |
| Identificador     | Identificador único            | Sim         |
| Usuário           | Leitor                         | Sim         |
| Livro             | Livro sendo lido               | Sim         |
| Posição atual     | Ponto onde parou               | Sim         |
| Percentual        | Progresso em porcentagem       | Sim         |
| Status            | Não iniciado, Lendo, Concluído | Sim         |
| Data de início    | Quando começou a ler           | Sim         |
| Data de conclusão | Quando terminou                | Não         |

### 2.2 Regras de Negócio do Domínio

**RN-001**: Um usuário começa como Leitor e torna-se Autor automaticamente ao publicar seu primeiro livro.

**RN-002**: Um Autor que exclui todos os seus livros publicados volta a ser Leitor.

**RN-003**: Um livro só aparece no catálogo público quando seu status é "Publicado".

**RN-004**: A avaliação média de um livro é recalculada a cada nova avaliação.

**RN-005**: Um usuário pode avaliar um livro apenas uma vez (atualização permitida).

**RN-006**: O progresso de leitura é mantido por livro e por usuário.

**RN-007**: Sessões anônimas possuem identificador único para permitir interações limitadas.

---

## 3. Funcionalidades do Sistema

### 3.1 Autenticação e Autorização

#### F-AUTH-001: Cadastro de Usuário

**Objetivo**: Permitir que novos usuários criem conta na plataforma.

**Fluxo Principal**:

1. Usuário acessa a tela de cadastro
2. Preenche nome, email, senha e confirmação de senha
3. Sistema valida os dados
4. Conta é criada com perfil de Leitor
5. Email de confirmação é enviado (opcional)
6. Usuário é redirecionado ou recebe mensagem de sucesso

**Regras de Negócio**:

- Nome é obrigatório
- Email deve ser válido e único no sistema
- Senha deve ter no mínimo 8 caracteres
- Confirmação de senha deve coincidir com a senha
- Perfil inicial é sempre "Leitor"

**Campos do Formulário**:

| Campo           | Tipo  | Obrigatório | Validação             |
| --------------- | ----- | ----------- | --------------------- |
| Nome completo   | Texto | Sim         | Não vazio             |
| Email           | Email | Sim         | Formato válido, único |
| Senha           | Senha | Sim         | Mínimo 8 caracteres   |
| Confirmar senha | Senha | Sim         | Igual à senha         |

---

#### F-AUTH-002: Login

**Objetivo**: Permitir acesso à plataforma com credenciais.

**Fluxo Principal**:

1. Usuário acessa a tela de login
2. Preenche email e senha
3. Sistema valida credenciais
4. Perfil do usuário é carregado
5. Usuário é redirecionado para o Dashboard

**Regras de Negócio**:

- Usuários já autenticados são redirecionados automaticamente para o Dashboard
- Após 3 tentativas falhas, considerar bloqueio temporário
- Manter sessão ativa conforme configuração

**Campos do Formulário**:

| Campo | Tipo  | Obrigatório |
| ----- | ----- | ----------- |
| Email | Email | Sim         |
| Senha | Senha | Sim         |

---

#### F-AUTH-003: Recuperação de Senha

**Objetivo**: Permitir que usuários recuperem acesso à conta.

**Fluxo Principal**:

1. Usuário acessa "Esqueci minha senha"
2. Informa email cadastrado
3. Sistema envia link de redefinição por email
4. Usuário acessa o link
5. Define nova senha
6. Sistema confirma alteração

**Regras de Negócio**:

- Link de recuperação deve expirar (sugestão: 24 horas)
- Email deve existir no sistema para envio
- Nova senha deve seguir mesmas regras de cadastro

---

#### F-AUTH-004: Logout

**Objetivo**: Encerrar sessão do usuário.

**Fluxo Principal**:

1. Usuário clica em "Sair"
2. Sessão é encerrada
3. Usuário é redirecionado para a página inicial

---

### 3.2 Dashboard do Autor

#### F-DASH-001: Visualização de Estatísticas Pessoais

**Objetivo**: Apresentar métricas da atividade do autor.

**Métricas Exibidas**:

| Métrica           | Descrição                                      |
| ----------------- | ---------------------------------------------- |
| Total de livros   | Quantidade de livros criados                   |
| Livros publicados | Quantidade com status "Publicado"              |
| Rascunhos         | Quantidade com status "Rascunho"               |
| Total de palavras | Soma de palavras de todas as obras             |
| Total de leituras | Quantidade de vezes que suas obras foram lidas |
| Avaliação média   | Média das avaliações recebidas                 |

**Regras de Negócio**:

- Estatísticas são calculadas apenas para livros do usuário logado
- Valores zerados são exibidos normalmente

---

#### F-DASH-002: Visualização de Estatísticas da Plataforma

**Objetivo**: Apresentar métricas gerais da plataforma.

**Métricas Exibidas**:

| Métrica           | Descrição                                     |
| ----------------- | --------------------------------------------- |
| Total de autores  | Quantidade de usuários com livros publicados  |
| Total de livros   | Quantidade de livros publicados na plataforma |
| Total de leitores | Quantidade de usuários ativos                 |

---

#### F-DASH-003: Listagem de Livros do Autor

**Objetivo**: Exibir todos os livros criados pelo usuário.

**Informações por Livro**:

- Título
- Nome do autor
- Capa (imagem ou cor)
- Status (Rascunho/Publicado)
- Data de atualização

**Regras de Negócio**:

- Ordenação por data de atualização (mais recente primeiro)
- Diferenciação visual entre rascunhos e publicados
- Permitir ações: editar, excluir, publicar

---

#### F-DASH-004: Ações Rápidas

**Objetivo**: Fornecer atalhos para ações frequentes.

**Ações Disponíveis**:

- Criar novo livro

---

### 3.3 Criação e Edição de Livros

#### F-BOOK-001: Criar Novo Livro

**Objetivo**: Permitir que autores iniciem uma nova obra.

**Fluxo Principal**:

1. Usuário clica em "Criar Livro"
2. Modal/formulário abre com campos
3. Preenche informações básicas
4. Opcionalmente faz upload de capa
5. Clica em "Criar"
6. Livro é criado em status "Rascunho"
7. Usuário é direcionado para o editor (opcional)

**Campos do Formulário**:

| Campo         | Tipo           | Obrigatório | Padrão          |
| ------------- | -------------- | ----------- | --------------- |
| Título        | Texto          | Sim         | -               |
| Autor         | Texto          | Sim         | Nome do usuário |
| Categoria     | Seleção        | Sim         | -               |
| Capa (imagem) | Upload         | Não         | -               |
| Cor da capa   | Seleção de cor | Não         | #8B4513         |

**Regras de Negócio**:

- Se não houver capa, exibir card com cor de fundo
- Se nenhuma cor for escolhida, usar cor padrão ou gerar aleatoriamente
- Status inicial é sempre "Rascunho"
- Contagem de palavras inicia em 0

**Cores Disponíveis**:
Paleta de 16 cores predefinidas incluindo tons de marrom, verde, azul, roxo, vermelho e dourado.

---

#### F-BOOK-002: Editor de Escrita

**Objetivo**: Permitir a escrita completa da obra.

**Funcionalidades do Editor**:

- Formatação básica de texto (negrito, itálico, sublinhado)
- Títulos e subtítulos
- Listas (ordenadas e não ordenadas)
- Citações
- Separadores de seção
- Sistema de capítulos

**Recursos Adicionais**:

- Salvamento automático (sugestão: a cada 30 segundos)
- Contagem de palavras em tempo real
- Contagem de caracteres
- Indicador de salvamento

**Regras de Negócio**:

- Apenas o proprietário pode editar
- Conteúdo deve ser salvo mesmo ao fechar sem confirmar
- Preservar formatação ao salvar e recarregar

---

#### F-BOOK-003: Upload de Capa

**Objetivo**: Permitir personalização visual do livro.

**Fluxo Principal**:

1. Usuário seleciona arquivo de imagem
2. Preview é exibido imediatamente
3. Usuário pode remover ou trocar
4. Ao salvar, imagem é armazenada

**Regras de Negócio**:

- Formatos aceitos: JPG, PNG, WebP
- Tamanho máximo sugerido: 5MB
- Dimensões recomendadas: 600x900px (proporção 2:3)

---

#### F-BOOK-004: Publicar Livro

**Objetivo**: Tornar o livro disponível publicamente.

**Fluxo Principal**:

1. Usuário clica em "Publicar"
2. Sistema valida campos obrigatórios
3. Modal de confirmação com preview
4. Usuário confirma publicação
5. Status muda para "Publicado"
6. Livro aparece no catálogo público
7. Link público é gerado para compartilhamento

**Regras de Negócio**:

- Título é obrigatório para publicar
- Conteúdo não pode estar vazio
- Categoria deve estar definida
- Ação pode ser revertida (despublicar)
- Usuário torna-se Autor se for primeira publicação

---

#### F-BOOK-005: Excluir Livro

**Objetivo**: Remover livro permanentemente.

**Fluxo Principal**:

1. Usuário clica em "Excluir"
2. Modal de confirmação aparece
3. Usuário confirma
4. Livro é removido

**Regras de Negócio**:

- Ação irreversível
- Apenas o proprietário pode excluir
- Avaliações e favoritos associados são removidos
- Se for último livro publicado, autor volta a ser leitor

---

### 3.4 Descoberta de Livros

#### F-DISC-001: Explorar Catálogo

**Objetivo**: Permitir navegação por todos os livros publicados.

**Fluxo Principal**:

1. Usuário acessa a área de exploração
2. Sistema carrega lista paginada de livros
3. Exibe grade de cards com informações resumidas
4. Scroll infinito carrega mais livros

**Informações por Card**:

- Título
- Autor
- Capa (imagem ou cor)
- Avaliação média
- Categoria (opcional)

**Regras de Negócio**:

- Apenas livros publicados são exibidos
- Ordenação padrão: mais recentes primeiro
- Paginação: 20 livros por carregamento
- Cache de resultados para performance (sugestão: 5 minutos)

---

#### F-DISC-002: Filtrar por Categoria

**Objetivo**: Refinar busca por tipo de conteúdo.

**Fluxo Principal**:

1. Usuário visualiza opções de categoria
2. Seleciona uma categoria
3. Lista é filtrada automaticamente

**Categorias Disponíveis**:

- Todas (remove filtro)
- Sci-Fi
- Fantasy
- Drama
- Business
- Education
- Geography

**Regras de Negócio**:

- Filtro é combinável com busca por texto
- URL deve refletir filtro aplicado (permitir compartilhamento)

---

#### F-DISC-003: Buscar por Título

**Objetivo**: Encontrar livros específicos.

**Fluxo Principal**:

1. Usuário digita no campo de busca
2. Sistema aguarda breve pausa na digitação (debounce)
3. Lista é filtrada por título
4. Resultados são exibidos

**Regras de Negócio**:

- Busca por substring (contém)
- Case insensitive
- Combinável com filtro de categoria
- Debounce de ~300ms para evitar requisições excessivas

---

#### F-DISC-004: Visualizar Detalhes do Livro

**Objetivo**: Exibir informações completas de um livro.

**Fluxo Principal**:

1. Usuário clica em um card
2. Painel/modal abre com detalhes
3. Exibe informações completas e ações disponíveis

**Informações Exibidas**:

- Título
- Autor
- Capa
- Categoria
- Descrição/Sinopse
- Avaliação média e total de avaliações
- Data de publicação
- Número de páginas (se disponível)

**Ações Disponíveis**:

- Ler livro
- Favoritar/Desfavoritar
- Seguir/Deixar de seguir autor
- Avaliar (1-5 estrelas)

**Regras de Negócio**:

- Layout adaptável: modal em mobile, painel lateral em desktop
- Ações que requerem autenticação devem solicitar login

---

#### F-DISC-005: Página de Categorias

**Objetivo**: Navegar visualmente pelas categorias.

**Fluxo Principal**:

1. Usuário acessa página de categorias
2. Exibe grade de cards por categoria
3. Cada card mostra nome, ícone e quantidade de livros
4. Clique direciona para exploração filtrada

**Informações por Card**:

- Nome da categoria
- Ícone representativo
- Quantidade de livros publicados

---

### 3.5 Leitura de Livros

#### F-READ-001: Tela de Leitura

**Objetivo**: Permitir consumo do conteúdo.

**Elementos da Tela**:

- Nome do livro
- Nome do autor
- Quantidade de páginas
- Data de publicação/atualização
- Lista de capítulos (navegação)
- Indicador de progresso de leitura
- Conteúdo formatado

**Regras de Negócio**:

- Aplicar preferências de leitura do usuário
- Manter posição de leitura ao sair
- Permitir navegação por capítulos
- Exibir progresso em porcentagem

---

#### F-READ-002: Navegação por Capítulos

**Objetivo**: Facilitar acesso a seções específicas.

**Fluxo Principal**:

1. Usuário visualiza lista de capítulos
2. Clica em um capítulo
3. Conteúdo rola até o capítulo selecionado

**Regras de Negócio**:

- Capítulos são detectados automaticamente por formatação (títulos)
- Lista pode ser expandida/recolhida

---

#### F-READ-003: Progresso de Leitura

**Objetivo**: Acompanhar e retomar leitura.

**Funcionalidades**:

- Barra de progresso visual
- Porcentagem de conclusão
- Salvamento automático da posição
- Retomar de onde parou

**Regras de Negócio**:

- Posição é salva automaticamente ao navegar
- Progresso é por usuário e por livro
- Ao concluir 100%, marcar como "Concluído"

---

#### F-READ-004: Preferências de Leitura

**Objetivo**: Personalizar experiência de leitura.

**Configurações Disponíveis**:

| Preferência      | Opções                 | Padrão     |
| ---------------- | ---------------------- | ---------- |
| Tamanho da fonte | 14px, 16px, 18px, 20px | 14px       |
| Modo noturno     | Ativado/Desativado     | Desativado |

**Regras de Negócio**:

- Alterações são aplicadas em tempo real
- Preview deve mostrar como ficará a leitura
- Preferências são salvas por usuário

---

### 3.6 Biblioteca do Leitor

#### F-LIB-001: Minha Biblioteca

**Objetivo**: Organizar acervo pessoal de leitura.

**Seções**:

| Seção      | Descrição                              |
| ---------- | -------------------------------------- |
| Lendo      | Livros com leitura em andamento        |
| Concluídos | Livros com leitura finalizada          |
| Para Ler   | Livros favoritados ainda não iniciados |

**Ações por Livro**:

- Continuar lendo
- Marcar como lido
- Remover da biblioteca

**Regras de Negócio**:

- Livro entra automaticamente em "Lendo" ao iniciar leitura
- Livro move para "Concluídos" ao atingir 100%
- Favoritos sem progresso aparecem em "Para Ler"

---

#### F-LIB-002: Favoritos

**Objetivo**: Manter lista de livros de interesse.

**Fluxo de Favoritar**:

1. Usuário clica no botão de favoritar (coração)
2. Livro é adicionado à lista
3. Botão muda de estado visual
4. Clique novamente remove dos favoritos

**Regras de Negócio**:

- Requer autenticação
- Um livro só pode ser favoritado uma vez por usuário
- Favoritos são listados em página dedicada
- Estado do favorito deve ser visível em cards de livros

---

### 3.7 Interação Social

#### F-SOC-001: Seguir Autor

**Objetivo**: Acompanhar obras de autores favoritos.

**Fluxo Principal**:

1. Usuário visualiza livro de um autor
2. Clica em "Seguir Autor"
3. Relação é registrada
4. Botão muda para "Seguindo"
5. Clique novamente remove o follow

**Regras de Negócio**:

- Requer autenticação
- Follow é por autor (não por livro específico)
- Possibilidade futura: filtrar descoberta por autores seguidos

---

#### F-SOC-002: Avaliar Livro

**Objetivo**: Permitir feedback dos leitores.

**Fluxo Principal**:

1. Usuário acessa detalhes do livro
2. Seleciona nota (1 a 5 estrelas)
3. Opcionalmente escreve comentário
4. Envia avaliação
5. Média do livro é recalculada

**Regras de Negócio**:

- Requer autenticação
- Uma avaliação por usuário por livro
- Pode atualizar avaliação existente
- Comentário é opcional
- Média é atualizada em tempo real

---

#### F-SOC-003: Listagem de Avaliações

**Objetivo**: Exibir feedback de outros leitores.

**Informações por Avaliação**:

- Nome do avaliador
- Nota (estrelas)
- Comentário (se houver)
- Data da avaliação

**Regras de Negócio**:

- Ordenação por data (mais recentes primeiro)
- Paginação se houver muitas avaliações

---

### 3.8 Downloads e Exportação

#### F-DOWN-001: Exportar Livro

**Objetivo**: Permitir leitura offline e backup.

**Formatos Suportados**:

- PDF
- DOCX (opcional)

**Fluxo Principal**:

1. Usuário acessa detalhes do livro
2. Clica em "Baixar"
3. Seleciona formato desejado
4. Sistema gera arquivo
5. Download inicia

**Regras de Negócio**:

- Disponível para livros publicados
- Autores podem exportar próprios rascunhos
- Manter formatação e estrutura de capítulos
- Incluir capa no documento

---

#### F-DOWN-002: Histórico de Downloads

**Objetivo**: Acessar arquivos baixados anteriormente.

**Informações Exibidas**:

- Título do livro
- Formato baixado
- Data do download
- Link para baixar novamente

---

### 3.9 Configurações do Usuário

#### F-CONF-001: Edição de Perfil

**Objetivo**: Personalizar informações públicas.

**Campos Editáveis**:

| Campo          | Tipo             | Obrigatório        |
| -------------- | ---------------- | ------------------ |
| Nome           | Texto            | Não                |
| Foto de perfil | Upload de imagem | Não                |
| Biografia      | Texto longo      | Não                |
| Email          | Email            | Sim (não editável) |

**Regras de Negócio**:

- Foto aceita JPG, PNG, WebP
- Tamanho máximo da foto: 2MB
- Biografia tem limite de caracteres (sugestão: 500)

---

#### F-CONF-002: Alteração de Senha

**Objetivo**: Permitir atualização de credenciais.

**Fluxo Principal**:

1. Usuário acessa configurações de segurança
2. Informa senha atual
3. Informa nova senha e confirmação
4. Sistema valida e atualiza

**Regras de Negócio**:

- Senha atual deve estar correta
- Nova senha segue mesmas regras de cadastro
- Confirmar nova senha deve coincidir

---

#### F-CONF-003: Exclusão de Conta

**Objetivo**: Permitir remoção permanente de dados.

**Fluxo Principal**:

1. Usuário acessa configurações
2. Clica em "Excluir conta"
3. Modal de confirmação solicita senha
4. Usuário confirma
5. Conta e todos os dados são removidos

**Regras de Negócio**:

- Ação irreversível
- Todos os livros do usuário são excluídos
- Avaliações e comentários são removidos
- Logout automático após exclusão

---

### 3.10 Landing Page e Navegação

#### F-LAND-001: Página Inicial Pública

**Objetivo**: Apresentar a plataforma para visitantes.

**Seções**:

1. **Hero**: Título, descrição e call-to-action
2. **Vitrine de Livros**: Destaques do catálogo
3. **Comunidade**: Informações sobre interação entre usuários
4. **Contribua**: Convite para se cadastrar
5. **Rodapé**: Links e informações legais

**Regras de Negócio**:

- Usuários autenticados são redirecionados para Dashboard
- Vitrine carrega livros mais populares/recentes

---

#### F-LAND-002: Navegação Global

**Objetivo**: Facilitar acesso às principais áreas.

**Áreas de Navegação (Sidebar)**:

| Item             | Descrição               | Requer Auth |
| ---------------- | ----------------------- | ----------- |
| Discover         | Dashboard principal     | Sim         |
| Explorar         | Catálogo de livros      | Não         |
| Minha Sessão     | Leitura em andamento    | Não         |
| Categorias       | Navegação por categoria | Não         |
| Minha Biblioteca | Acervo pessoal          | Sim         |
| Downloads        | Arquivos baixados       | Sim         |
| Favoritos        | Livros marcados         | Sim         |
| Configurações    | Preferências            | Sim         |
| Sair             | Encerrar sessão         | Sim         |

---

#### F-LAND-003: Cabeçalho (Header)

**Objetivo**: Navegação e acesso rápido.

**Elementos**:

- Logo/Nome da aplicação
- Campo de busca global (placeholder: "Buscar livros...")
- Avatar do usuário
- Menu dropdown: Configurações, Sair

---

## 4. Identidade Visual

### 4.1 Paleta de Cores

| Elemento                | Cor           | Código    |
| ----------------------- | ------------- | --------- |
| Cor de destaque / Hover | Dourado       | `#C2A47E` |
| Sidebar                 | Marrom        | `#8B7355` |
| Fundo principal         | Bege claro    | `#F5E6D3` |
| Fundo secundário        | Bege          | `#F5F0EB` |
| Texto principal         | Marrom escuro | `#2F241C` |
| Texto secundário        | Cinza         | `#6B7280` |

### 4.2 Tipografia

| Uso                 | Família                               | Pesos              |
| ------------------- | ------------------------------------- | ------------------ |
| Corpo de texto      | Sans-serif (Inter ou similar)         | 400, 500, 600, 700 |
| Títulos decorativos | Serif (Playfair Display ou similar)   | 600, 700           |
| Leitura de livros   | Serif (Cormorant Garamond ou similar) | 400, 600, 700      |

---

## 5. Plano de Evolução

### Fase 1: Core de Criação

**Objetivo**: Completar o ciclo de criação e publicação de livros.

| Funcionalidade        | Referência |
| --------------------- | ---------- |
| Editor de escrita     | F-BOOK-002 |
| Salvamento automático | F-BOOK-002 |
| Contagem de palavras  | F-BOOK-002 |
| Publicação de livros  | F-BOOK-004 |

**Critérios de Conclusão**:

- [ ] Autor consegue escrever conteúdo no editor
- [ ] Conteúdo é salvo automaticamente
- [ ] Autor consegue publicar livro
- [ ] Livro publicado aparece no catálogo

---

### Fase 2: Core de Leitura

**Objetivo**: Permitir consumo de conteúdo pelos leitores.

| Funcionalidade          | Referência |
| ----------------------- | ---------- |
| Tela de leitura         | F-READ-001 |
| Navegação por capítulos | F-READ-002 |
| Progresso de leitura    | F-READ-003 |
| Preferências de leitura | F-READ-004 |

**Critérios de Conclusão**:

- [ ] Leitor consegue acessar livro publicado
- [ ] Conteúdo é exibido formatado
- [ ] Progresso é salvo automaticamente
- [ ] Leitura retoma de onde parou

---

### Fase 3: Biblioteca e Favoritos

**Objetivo**: Organização pessoal de acervo.

| Funcionalidade       | Referência |
| -------------------- | ---------- |
| Minha Biblioteca     | F-LIB-001  |
| Sistema de favoritos | F-LIB-002  |

**Critérios de Conclusão**:

- [ ] Usuário consegue favoritar livros
- [ ] Página de favoritos lista corretamente
- [ ] Biblioteca organiza por status de leitura
- [ ] Estado sincronizado entre páginas

---

### Fase 4: Configurações e Perfil

**Objetivo**: Personalização da experiência.

| Funcionalidade     | Referência |
| ------------------ | ---------- |
| Edição de perfil   | F-CONF-001 |
| Alteração de senha | F-CONF-002 |
| Exclusão de conta  | F-CONF-003 |

**Critérios de Conclusão**:

- [ ] Usuário consegue editar perfil
- [ ] Avatar é atualizado
- [ ] Preferências afetam leitura
- [ ] Senha pode ser alterada

---

### Fase 5: Avaliações e Engajamento

**Objetivo**: Feedback entre usuários.

| Funcionalidade         | Referência |
| ---------------------- | ---------- |
| Avaliar livro          | F-SOC-002  |
| Listagem de avaliações | F-SOC-003  |
| Seguir autores         | F-SOC-001  |

**Critérios de Conclusão**:

- [ ] Leitor consegue avaliar livro
- [ ] Média é calculada corretamente
- [ ] Reviews são exibidos

---

### Fase 6: Categorias e Busca Avançada

**Objetivo**: Melhorar descoberta de conteúdo.

| Funcionalidade         | Referência |
| ---------------------- | ---------- |
| Página de categorias   | F-DISC-005 |
| Busca global no header | F-LAND-003 |

**Critérios de Conclusão**:

- [ ] Página de categorias exibe grid
- [ ] Contagem por categoria correta
- [ ] Busca funciona de qualquer página

---

### Fase 7: Downloads e Exportação

**Objetivo**: Consumo offline e exportação.

| Funcionalidade         | Referência |
| ---------------------- | ---------- |
| Exportar para PDF      | F-DOWN-001 |
| Histórico de downloads | F-DOWN-002 |

**Critérios de Conclusão**:

- [ ] Livro pode ser baixado em PDF
- [ ] Downloads são listados
- [ ] Formato preserva estrutura

---

### Fase 8: Refinamentos de UX

**Objetivo**: Polimento da experiência.

| Funcionalidade           | Referência |
| ------------------------ | ---------- |
| Menu dropdown do usuário | F-LAND-003 |
| Modo noturno global      | F-READ-004 |
| Responsividade           | Geral      |

**Critérios de Conclusão**:

- [ ] Navegação fluida em todas as páginas
- [ ] Feedback visual consistente
- [ ] Funciona bem em dispositivos móveis

---

### Resumo do Roadmap

| Fase                      | Prioridade | Dependências     |
| ------------------------- | ---------- | ---------------- |
| 1. Core de Criação        | Crítica    | -                |
| 2. Core de Leitura        | Crítica    | Fase 1           |
| 3. Biblioteca e Favoritos | Alta       | Fase 2           |
| 4. Configurações e Perfil | Média      | -                |
| 5. Avaliações             | Média      | Fase 2           |
| 6. Categorias e Busca     | Baixa      | -                |
| 7. Downloads              | Média      | Fase 2           |
| 8. Refinamentos UX        | Baixa      | Fases anteriores |

---

_Documento atualizado em: 21/07/2026_
_Versão: 2.0_
