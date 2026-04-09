# Documento de Requisitos do Produto (PRD) - BountyTracker (V2.0)

**Última revisão:** 2026-04-08  
**Status:** Em evolução  
**Escopo inicial:** One Piece TCG  
**Plataforma:** Web mobile-first

## 0. Metadados do Produto

| Campo | Descrição |
| --- | --- |
| Nome | BountyTracker |
| Público inicial | Jogadores competitivos, colecionadores e negociantes de Fortaleza |
| Proposta central | Ser o "home broker" do jogador de TCG para consulta de preços, troca em tempo real e gestão de coleção |
| Stack principal | Python para ingestão de dados, Supabase para backend e TypeScript/Next.js para frontend |
| Diferencial | Unificar dados confiáveis, cálculo instantâneo de troca e ferramentas práticas para evento presencial |

## 1. Visão do Produto

O BountyTracker é uma plataforma web focada na comunidade de Trading Card Games, começando com One Piece, que conecta inteligência financeira real, utilidade prática para negociações e ferramentas de jogo. O objetivo é reduzir atrito na hora de comparar preços, montar decks, acompanhar o mercado e fechar trocas no balcão ou no WhatsApp.

## 2. Problema que o Produto Resolve

- Os jogadores consultam preços em fontes fragmentadas e pouco confiáveis.
- As trocas em eventos acontecem sob pressão e exigem cálculo rápido de margem.
- A gestão de coleção costuma ficar espalhada entre planilhas, conversa de grupo e memória do usuário.
- Lojistas precisam de um canal simples para publicar buylist e eventos sem depender de sistemas pesados.
- Falta uma ponte entre preço de mercado, valor de troca e operação local em Fortaleza.

## 3. Objetivos do Produto

- Ser a referência local para consulta de preços de cartas de One Piece TCG.
- Permitir cálculo instantâneo de trocas com desconto granular por carta.
- Ajudar o usuário a enxergar valor de coleção em múltiplos cenários de revenda.
- Aumentar retenção com alertas, buylist, radar de torneios e scanner.
- Oferecer uma base escalável para novos TCGs no futuro.

## 4. Público-Alvo Inicial

- Jogadores competitivos que precisam decidir rápido se uma troca vale a pena.
- Colecionadores que querem acompanhar o valor real de suas cartas.
- Flippers e negociantes que compram e revendem com foco em margem.
- Lojistas que desejam divulgar buylist e eventos locais.
- Usuários de Fortaleza que negociam presencialmente ou via WhatsApp.

## 5. Não Objetivos da Versão Atual

- Não é um marketplace com checkout e pagamento interno.
- Não é um sistema de entrega ou logística.
- Não é um CRM completo para lojas.
- Não é um app offline-first.
- Não é um produto multi-TCG no MVP.

## 6. Arquitetura do Sistema

### 6.1 Motor de Dados

- Scripts em Python para interceptação de JSONs estruturados (`cardsjson`).
- Captura de nome, código, imagem, raridade e preços históricos.
- Persistência local em JSON durante a etapa de ingestão e validação.
- Extração de três faixas de preço por carta: mínimo, médio e máximo.

### 6.2 Backend

- Supabase como banco PostgreSQL para histórico de preços e dados de domínio.
- Supabase Auth para autenticação e perfis.
- Supabase Storage para imagens públicas das cartas e ativos otimizados.
- Regras de RLS para proteger escrita de coleção, alertas, buylist e perfis.

### 6.3 Frontend

- Aplicação em TypeScript com foco em performance e experiência mobile-first.
- Navegação orientada a tarefas rápidas: mercado, cálculo, deck, carteira, alertas e scanner.
- Interface baseada em feedback visual claro para uso em ambiente de evento.

## 7. Escopo do MVP

| Módulo | Funcionalidade | Requisitos de Aceitação |
| --- | --- | --- |
| Motor de Dados | Scraper de JSON estruturado | Extrair nomes, códigos, imagens e metadados a partir de `cardsjson`, sem depender de leitura visual de HTML. |
| Motor de Dados | Tracker de preços triple-check | Registrar diariamente `p1a`, `p1b` e `p1c`, gerando mínimo, médio e máximo com histórico confiável. |
| Frontend (Mercado) | Dashboard de cotações | Exibir cartas com preço médio como referência e indicar Yield (%) com variação percentual. |
| Frontend (Trade) | Calculadora de Feira | Separar a interface entre "Meus Cards" e "Cards do Oponente" para simular trocas. |
| Frontend (Trade) | Desconto granular | Permitir desconto individual por linha de carta, com atualização imediata do valor final. |
| Deckbuilder | Construtor público | Permitir montar deck com 50 cartas + líder, validar regras e exportar para simuladores. |

