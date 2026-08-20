# Contexto

Analise a codebase completa da aplicação **Ruby on Rails Fullstack**, com foco na funcionalidade de leitura de livros e capítulos.

A aplicação atualmente possui uma tela de leitura semelhante à referência visual fornecida, onde o usuário visualiza:

- Sidebar principal da aplicação;
- Header superior;
- Botão para voltar aos detalhes do livro;
- Título do livro;
- Nome do autor;
- Número/título do capítulo;
- Conteúdo do capítulo.

Atualmente, a experiência de leitura é muito simples e não oferece uma navegação clara entre os capítulos, progresso de leitura ou mecanismos para o usuário continuar de onde parou.

O objetivo é criar um **plano de ação técnico e funcional detalhado**, sem implementar as alterações inicialmente.

---

# Objetivo principal

Propor uma melhoria completa na experiência de leitura dos livros, permitindo que o usuário:

1. Visualize todos os capítulos disponíveis no livro;
2. Navegue livremente entre os capítulos permitidos/disponíveis;
3. Saiba qual capítulo está lendo atualmente;
4. Saiba quais capítulos já foram lidos;
5. Continue a leitura a partir do último capítulo acessado;
6. Avance facilmente para o próximo capítulo;
7. Retorne ao capítulo anterior;
8. Visualize seu progresso geral no livro;
9. Tenha uma experiência de leitura agradável tanto em desktop quanto em dispositivos mobile;
10. Mantenha compatibilidade com a arquitetura e padrões já existentes na aplicação Rails.

---

# Análise obrigatória da codebase

Antes de sugerir qualquer alteração, faça uma análise completa da implementação atual relacionada à leitura de livros.

Mapeie e documente:

## Backend

- Models relacionados a:
  - Books/Livros;
  - Chapters/Capítulos;
  - Users/Usuários;
  - Bibliotecas;
  - Favoritos;
  - Downloads;
  - Sessões de leitura;
  - Qualquer estrutura existente relacionada ao progresso de leitura.

- Associations entre models;

- Migrations existentes;

- Controllers responsáveis por:
  - Exibição dos livros;
  - Exibição dos capítulos;
  - Leitura;
  - Biblioteca do usuário;
  - APIs ou endpoints relacionados.

- Services, Jobs ou Concerns relacionados;

- Policies/autorização, caso existam;

- Rotas utilizadas para leitura de livros e capítulos;

- Queries existentes e possíveis problemas de N+1 queries;

- Estratégia atual de ordenação dos capítulos;

- Como a aplicação identifica o capítulo atual;

- Se existe alguma estrutura para persistir o progresso do usuário.

## Frontend

Analise todos os componentes, views, partials, layouts, JavaScript/Stimulus controllers e estilos envolvidos na experiência de leitura.

Mapeie:

- Página atual de leitura;
- Componentes responsáveis pela renderização do conteúdo;
- Sidebar principal;
- Header;
- Navegação mobile;
- Botão de retorno aos detalhes;
- Sistema atual de design;
- CSS/Tailwind/Bootstrap ou outra solução utilizada;
- Componentes reutilizáveis que podem ser aproveitados;
- Responsividade atual;
- Recursos de acessibilidade existentes.

Não faça suposições. Baseie o plano na estrutura real encontrada na codebase.

---

# Nova experiência de leitura desejada

A proposta deve transformar a página em uma experiência semelhante a um leitor digital de livros, mas sem complexidade excessiva.

## 1. Navegação entre capítulos

Criar uma navegação clara entre capítulos.

A experiência deve permitir:

- Botão **Capítulo anterior**, quando existir um capítulo anterior;
- Botão **Próximo capítulo**, quando existir um próximo capítulo;
- Desabilitar ou ocultar adequadamente os botões quando o usuário estiver no primeiro ou último capítulo;
- Navegação preservando a ordem correta dos capítulos;
- Carregamento do capítulo selecionado de forma consistente com a arquitetura atual;
- Atualização correta da URL, quando aplicável.

Avalie também a possibilidade de atalhos de teclado, desde que façam sentido e não prejudiquem a experiência em inputs ou áreas de texto.

Exemplo:

```text
← Capítulo anterior                     Próximo capítulo →
```

---

# 2. Índice ou painel de capítulos

Propor um mecanismo para o usuário visualizar os capítulos do livro.