## 8. Requisitos Funcionais Detalhados

### 8.1 Mercado

- Listar cartas com imagem, número, raridade e preço atual.
- Exibir a variação percentual entre medições recentes.
- Permitir busca por nome e filtro por coleção.
- Permitir navegação para a tela de detalhe da carta.

### 8.2 Detalhe da Carta

- Exibir imagem em destaque, metadados e histórico de preço.
- Mostrar gráfico de volatilidade com base em min, avg e max.
- Permitir envio da carta para a Calculadora de Feira.
- Permitir envio da carta para o Deckbuilder.
- Permitir criar alerta de preço alvo a partir da carta aberta.

### 8.3 Calculadora de Feira

- Permitir inserir cards em dois lados da troca.
- Permitir desconto individual por carta.
- Recalcular totais em tempo real.
- Permitir mover cartas de um lado para o outro.
- Permitir desfazer a última ação e limpar a troca.

### 8.4 Deckbuilder

- Permitir busca de cartas e adição ao deck.
- Validar limite de cópias e regra do líder.
- Exibir total de cartas e valor estimado do deck.
- Permitir remoção, ajuste de quantidade e destaque da carta líder.

### 8.5 Carteira

- Permitir ao usuário cadastrar e visualizar sua coleção.
- Mostrar valor total em três cenários: referência, comunidade e lojista.
- Exibir subtotal por carta e quantidade por item.

### 8.6 Alertas de Bounty

- Permitir criar alerta de preço alvo por carta.
- Notificar o usuário quando o preço atingir o valor definido.
- Integrar com Telegram como canal de notificação.

### 8.7 Buylist de Lojas

- Exibir ofertas de compra por loja parceira.
- Mostrar porcentagem paga e método de pagamento.
- Permitir ação direta via WhatsApp da loja.

### 8.8 Radar de Torneios

- Exibir eventos locais com data, horário, formato e loja.
- Permitir inscrição direta via WhatsApp.
- Mostrar status de inscrições abertas e evento ativo.

### 8.9 Scanner

- Usar a câmera do celular para identificar a carta.
- Reconhecer o código e levar o usuário para a Calculadora com o preço do dia.
- Exibir estado de leitura, processamento e resultado encontrado.

### 8.10 Perfil e Lojista

- Permitir autenticação e edição de perfil.
- Separar o fluxo de lojista para gestão de loja, eventos e buylist.
- Respeitar permissões de acesso por sessão autenticada.

## 9. Requisitos Não Funcionais

- Mobile-first: as telas principais precisam ser utilizáveis com uma mão.
- Performance: cálculos locais devem responder instantaneamente e buscas devem parecer reativas.
- Confiabilidade: o sistema deve preservar histórico de preços sem sobrescrever dados.
- Segurança: aplicar RLS e autenticação para proteger dados privados do usuário.
- Acessibilidade: contraste adequado, foco visível e ações navegáveis por teclado.
- Escalabilidade: a estrutura deve permitir incluir novos TCGs sem refazer a base inteira.
- Observabilidade: registrar falhas de integração, problemas de ingestão e erros de fluxo.

## 10. Métricas de Sucesso

- Tempo médio para concluir uma troca na Calculadora.
- Taxa de uso da Calculadora por sessão.
- Taxa de criação de alertas por carta visualizada.
- Taxa de uso do Deckbuilder e exportação de decks.
- Taxa de abertura do Radar e clique em WhatsApp.
- Número de cartas adicionadas à carteira por usuário ativo.
- Taxa de sucesso do Scanner em ambiente real.

## 11. Roadmap Pós-MVP

### Fase 2: Inteligência Financeira e Retenção

- Gráficos de candlestick para visualização de volatilidade.
- Gestão de patrimônio com cenários de referência, comunidade e lojista.
- Alertas de Bounty via Telegram.