A solução deve considerar uma interface como:

```text
Livro de Teste Mobile

Progresso da leitura: 35%

────────────────────────

CAPÍTULOS

✓ Capítulo 1
● Capítulo 2 — Atual
  Capítulo 3
  Capítulo 4
  Capítulo 5
```

O painel deve permitir:

- Listar os capítulos em ordem;
- Destacar visualmente o capítulo atual;
- Identificar capítulos já lidos;
- Permitir clicar em um capítulo disponível;
- Possuir scroll caso existam muitos capítulos;
- Exibir título e/ou número do capítulo;
- Ser acessível por teclado;
- Ter semântica adequada para leitores de tela.

Analise qual solução se encaixa melhor na arquitetura atual:

### Desktop

Avaliar opções como:

- Painel lateral secundário;
- Drawer;
- Painel expansível;
- Índice fixo ou sticky;
- Modal/popover para lista de capítulos.

### Mobile

Priorizar uma solução que não comprometa a área de leitura.

Avaliar:

- Drawer lateral;
- Bottom sheet;
- Modal de capítulos;
- Botão "Índice" ou "Capítulos" no topo da página.

A solução deve ser **mobile-first**.

---

# 3. Progresso de leitura

Propor um sistema de progresso persistente por usuário.

Avaliar a melhor modelagem para armazenar informações como:

- Usuário;
- Livro;
- Último capítulo acessado;
- Último capítulo concluído;
- Data/hora do último acesso;
- Percentual de progresso;
- Lista ou estado dos capítulos concluídos, se necessário.

Não criar estruturas desnecessariamente complexas.

Analise se a melhor abordagem seria, por exemplo:

- Uma tabela de progresso por `user + book`;
- Uma tabela de progresso por `user + chapter`;
- Uma combinação das duas;
- Ou aproveitar alguma estrutura existente.

Explique claramente:

- Vantagens;
- Desvantagens;
- Impacto no banco;
- Escalabilidade;
- Índices necessários;
- Constraints recomendadas.

---

# 4. Definição de "capítulo lido"

Defina uma estratégia clara para identificar quando um capítulo pode ser considerado lido.

Avalie alternativas como:

### Opção A — Ao abrir o capítulo

O capítulo é marcado como lido assim que o usuário o acessa.

### Opção B — Ao chegar ao final

O capítulo é marcado como concluído quando o usuário chega próximo ao final do conteúdo.

### Opção C — Progresso mínimo

O capítulo é considerado lido após o usuário atingir determinado percentual da leitura.

### Opção D — Ação manual

O usuário pode marcar explicitamente como concluído.

Compare as alternativas e recomende a melhor opção para esta aplicação, priorizando:

- Boa experiência do usuário;
- Simplicidade de implementação;
- Confiabilidade;
- Baixo impacto de performance.

Se recomendar detecção de scroll, explique como evitar:

- Atualizações excessivas no banco;
- Problemas de performance;
- Múltiplas requisições desnecessárias.

Considere técnicas como debounce/throttle ou persistência apenas em eventos relevantes.

---

# 5. Continuar de onde parou

Adicionar uma experiência clara para retorno à leitura.

Ao acessar um livro que já possui progresso, o sistema deve avaliar a possibilidade de oferecer:

```text
Continuar lendo

Você parou no Capítulo 4

[ Continuar leitura ]
```

Ou redirecionar diretamente para o último capítulo lido, caso essa seja a melhor experiência de acordo com o fluxo existente.

O plano deve definir:

- Onde essa informação será exibida;
- Como recuperar o último capítulo;
- Como lidar com capítulos removidos;
- Como lidar com mudanças na ordem dos capítulos;
- Como lidar com livros que ainda não possuem progresso;
- Como evitar problemas caso o progresso salvo seja inválido.

---

# 6. Indicador visual de progresso

Propor um indicador de progresso na leitura.

Exemplos possíveis:

```text
35% concluído
████████░░░░░░░░░░░░
```

ou:

```text
Capítulo 3 de 10
```

Avalie a possibilidade de combinar:

- Capítulo atual / total de capítulos;
- Percentual de capítulos concluídos;
- Barra visual de progresso;
- Texto de progresso acessível.

A solução deve deixar claro que:

- O usuário está no capítulo X;
- Existem Y capítulos;
- O usuário já avançou determinado percentual.

---

# 7. Layout da página de leitura

Com base na interface atual, proponha uma evolução visual sem descaracterizar o sistema.

A estrutura pode ser analisada a partir de algo semelhante a:

```text
┌───────────────────────────────────────────────────────────────┐
│ Header                                                        │
├──────────────┬────────────────────────────────────────────────┤
│              │ ← Voltar para detalhes                         │
│ Sidebar      │                                                │
│ principal    │ Livro de Teste Mobile                          │
│              │ por Admin                                      │
│              │                                                │
│              │ [ Índice ]              Capítulo 3 de 10       │
│              │ ████████████░░░░░░░░░░                        │
│              │                                                │
│              │ Capítulo 3                                     │
│              │                                                │
│              │ Título do Capítulo                             │
│              │                                                │
│              │ Conteúdo da leitura...                         │
│              │                                                │
│              │                                                │
│              │ ┌──────────────┐ ┌────────────────┐             │
│              │ │ ← Anterior  │ │ Próximo →      │             │
│              │ └──────────────┘ └────────────────┘             │
└──────────────┴────────────────────────────────────────────────┘
```

A análise deve considerar:

- Melhor largura para leitura;
- Limite de largura do conteúdo;
- Tipografia confortável;
- Espaçamento entre linhas;
- Hierarquia entre livro, capítulo e conteúdo;
- Área de leitura centralizada;
- Navegação inferior;
- Navegação superior;
- Comportamento com capítulos muito longos;
- Desktop;
- Tablet;
- Mobile.

Priorize legibilidade e conforto para leituras prolongadas.

---

# 8. Experiência mobile

A implementação mobile deve receber atenção especial.

Atualmente a aplicação possui sidebar, portanto analise como a página de leitura deve se comportar em telas menores.

Defina:

- Como acessar o índice de capítulos;
- Como evitar excesso de elementos na tela;
- Como manter os botões anterior/próximo acessíveis;
- Se a navegação inferior deve ser sticky;
- Como evitar que elementos fixos cubram o conteúdo;
- Como garantir áreas de toque adequadas;
- Como tratar capítulos extensos;
- Como o progresso será exibido sem ocupar muito espaço.

Priorizar:

- Mobile-first;
- Boa usabilidade com uma mão;
- Layout sem overflow horizontal;
- Navegação intuitiva;
- Acessibilidade.

---

# 9. Regras de disponibilidade dos capítulos

Analise se existe atualmente alguma regra que define quais capítulos o usuário pode acessar.

Caso não exista, estruturar o plano de forma que futuramente seja possível suportar funcionalidades como:

- Capítulos públicos;
- Capítulos privados;
- Capítulos liberados progressivamente;
- Conteúdo exclusivo;
- Livro parcialmente disponível;
- Capítulos bloqueados.

Não implementar essas funcionalidades agora, a menos que já existam na codebase.

Apenas garantir que a arquitetura proposta não impeça essa evolução futura.

---

# 10. Performance

O plano deve considerar livros com:

- Poucos capítulos;
- Dezenas de capítulos;
- Centenas de capítulos;
- Capítulos com conteúdos extensos.

Avaliar:

- Queries para carregar capítulos;
- Paginação ou carregamento sob demanda, se necessário;
- Preload/eager loading;
- Índices de banco;
- Evitar N+1 queries;
- Evitar carregar conteúdo completo de todos os capítulos simultaneamente;
- Cache, apenas se realmente fizer sentido;
- Frequência de atualização do progresso.

A implementação deve ser simples inicialmente, mas preparada para escalar de forma razoável.

---

# 11. Acessibilidade

Incluir requisitos de acessibilidade.

Garantir:

- Navegação completa por teclado;
- Estados de foco visíveis;
- Labels adequados;
- Uso correto de `aria-current` para o capítulo atual, quando aplicável;
- Botões anterior/próximo corretamente identificados;
- Não depender exclusivamente de cor para indicar progresso;
- Contraste adequado;
- Semântica correta para navegação e lista de capítulos;
- Compatibilidade com leitores de tela.

---

# 12. Segurança e autorização

Analisar como a aplicação garante que o usuário possui permissão para acessar:

- O livro;
- Os capítulos;
- O progresso de leitura.

Garantir que um usuário:

- Não consiga visualizar progresso de outro usuário;
- Não consiga alterar o progresso de outro usuário;
- Não consiga acessar capítulos restritos manipulando URLs ou parâmetros.