### Fase 3: Hub B2B e Expansão Local

- Buylist de lojas de Fortaleza.
- Radar de torneios com inscrição via WhatsApp.

### Fase 4: Inovação Tecnológica

- Scanner por visão computacional.
- Expansão para Pokémon TCG e Magic: The Gathering.

## 12. Dependências e Premissas

- A fonte de dados precisa continuar disponibilizando JSON estruturado.
- O esquema do Supabase deve suportar histórico de preços e RLS por domínio.
- As imagens das cartas precisam estar disponíveis em storage público.
- Lojistas precisam cadastrar números de WhatsApp válidos.
- O Scanner depende de permissão de câmera no navegador.

## 13. Riscos e Mitigações

- Mudança no formato do JSON de origem: manter camada de validação no motor de dados.
- Falha de RLS: criar políticas explícitas e testar fluxo autenticado e anônimo.
- Ruído no Scanner: exibir feedback claro e permitir reprocessamento manual.
- Uso em telas pequenas: priorizar layouts compactos, botões grandes e hierarquia visual simples.
- Crescimento de escopo: manter módulos em fases e não misturar roadmap com MVP.

## 14. Primeiros Passos Estratégicos

1. Refinar a ingestão Python para mapear `p1a`, `p1b` e `p1c`.
2. Configurar Supabase com tabelas de cartas, histórico, coleção, alertas e buylist.
3. Consolidar a lógica da Calculadora de Feira com desconto por linha.
4. Ajustar a interface mobile-first para uso rápido em evento presencial.

## 15. Glossário

- `cardsjson`: objeto estruturado de origem com metadados das cartas.
- `p1a`, `p1b`, `p1c`: camadas de preço mínimo, médio e máximo.
- `Yield`: variação percentual entre medições recentes.
- `Buylist`: lista de compra de uma loja, com porcentagem paga sobre o preço de mercado.
- `Bounty`: alerta de preço alvo configurado pelo usuário.

## 16. Critérios de Go para o Pós-MVP

A transição para a Fase 2 só deve acontecer quando os itens abaixo estiverem atendidos:

- O pipeline de dados estiver capturando e persistindo `p1a`, `p1b` e `p1c` com histórico consistente.
- O Mercado, a tela de detalhe da carta, a Calculadora de Feira e o Deckbuilder estiverem estáveis nos fluxos principais.
- Supabase Auth, RLS e Storage estiverem funcionando sem bloqueios nos fluxos de login, perfil e lojista.
- A experiência mobile estiver validada nos principais breakpoints usados pelo público-alvo.
- Houver métricas mínimas de uso e falha para acompanhar o comportamento dos módulos principais.
- Não existirem bugs bloqueadores nos fluxos de preço, trade, deck e autenticação.

Se qualquer item acima falhar, a Fase 2 deve esperar correção antes de avançar.

## 17. Backlog Priorizado da Fase 2

### P0 - Base Financeira

| Prioridade | Item | Dependência | Resultado esperado |
| --- | --- | --- | --- |
| P0 | Gráficos de candlestick | Histórico diário com `min/avg/max` disponível | Visualizar volatilidade da carta com leitura rápida e confiável |
| P0 | Gestão de patrimônio | Carteira com preços consolidados e coleção persistida | Mostrar o valor da coleção em 100%, -20% e -50% |

### P1 - Retenção e Valor Diário

| Prioridade | Item | Dependência | Resultado esperado |
| --- | --- | --- | --- |
| P1 | Alertas de Bounty via Telegram | Motor de alertas e cadastro de canal do usuário | Notificar quando a carta atingir o preço alvo |
| P1 | Telemetria básica de produto | Eventos de uso instrumentados no frontend | Medir adoção da Calculadora, Deckbuilder, Radar e Scanner |

### P2 - Refinamento

| Prioridade | Item | Dependência | Resultado esperado |
| --- | --- | --- | --- |
| P2 | Ajustes de UX mobile | Feedback do uso real em eventos | Reduzir atrito em telas pequenas e em fluxo de balcão |
| P2 | Estados vazios e mensagens orientadas à ação | Consolidação visual das telas principais | Melhorar clareza quando não há dados ou ações ativas |