Aproveitar o sistema de autenticação/autorização existente.

---

# 13. Testes

O plano deve especificar os testes necessários.

Incluir, conforme a stack existente:

## Backend

- Model specs;
- Request specs;
- Controller specs, se utilizadas no projeto;
- Service specs, se necessário;
- Policy specs;
- Testes de autorização;
- Testes de ordenação dos capítulos;
- Testes de persistência do progresso.

## Frontend

- Testes de componentes;
- Testes de interação;
- Testes da navegação anterior/próximo;
- Testes do índice;
- Testes de estados visuais;
- Testes responsivos, quando a infraestrutura existente permitir.

## Fluxos críticos

Criar cenários para:

1. Usuário abre um livro pela primeira vez;
2. Usuário acessa um capítulo;
3. Usuário avança para o próximo;
4. Usuário retorna ao capítulo anterior;
5. Usuário acessa um capítulo pelo índice;
6. Usuário conclui um capítulo;
7. Progresso é persistido;
8. Usuário sai da aplicação;
9. Usuário retorna posteriormente;
10. Sistema continua no ponto correto;
11. Usuário chega ao último capítulo;
12. Livro possui apenas um capítulo;
13. Livro possui muitos capítulos;
14. Usuário tenta acessar um capítulo sem permissão.

---

# Formato obrigatório da resposta

Não implemente nenhuma alteração imediatamente.

Primeiro, gere um arquivo de plano na raiz do projeto com o nome:

```text
CHAPTER-READING-PLAN.md
```

O arquivo deve conter:

## 1. Resumo da análise atual

Descrever como a leitura funciona hoje com base na codebase real.

## 2. Problemas e oportunidades identificados

Listar os pontos encontrados na implementação atual.

## 3. Arquitetura proposta

Explicar a solução recomendada para:

- Navegação entre capítulos;
- Índice;
- Progresso;
- Persistência;
- Continuar leitura;
- Responsividade;
- Autorização.

## 4. Modelagem de dados

Apresentar as alterações necessárias em models, migrations e associações.

Caso existam múltiplas abordagens, comparar e recomendar uma.

## 5. Fluxo do usuário

Descrever passo a passo a experiência de:

- Começar a ler;
- Navegar entre capítulos;
- Selecionar capítulos;
- Salvar progresso;
- Retornar à leitura.

## 6. Plano de implementação por fases

Dividir em fases pequenas e seguras.

Para cada fase, informar:

- Objetivo;
- Arquivos que provavelmente serão alterados;
- Models envolvidos;
- Controllers envolvidos;
- Views/components envolvidos;
- JavaScript/Stimulus, se aplicável;
- Migrations necessárias;
- Estratégia de testes;
- Critérios de aceite.

## 7. Proposta de interface

Descrever detalhadamente a evolução da tela atual.

Incluir wireframes em ASCII/Markdown quando ajudarem a demonstrar:

- Desktop;
- Mobile;
- Índice de capítulos;
- Navegação;
- Progresso.

## 8. Riscos e cuidados

Listar possíveis riscos técnicos, incluindo:

- Migrações;
- Dados existentes;
- Performance;
- N+1;
- Segurança;
- Responsividade;
- Compatibilidade com funcionalidades atuais.

## 9. Ordem recomendada de implementação

Apresentar a sequência ideal de execução.

## 10. Checklist final

Criar um checklist completo de validação antes de considerar a feature concluída.

---

# Restrições importantes

- Não modificar a codebase durante esta etapa;
- Não criar migrations ainda;
- Não implementar código ainda;
- Não remover funcionalidades existentes;
- Não alterar regras de negócio sem antes identificá-las;
- Não assumir nomes de models, rotas ou estruturas sem verificar a codebase;
- Reutilizar componentes e padrões existentes sempre que possível;
- Evitar overengineering;
- Priorizar Ruby on Rails idiomático;
- Manter a solução compatível com a arquitetura atual;
- Priorizar experiência mobile e acessibilidade;
- Preservar uma experiência de leitura limpa, focada no conteúdo.

Ao final, apresente uma recomendação objetiva da **arquitetura que considera ideal para esta aplicação**, explicando por que ela oferece o melhor equilíbrio entre experiência do usuário, simplicidade, manutenção e escalabilidade.
