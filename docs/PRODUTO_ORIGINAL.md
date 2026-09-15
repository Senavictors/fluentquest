# FluentQuest

## Documento de produto e engenharia

**Inglês para desenvolvedores | Conversação, autonomia e progressão saudável**

Versão 1.0 - 14 de setembro de 2026. Nome de trabalho, sujeito a validação.

### Direção recomendada

Construir um sistema pessoal que transforma conteúdo relevante em prática ativa: compreender, recuperar da memória, falar, receber feedback e revisar. O personagem representa a jornada; a evolução do idioma é sustentada por evidências, não por pontos acumulados.

Começar com monólito modular, player oficial do YouTube, texto contextual, Gemini econômico, gravação de fala e revisão espaçada. Separar a qualidade do vídeo assistido da resolução usada pela IA. Live e gamificação avançada entram depois de o ciclo de estudo funcionar.

### Premissas

Uso pessoal inicial; desenvolvedor full-stack pleno; foco em inglês conversacional e profissional; 30-50 horas mensais de vídeo. Nível inicial do idioma a diagnosticar. Custos, metas e cronograma são planejamento, não garantia de desempenho ou fatura.

### Navegação

- [1. Produto e aprendizado](#capitulo-1)
- [2. Experiência e gamificação](#capitulo-2)
- [3. Arquitetura e dados](#capitulo-3)
- [4. APIs e preparação de conteúdo](#capitulo-4)
- [5. Economia de tokens e orçamento](#capitulo-5)
- [6. Segurança, direitos e qualidade](#capitulo-6)
- [7. Roadmap, backlog e decisões](#capitulo-7)
- [8. Referências e revisão](#capitulo-8)

<a id="capitulo-1"></a>

# 1. Produto e aprendizado

## 1.1. Visão

**FluentQuest** é um nome de trabalho para uma plataforma pessoal de inglês: conteúdo interessante se transforma em prática de comunicação, revisão e evidências de progresso. O objetivo é ajudar o aluno, desenvolvedor fullstack pleno, a conversar com mais autonomia no trabalho e fora dele. O produto não deve ser apenas um resumidor de vídeos, nem um jogo que premie permanecer conectado.

O dimensionamento inicial considera um usuário e 30-50 horas mensais de vídeos, com reprodução de alta qualidade. Horas assistidas, horas novas importadas e horas processadas pela IA são grandezas diferentes. Para testar o orçamento, os cenários conservadores assumem que todas as horas são novas e analisadas uma vez. Reassistir ao material pronto não exige nova ingestão.

O nível de inglês deve ser levantado no onboarding; senioridade técnica não implica fluência. Inglês é o primeiro idioma. O banco aceita outros idiomas, mas o MVP não implementa cursos multilíngues. Metas, pesos, limites e latências propostos neste documento são hipóteses de produto a validar.

## 1.2. Resultado que importa

A pergunta principal é: **consigo fazer hoje, em inglês, algo que não conseguia antes?** Exemplos: explicar um bug, pedir esclarecimento, apresentar uma decisão de arquitetura, negociar um prazo e manter uma conversa sem depender de tradução frase a frase.

A métrica principal será o número de tarefas comunicativas realizadas com autonomia e reavaliadas depois. Indicadores auxiliares: minutos de fala produzida, revisões concluídas, retenção em testes novos, uso espontâneo de expressões e ajuda necessária. Tempo assistido é apenas registro privado de estudo, não comprovação de conhecimento.

| Decisão | Direção recomendada |
| --- | --- |
| Produto | Tutor de prática com biblioteca pessoal. |
| Experiência | Poucas telas, próxima ação clara e sessões com fim. |
| IA | Flash-Lite como candidato inicial; modelo superior quando necessário. |
| Mídia | Player oficial em HD; texto e trechos visuais tratados separadamente. |
| Aprendizado | Recuperar, produzir, receber feedback, revisar e transferir. |
| Jogo | Personagem e conquistas ligados a atividades pedagógicas. |
| Engenharia | Monólito modular, PostgreSQL e worker persistente. |

## 1.3. Ciclo de estudo

**Entender -> recuperar -> falar -> receber feedback -> revisar -> transferir.** Uma sessão de 30 minutos pode ter 10 minutos de conteúdo, 5 de recuperação sem consulta, 8 de fala, 5 de revisão e 2 de fechamento. É uma configuração inicial, não uma prescrição rígida.

O aluno também pode assistir por mais tempo em modo imersão. Não transformar 50 horas de vídeo em outras 50 horas obrigatórias de exercícios. Oferecer sessões de 10, 25 e 45 minutos e modo livre. Selecionar poucas oportunidades de aprendizado por trecho, em vez de tentar ensinar cada palavra desconhecida.

Karpicke e Roediger observaram, em um experimento com vocabulário de língua estrangeira, benefício de recuperação repetida para retenção tardia. Isso fundamenta exercícios de lembrança; não demonstra, por si só, a eficácia deste aplicativo ou um prazo para fluência. [R24]

## 1.4. Onboarding e diagnóstico

Coletar interesses, objetivos, disponibilidade, variedade de inglês preferida e conforto ao falar. Propor uma apresentação gravada e tarefas curtas de escuta e compreensão. O microfone é opcional: sem amostra de áudio, mostrar 'fala ainda não avaliada'. Explicações podem começar em português e migrar para inglês por escolha do aluno.

O CEFR fornece descritores de competências comunicativas. Usá-los para organizar tarefas, sem converter XP em A1-C2. A interface pode exibir 'estimativa inicial de compreensão: B1; fala: evidência insuficiente', nunca um certificado automático. [R25]

Reavaliar o diagnóstico com novas amostras. Cada estimativa guarda rubrica, data, versão do avaliador e atividades utilizadas. Uma resposta isolada não determina o nível global. O aluno pode discordar da dificuldade proposta e ajustá-la.

## 1.5. Currículo para desenvolvedores

| Trilha | Tarefa comunicativa | Evidência |
| --- | --- | --- |
| Cotidiano | Apresentar-se, contar uma experiência e pedir ajuda. | Responder a uma pergunta nova sem roteiro. |
| Daily | Explicar ontem, hoje e um bloqueio. | Atualização de 60-90 segundos e esclarecimento. |
| Debugging | Reproduzir um problema e propor o próximo passo. | Explicação compreensível para um colega. |
| Code review | Sugerir mudança e discordar com respeito. | Justificativa e resposta a contraponto. |
| Arquitetura | Comparar alternativas e discutir trade-offs. | Defender uma decisão e reconhecer limitações. |
| Reuniões | Interromper educadamente, resumir e comunicar impacto. | Simulação com perguntas inesperadas. |
| Carreira | Apresentar um projeto e participar de entrevista. | Relato estruturado sem memorizar um texto. |

Uma distribuição inicial possível é 60% de situações profissionais e 40% de interesses pessoais. Ajustar pela preferência e dificuldade. Não restringir todo o repertório a programação: conversa informal também importa no trabalho.

## 1.6. Revisão espaçada

Adotar FSRS por uma biblioteca mantida, como ts-fsrs, em vez de reimplementar o algoritmo. O agendador organiza revisões; a seleção de habilidades e atividades continua sendo responsabilidade do produto. [R23]

Persistir o estado completo devolvido pela biblioteca, versão, parâmetros e log de revisão. Não deduzir a nota apenas do tempo de resposta. Usar 'esqueci', 'difícil', 'bom' e 'fácil', com orientação e possibilidade de corrigir um toque errado.

Cada cartão tem expressão-alvo, sentido, contexto e proveniência. Reconhecimento, produção e escuta mantêm evidências separadas: reconhecer uma expressão não prova capacidade de usá-la. Começar com limite sugerido de 3-5 itens novos por dia e uma fila de 5-10 minutos. Reduzir itens novos quando o acúmulo de revisões aumenta.

Uma sugestão do tutor só entra no baralho com confirmação do aluno. Deduplicar por idioma, expressão normalizada e sentido, sem fundir sentidos diferentes. Guardar o exemplo original e oferecer novos contextos na revisão, evitando decorar a posição de uma resposta.

## 1.7. Speaking no primeiro MVP

O MVP deve ter gravação curta, reprodução da própria fala e feedback. Adiar conversa ao vivo é razoável; adiar toda prática oral contradiz o objetivo. Atividade inicial: explicar um bug em até 90 segundos e responder o que faria a seguir. O feedback mostra um ponto forte, uma correção prioritária e uma nova tentativa curta.

Separar transcrição, análise de conteúdo/gramática e avaliação acústica. Um texto reconhecido corretamente não mede pronúncia. Azure Pronunciation Assessment é uma alternativa especializada, com resultados fonéticos e prosódicos; os recursos variam por idioma, e a documentação restringe prosódia a en-US. [R22]

A meta é inteligibilidade e autonomia, não eliminar sotaque brasileiro. Se houver somente transcrição, o tutor comenta estrutura e vocabulário, sem inventar uma nota acústica. Dar feedback ao final de um turno evita interromper cada frase.


<a id="capitulo-2"></a>

# 2. Experiência e gamificação

## 2.1. Princípio de navegação

A interface deve parecer uma ferramenta de estudo adulta, não um painel de administração nem um jogo cheio de distrações. Uma cor de destaque, bastante espaço, tipografia legível, poucos indicadores simultâneos e uma ação principal por tela. Oferecer temas claro e escuro com contraste testado.

Usar cinco destinos: **Hoje, Biblioteca, Praticar, Revisar e Jornada**. Configurações e custos ficam no menu de perfil. No desktop, navegação lateral compacta; no celular, barra inferior. Rotas preservam vídeo, trecho, aba e atividade. Voltar no navegador deve restaurar contexto, não reiniciar o estudo.

| Tela | Elemento central | Ação principal |
| --- | --- | --- |
| Hoje | Missão escolhida e revisões pendentes. | Continuar minha sessão. |
| Biblioteca | Vídeos e fontes com estado de preparo. | Adicionar conteúdo. |
| Sala de estudo | Player, transcrição e uma ferramenta contextual. | Estudar o trecho atual. |
| Praticar | Cenários de conversa ou resposta gravada. | Começar uma tentativa. |
| Revisar | Um item por vez. | Recuperar antes de revelar. |
| Jornada | Evidências, habilidades e personagem. | Escolher o próximo desafio. |

## 2.2. Sala de estudo

No desktop, reservar a região principal ao player e à transcrição. Um painel lateral alterna entre explicação, tutor e atividade, sem exibir tudo junto. No celular, usar player seguido de abas; evitar três colunas espremidas. Nenhum painel deve encobrir controles ou publicidade do player.

```text
HOJE / BIBLIOTECA / PRATICAR / REVISAR / JORNADA

[ Player oficial do YouTube ]   [ Contexto do trecho ]
[ Controles originais       ]   [ Expressao / Tutor   ]
                               [ Uma acao principal ]
[ Frase atual em ingles    ]
[ Traducao: revelar        ]
[ Repetir trecho ] [ Salvar expressao ] [ Praticar ]
```

A tradução começa oculta, mas pode ser mantida visível. Clicar em uma frase navega até o trecho quando o timestamp é confiável. Selecionar uma expressão abre sua explicação contextual; não traduzir todas as frases com IA antes de o aluno pedir. O modo imersão não deve pausar o vídeo a cada nova palavra.

Manter o player montado ao trocar ferramentas, usar uma lista virtualizada para transcrições longas e atualizar apenas a frase ativa. Salvar posição de forma espaçada e ao pausar; não gravar no banco a cada frame. O estado 'salvo' só aparece após confirmação do servidor, embora a ação possa ser otimista.

O player oficial permite controle de tempo e velocidade, dentro de suas capacidades. Navegação por trecho não é alinhamento acústico de precisão: a API pode navegar por keyframes, e limites de trecho exigem testes. Não prometer karaoke palavra a palavra sem dados adequados. [R13]

## 2.3. Estados e acessibilidade

Projetar explicitamente estados vazio, preparando, parcialmente pronto, sem transcrição, fonte indisponível, microfone negado, offline, resposta incerta e orçamento atingido. 'Preparando 3 de 8 trechos' é melhor que um spinner indefinido. Não mostrar porcentagens de progresso que o backend não consegue medir.

Metas propostas: resposta visual a toque em até 100 ms; consulta de conteúdo pronto no backend com p95 abaixo de 500 ms; primeiro texto do tutor com p95 abaixo de 3 s em teste controlado; resultado curto de fala com p95 abaixo de 8 s após envio. São objetivos de engenharia, não SLA de fornecedores. Medir rede, dispositivo, região e tamanho do payload.

Testar teclado, foco visível, leitor de tela, zoom, contraste e movimento reduzido. A WCAG 2.2 inclui requisitos de tamanho mínimo de alvos e foco não encoberto. Adotar como regra interna botões de aproximadamente 44 px em interações principais, sem afirmar que esse valor é o mínimo AA universal. [R27][R28]

Atalhos devem ser configuráveis e desativados em campos de texto. O idioma de frases em inglês precisa ser marcado corretamente para tecnologias assistivas. Cores nunca são a única forma de informar acerto ou progresso.

## 2.4. O personagem é o conhecimento

Criar um avatar discreto, com evolução visual e uma árvore de habilidades: escuta, expressão oral, vocabulário ativo, construção de frases e comunicação profissional. Separar três camadas: **XP de participação**, **evidências de domínio** e **estimativas de proficiência**. Ganhar XP não aumenta automaticamente uma nota de competência.

Os capítulos podem ser 'Primeiro contato', 'Daily sem roteiro', 'Code review', 'Decisões de arquitetura' e 'Conversa sob pressão'. O aluno desbloqueia cosméticos e marcos, mas pode acessar atividades de outras trilhas quando quiser. Não bloquear aprendizado essencial atrás de pontos.

Exemplo de personagem: 'Comunicador em construção, nível 8'. Ao lado, mostrar evidência real: 'Você explicou um bloqueio e respondeu a duas perguntas sem consultar o roteiro'. Isso é mais significativo que uma barra genérica de '73% fluente'.

## 2.5. Regras de recompensa

As políticas do YouTube proíbem incentivos e recompensas por ações como assistir, curtir ou se inscrever. Portanto, não conceder XP por reprodução, minutos assistidos ou término de vídeo. Missões pedagógicas devem poder ser feitas também com material próprio ou texto, sem exigir uma visualização específica. [R17]

| Evento pedagógico | XP inicial proposto | Proteção |
| --- | --- | --- |
| Revisão de item devido | 5 | Uma concessão por evento de revisão válido. |
| Tentativa de resposta oral | 10 | Uma por atividade; vale por tentar, não por soar nativo. |
| Exercício concluído com feedback | 10 | Sem recompensa por cliques repetidos. |
| Nova tentativa após correção | 5 | Uma melhoria ou reflexão registrada. |
| Desafio comunicativo semanal | 30 | Concessão única por desafio. |
| Assistir, curtir ou comentar no YouTube | 0 | Não elegível. |

Uma curva simples e transparente: XP acumulado para nível L = 100 × (L - 1)^1,4, arredondado. A curva é cosmética e pode ser recalibrada preservando o histórico. Não conceder pontos por ações fora do servidor: o frontend envia a tentativa; o backend valida e gera o evento de recompensa.

Manter um livro-razão de XP com chave única por usuário, evento de origem e regra. Uma repetição de request não duplica pontos. Não usar reconhecimento de voz como prova infalível de esforço. Em uso pessoal, uma autoconfirmação claramente identificada é aceitável quando a avaliação automática falhar.

## 2.6. Desafios, constância e limites saudáveis

O desafio semanal usa uma situação nova: explicar uma escolha técnica por dois minutos e responder a uma objeção. Avaliar clareza, conclusão da tarefa, organização, repertório e interação em escala interna de 0-4. A rubrica é uma ferramenta de feedback, não certificação CEFR. Repetir uma tarefa paralela semanas depois verifica transferência.

Preferir meta semanal ajustável a sequência diária punitiva. Descanso não remove conquistas; atrasos não apagam conhecimento. Notificações são opcionais, silenciosas à noite e limitadas. Sem ranking público padrão, loot boxes, perdas artificiais, contagens regressivas ou feed infinito.

Ao terminar, apresentar uma tela de fechamento: o que foi praticado, uma pequena evidência de evolução e quando revisar. O botão principal é 'Encerrar por hoje'; continuar permanece disponível. A experiência deve gerar vontade de voltar, não dificultar sair.

## 2.7. Progresso confiável

Exibir histórico de tarefas e amostras de fala, itens em aprendizado e revisões previstas. Comparar tentativas em rubricas equivalentes. Separar acerto de múltipla escolha de produção livre; um não substitui o outro. O indicador de retenção do agendador é uma estimativa de memória para aqueles itens, não uma probabilidade de fluência.

O painel deve permitir responder: 'O que melhorei?', 'Que evidência mostra isso?' e 'Qual é o próximo passo?'. Se não houver amostras suficientes, mostrar essa condição em vez de fabricar uma curva ascendente.


<a id="capitulo-3"></a>

# 3. Arquitetura e dados

## 3.1. Stack recomendada

Adotar um **monólito modular em TypeScript**, com Next.js para interface e camada HTTP, PostgreSQL como fonte de verdade, Drizzle para acesso tipado e migrações, Zod para contratos e pg-boss para tarefas. Esses nomes são escolhas de projeto; fixar versões compatíveis no lockfile durante a implementação, sem depender de aliases de versão.

O pg-boss implementa filas sobre PostgreSQL e permite integração transacional com o banco. Isso evita adicionar Redis apenas para a fila neste volume. Ainda assim, chamadas externas não se tornam exatamente uma vez: uma falha depois da resposta do fornecedor e antes do commit pode gerar reprocessamento. [R26]

Usar dois processos no mesmo repositório: **web** e **worker**. O worker deve executar em ambiente persistente, separado do ciclo de vida de uma requisição HTTP. Um armazenamento de objetos privado guarda apenas gravações e arquivos autorizados. Não hospedar cópias dos vídeos do YouTube.

Autenticação: usar biblioteca ou provedor mantido com sessões seguras; começar com acesso restrito ao proprietário. Evitar autenticação caseira. Um serviço gerenciado de PostgreSQL pode reduzir operação, mas deve aceitar o funcionamento da fila e suas conexões; validar pool, migrações e isolamento antes da escolha.

## 3.2. Componentes

```text
Navegador
  |-- Player oficial YouTube -> infraestrutura do YouTube
  |-- Interface / revisoes / gravacao
  |
  +-> Web API: autenticacao, validacao, orcamento, SSE
         |-- Modulos de aprendizado e gamificacao
         |-- PostgreSQL: dados, fila e livro-razao
         |-- Object storage privado: audio autorizado
         |
         +-> Worker
                |-- YouTube: metadados autorizados
                |-- Gemini: texto, video e transcricao
                |-- Avaliador de pronuncia: opcional
                +-- Validacao, persistencia e eventos
```

Módulos de domínio: identidade; fontes e direitos; biblioteca; preparação de conteúdo; atividades; prática oral; revisão; evidências; gamificação; custos. Nenhum módulo de progresso depende do formato bruto retornado pelo Gemini. Adaptadores convertem respostas externas em contratos internos versionados.

Interfaces sugeridas: `VideoMetadataProvider`, `TranscriptProvider`, `LessonGenerator`, `TutorProvider`, `SpeechTranscriber`, `PronunciationAssessor` e `UsageRecorder`. Não criar uma plataforma genérica de plugins. A abstração precisa apenas permitir substituir um fornecedor sem migrar todo o domínio.

## 3.3. Fluxo assíncrono e fluidez

A importação segue: autenticar; normalizar URL; consultar metadados; verificar acesso; procurar preparação existente; estimar custo; reservar saldo; criar job; retornar HTTP 202. O navegador recebe um `sourceId` e `jobId` e acompanha eventos. O player pode aparecer antes de o material pedagógico estar pronto.

Estados: `requested`, `validating`, `queued`, `processing`, `partial_ready`, `ready`, `needs_review`, `blocked_rights`, `blocked_budget`, `failed` e `cancelled`. A transição para `partial_ready` exige ao menos um trecho validado com uma atividade utilizável. Não esconder uma falha de transcrição atrás do estado 'pronto'.

Processar primeiro o trecho que o aluno escolheu. Preparar o próximo bloco quando houver intenção de uso; não gerar uma biblioteca inteira apenas porque um vídeo foi adicionado. Um prefetched item sem uso é custo desperdiçado, mesmo quando barato.

SSE comunica estados e texto do tutor; reconexão consulta o estado persistido. Eventos incluem ID monotônico por job e não transportam segredos ou dados de outro usuário. Manter polling espaçado como fallback. Conversa de voz ao vivo usa um canal separado, não a mesma fila de ingestão.

## 3.4. Modelo de dados

| Entidade | Conteúdo essencial |
| --- | --- |
| users / learner_profiles | Identidade, idioma de interface, timezone, metas e preferências. |
| sources / source_versions | Tipo, identificador externo, revisão, direitos, disponibilidade e idioma. |
| youtube_metadata | Título, canal, duração, permissão de embed, data de atualização e expiração. |
| user_sources | Vínculo privado do aluno com a fonte e posição de estudo. |
| transcript_versions | Origem, modelo, idioma, qualidade, status de validação e escopo de uso. |
| segments | Versão, início/fim em ms, texto, falante opcional e status temporal. |
| learning_units / exercises | Objetivo, dificuldade proposta, trecho de evidência, esquema e versão. |
| attempts | Resposta, tipo, ajuda utilizada, feedback e data. |
| speaking_recordings | Referência privada do áudio, consentimento, retenção e qualidade. |
| speech_assessments | Transcrição, rubrica, avaliador e medidas acústicas, quando existentes. |
| vocabulary_items / user_cards | Expressão, sentido, exemplos, dono, fonte e estado de aprendizado. |
| review_states / review_events | Estado FSRS, versão, parâmetros e histórico imutável. |
| skill_evidence | Habilidade, atividade, resultado, autonomia e rubrica. |
| quests / xp_ledger | Regras versionadas, conclusão e concessões idempotentes. |
| jobs / provider_calls | Tentativa externa, correlação, estado e erros classificados. |
| usage_events / budget_reservations | Tokens por categoria, preço aplicado, reserva e conciliação. |
| consents / deletion_requests | Consentimentos, revogações e execução de exclusão. |

Guardar datas em UTC e derivar o dia de estudo por `America/Sao_Paulo`, configurável. Guardar idioma como código de localidade, não enum fixo 'inglês'. Usar milissegundos inteiros para intervalos. O campo `confidence` só representa uma medida do fornecedor quando ele realmente a fornece; validação própria usa `quality_status` e razões, sem falsa precisão.

Índices iniciais: fontes por provedor e identificador; segmentos por versão e tempo; revisões por usuário e vencimento; tentativas por usuário e data; custos por projeto, usuário e período. Chaves únicas protegem imports, cartões equivalentes, reviews e XP. Autorizador aplica escopo de dono a toda consulta; UUID difícil de adivinhar não substitui permissão.

## 3.5. Contratos HTTP internos

| Rota | Responsabilidade |
| --- | --- |
| POST /api/sources | Criar importação; requer Idempotency-Key; devolve 202. |
| GET /api/sources/:id | Estado e metadados permitidos ao usuário. |
| GET /api/sources/:id/segments | Paginação por cursor ou faixa de tempo. |
| GET /api/jobs/:id/events | SSE de preparação; exige sessão e propriedade. |
| POST /api/lessons/:id/tutor | Pergunta contextual; stream e limite de custo. |
| POST /api/attempts | Registrar tentativa sem expor gabarito antecipadamente. |
| POST /api/recordings/upload-intent | URL assinada restrita a tamanho, tipo e dono. |
| POST /api/recordings/:id/assess | Avaliar apenas arquivo validado do usuário. |
| POST /api/reviews/:id/answer | Atualizar revisão com versão otimista e chave idempotente. |
| GET /api/progress | Agregados pedagógicos e evidências. |
| GET /api/usage | Gasto previsto, confirmado e reservado. |
| DELETE /api/account | Iniciar exclusão auditável de dados pessoais. |

Erros seguem contrato comum: `code`, `message`, `retryable`, `requestId` e `retryAfterSeconds` quando aplicável. Usar 401/403 para acesso, 409 para conflito de versão, 422 para conteúdo inválido e 429 para limites operacionais. O código de negócio `BUDGET_EXCEEDED` deve ser explícito; não mascará-lo como erro temporário do modelo.

## 3.6. Consistência, cache e falhas

Uma transação registra atividade, evidência, revisão e evento de XP, ou um outbox que finalize o conjunto de modo idempotente. Uma resposta duplicada em duas abas não pode conceder duas recompensas nem avançar duas vezes o FSRS. Usar versão de estado e restrições no banco, não apenas flags no frontend.

A chave de preparação inclui escopo de direitos, fonte/revisão, intervalo, idioma, versão da transcrição, prompt, esquema, modelo e configuração. Não compartilhar respostas personalizadas entre usuários. Conteúdo com direito restrito nunca entra em cache global.

Ao corrigir uma transcrição, invalidar apenas os artefatos derivados afetados. Cartões guardam a versão de origem; uma correção não apaga silenciosamente tentativas antigas. Marcar artefatos incorretos, oferecer substituição e preservar o histórico de progresso legítimo.

Retries têm teto, backoff exponencial e jitter. Um 400 por contrato inválido não deve ser repetido automaticamente. Um timeout com resultado desconhecido exige reconciliação antes de nova chamada cara. Se não houver identificador recuperável, registrar a incerteza e contabilizar a possível cobrança; idempotência local não elimina duplicidade no fornecedor.

## 3.7. Repositório e operação

```text
apps/web         interface, autenticacao e HTTP
apps/worker      jobs e adaptadores externos
packages/domain  regras pedagogicas e recompensas
packages/db      esquema, migracoes e repositorios
packages/ai      contratos, prompts e provedores
packages/ui      componentes e tokens visuais
packages/testing fixtures, avaliacoes e testes
```

No início, os diretórios podem estar em um único aplicativo; separar pacotes só quando reduzir acoplamento. Usar ambientes local, teste e produção com credenciais e projetos distintos. Backups, restauração testada, migrações reversíveis e logs sem conteúdo sensível fazem parte do MVP.

Não adicionar Kubernetes, Kafka, banco vetorial dedicado, microsserviços ou orquestração multiagente. Busca por trecho e filtros SQL atendem o caso inicial. Introduzir embeddings somente se a busca textual e as relações explícitas mostrarem limitações medidas.


<a id="capitulo-4"></a>

# 4. APIs e preparação de conteúdo

## 4.1. Matriz de fornecedores

| Necessidade | Escolha inicial | Alternativa e condição |
| --- | --- | --- |
| Reproduzir YouTube | IFrame Player API oficial. | Arquivo próprio em player HTML quando autorizado. |
| Metadados de vídeo | YouTube Data API, videos.list. | Registro manual de fonte própria. |
| Legendas | Arquivo autorizado; captions.download para vídeo com permissão de edição. | Extração pelo Gemini quando elegível e validada. |
| Exercícios e explicações | Gemini 3.5 Flash-Lite. | Gemini 3.8 Flash para tarefas que reprovem na avaliação. |
| Contexto visual | Gemini com trecho e resolução escolhidos. | Não usar visão quando texto bastar. |
| Transcrever áudio autorizado | Gemini 3.5 Transcribe, após prova técnica. | Outro ASR com timestamps e contrato compatível. |
| Conversa ao vivo | Gemini Live, em fase posterior. | Troca de gravações curtas no MVP. |
| Pronúncia detalhada | Não obrigatória no MVP. | Azure Pronunciation Assessment, com validação e custo separado. |

As escolhas de modelos devem ser confirmadas em testes com inglês real, sotaque brasileiro e vocabulário de desenvolvimento. A existência de recursos em uma família Gemini não significa que todo modelo os aceite. Por exemplo, Gemini 3.8 Flash é um modelo de saída textual, não o modelo de Live áudio. [R30][R31]

## 4.2. YouTube: separar playback, metadados e legendas

**Playback:** usar o iframe oficial, preservar controles e identificar a fonte. Resolução de reprodução depende do vídeo, conexão e player; não prometer forçar 1080p por um método não documentado. Repetição A-B é acionada explicitamente pelo aluno e testada com as limitações de navegação. Não criar reprodução oculta. [R13]

**Metadados:** normalizar URLs de watch, youtu.be e shorts para um videoId e consultar `videos.list` com as partes estritamente necessárias. A chamada custa uma unidade de cota. Consultar título, duração, status de embed e restrições relevantes; a resposta não garante que todo navegador poderá reproduzir o vídeo. [R14]

**Legendas:** o endpoint oficial de download exige permissão para editar o vídeo e OAuth adequado. Ele não é uma API universal de transcrição para qualquer URL pública. Ter uma API key do YouTube não remove essa exigência. [R15]

No MVP, priorizar colar URLs em vez de construir busca global. Consultar limites reais no Console; a documentação atual separa cotas de search.list e de outros endpoints, portanto não codificar tabelas antigas sem revisão. Implementar cache de metadados com revalidação e monitor de cota. [R16]

Não basear produção em scraping de endpoints não documentados, yt-dlp, proxies rotativos ou download automático de audiovisual do YouTube. As políticas restringem essas práticas e também o armazenamento de audiovisual e sua disponibilização offline. O fallback de ASR recebe arquivo próprio/licenciado, não um download indireto disfarçado. [R17]

## 4.3. Estratégia de transcrição

Ordem recomendada: material textual/legenda fornecido legitimamente; legenda obtida com autorização do proprietário; Gemini com URL pública elegível; ASR de arquivo autorizado. Se nenhum caminho funcionar, manter o player e oferecer atividade independente do conteúdo, ou pedir outra fonte. Não inventar uma transcrição para manter o fluxo.

Cada transcrição registra `origin`, `source_revision`, `language`, `time_accuracy` e `quality_status`. Valores sugeridos de origem: `owner_caption`, `user_upload`, `licensed_text`, `gemini_video` e `authorized_audio_asr`. O rótulo 'verificada' exige um procedimento real; não basta o modelo declarar confiança alta.

Gemini Transcribe documenta timestamps por palavra e limite menor por requisição quando timestamps ou diarização estão habilitados. A referência atual indica até 30 minutos nessa configuração. Usar blocos menores, manter offsets absolutos e não assumir que esse endpoint aceita uma URL de página do YouTube como arquivo de áudio. [R18]

## 4.4. Gemini: APIs compatíveis

Usar a **Interactions API** como interface principal. A documentação a recomenda para novos projetos; `generateContent` continua suportada. Manter um adaptador separado de generateContent para Batch e cache explícito, que ainda não estão disponíveis em Interactions. Não misturar os nomes de campos entre essas interfaces. [R05]

Configurar modelos por registro de capacidades: modalidades, níveis de thinking, janela de contexto, saída máxima, suporte a schema, tipo de transporte e tabela de preço. A troca de modelo passa por teste de regressão, não por substituir uma string em produção.

O suporte a URLs do YouTube permanece em preview, descrito como sem cobrança pelo recurso e sujeito a mudanças. A documentação limita esse caminho a vídeos públicos, excluindo privados e não listados. Isso não transforma saídas, outras chamadas ou o aplicativo inteiro em gratuitos. Planejar custos sem depender desse benefício e confirmar a fatura com chamadas de teste. [R04]

## 4.5. Resolução e modo de análise

**Assistir em HD não obriga enviar todo o vídeo em alta resolução para a IA.** Manter qualidade visual no player e escolher a representação de análise por tarefa. Use texto para gramática e vocabulário; áudio para fala; visão alta para código pequeno, diagramas ou texto de slides. `resolution` e `processing` controlam aspectos diferentes. [R03]

| Tarefa | Representação proposta |
| --- | --- |
| Explicar uma expressão | Frase e contexto textual local. |
| Gerar quiz de compreensão | Segmentos validados e objetivos. |
| Encontrar um assunto em aula longa | Modo agentic, quando elegível. |
| Ler código em um ponto do vídeo | Trecho curto, static, alta resolução. |
| Transcrever fielmente para exercício literal | Fonte autorizada e validação; ASR quando disponível. |
| Responder a uma frase falada pelo aluno | Áudio curto, sem vídeo. |

O modo agentic pode reduzir tokens ao selecionar partes relevantes, mas não deve ser tratado como transcrição exaustiva garantida. Recortes e FPS personalizados são documentados para static; não combinar parâmetros incompatíveis. O ganho anunciado de 'até 88%' não entra como desconto garantido no orçamento. [R04]

Para extração detalhada, começar com blocos de 3-5 minutos, respeitando a janela de contexto e o limite de saída. Se houver sobreposição, usar poucos segundos nas fronteiras e deduplicar segmentos por tempo e conteúdo. Não processar um vídeo longo inteiro apenas porque cabe teoricamente na janela do modelo.

## 4.6. Geração pedagógica com contratos

Solicitar saída estruturada por JSON Schema. Isso ajuda a padronizar o formato, mas não garante verdade, qualidade pedagógica ou alinhamento temporal. Validar novamente no backend, incluindo invariantes que o schema não expressa. [R08]

Contrato de unidade: ID, idioma, objetivo, segmentos de origem, itens de vocabulário, atividades, respostas esperadas, explicações curtas e `needs_review`. Cada questão baseada no vídeo referencia segmentos concretos. Não pedir ao mesmo prompt uma transcrição de uma hora, tradução integral, cem flashcards e uma avaliação do aluno.

Regras de validação: intervalos ordenados e dentro da duração; frase citada presente na fonte; nenhuma questão sem evidência; exatamente uma resposta correta quando a atividade exige isso; alternativas distintas; idioma coerente; nenhum trecho marcado inaudível usado em ditado; limites de tamanho e quantidade.

Um trecho incerto pode oferecer resumo de assunto com aviso. Ele não deve gerar exercício de completar a palavra exata nem uma referência de pronúncia. Ao falhar validação, permitir no máximo uma tentativa de reparo pequeno; depois marcar para revisão ou trocar a atividade.

## 4.7. Tutor contextual

Compor o contexto com: instrução pedagógica curta, habilidade-alvo, objetivo profissional, frase selecionada, dois ou três segmentos vizinhos e resumo curto da conversa atual. Buscar mais somente quando a pergunta realmente precisar. Não enviar todo o histórico de vocabulário ou a transcrição inteira a cada clique.

O tutor explica um ponto de cada vez, oferece um exemplo novo e pede que o aluno produza uma frase. Por padrão, não informa a resposta antes da primeira tentativa. Quando a pergunta não puder ser sustentada pelo trecho, informa a limitação. Pode explicar conhecimento geral de inglês, identificando-o como explicação, não como fala do autor do vídeo.

Tratar transcrição e metadados como dados não confiáveis. Instruções embutidas em vídeo não podem alterar o papel do tutor ou acionar ferramentas. Não habilitar navegação web, execução de código ou ferramentas de escrita para tarefas que precisam apenas de linguagem.

## 4.8. Voz ao vivo e feedback

Começar com envio de gravações curtas. Para conversa ao vivo, Gemini Live oferece transporte e modelos específicos de interação audiovisual. Interrupções, reconexão, gestão de contexto e estados de microfone devem ser tratados como um subsistema próprio. [R19][R21]

Há duas topologias: navegador -> proxy autenticado -> Gemini; ou navegador -> Gemini com token efêmero emitido pelo backend. A segunda reduz intermediação, mas demanda validação de restrições, uso único, expiração e orçamento. Tokens efêmeros são específicos de Live e não justificam expor a API key principal. [R20]

Para a primeira versão com voz ao vivo e teto financeiro estrito, preferir proxy com controle de duração e fechamento do upstream. Estabelecer sessões curtas, pausa por inatividade e reserva de saldo antes de conectar. Medir efetivamente o áudio enviado e gerado; um temporizador apenas no navegador pode ser contornado.

## 4.9. Saídas incompletas, limites e persistência

`thinking_level` varia entre modelos. A referência atual aceita `minimal` em Flash-Lite, mas não em Flash 3.8. `max_output_tokens` inclui thinking e pode produzir resposta incompleta. Reduzir raciocínio quando apropriado e nunca persistir JSON truncado como atividade válida. [R09][R30]

As cotas de Gemini são aplicadas por projeto, não multiplicadas por criar várias chaves. Ler limites ativos no AI Studio, aplicar controle de concorrência e classificar 429 antes de reagendar. Repetição ilimitada transforma erro em custo e indisponibilidade. [R10]

Para extração e explicações independentes, preferir `store:false` e contexto curado do banco. Isso desativa o armazenamento de Interactions, mas não equivale a garantia universal de retenção zero. Conversas com `previous_interaction_id` exigem armazenamento e política específica; instruções e configurações precisam ser reenviadas a cada turno. [R05][R12]

Não editar blocos assinados de um histórico de conversa para economizar tokens. Quando resumir, iniciar uma nova interação com o resumo como dado, sem fingir continuar uma cadeia original intacta. Conteúdo, versões e resultados pedagógicos relevantes permanecem no banco da aplicação. [R09]


<a id="capitulo-5"></a>

# 5. Economia de tokens e orçamento

## 5.1. Base de cálculo

Preços verificados em **14 de setembro de 2026**, em USD, na Gemini Developer API. Não confundir com assinatura do aplicativo Gemini, NotebookLM, Vertex AI, impostos ou infraestrutura. A previsão usa preços Standard e ignora descontos de preview, cache, Batch e processamento agentic, para não depender de benefícios temporários. [R01]

| Modelo | Entrada / 1M tokens | Saída / 1M tokens |
| --- | --- | --- |
| Gemini 3.5 Flash-Lite | US$ 0,30 | US$ 2,50 |
| Gemini 3.8 Flash até 31/12/2026 | US$ 0,75 | US$ 3,75 |
| Gemini 3.8 Flash a partir de 01/01/2027 | US$ 1,50 | US$ 7,50 |

A saída faturável inclui thinking. A mudança programada de preço do Flash exige revisão do orçamento antes de 2027. Guardar a tabela de preços por data de vigência, não apenas o nome do modelo. [R01][R09]

Para planejamento de vídeo static a 1 FPS, a documentação estima aproximadamente 100 tokens/s em baixa resolução e 300 tokens/s em alta. Esses fatores são aproximações; o consumo real deve vir do uso retornado pela API. [R02]

```text
tokens_video_alta = horas_processadas * 3600 * 300
custo_entrada = tokens_entrada / 1_000_000 * preco_entrada
custo_saida = tokens_gerados / 1_000_000 * preco_saida
custo_planejado = (entrada + saida + tutor) * 1,25
```

Somente a entrada de 30, 40 e 50 horas em alta, no Flash-Lite, corresponde a aproximadamente US$ 9,72, US$ 12,96 e US$ 16,20. Isso ainda não inclui preparação textual, tutor, voz ou infraestrutura. Por isso um teto genérico de US$ 10 é otimista para o caso de processamento integral em alta resolução.

## 5.2. Hipóteses reproduzíveis

Para cada hora de vídeo processada, reservar 20.000 tokens gerados para transcrição/estrutura e preparação inicial, incluindo a parcela prevista de thinking. É um parâmetro de simulação, não uma quantidade fixa garantida por hora.

Para o tutor e atividades textuais do mês, usar 2 milhões de tokens de entrada e 500 mil gerados no Flash-Lite: US$ 1,85. Uma decomposição ilustrativa é 600 trocas com 2.500 tokens de entrada e 400 de saída cada, mais 500 mil de entrada e 260 mil gerados em outras tarefas. Acrescentar reserva operacional de 25% ao subtotal. A reserva não é teto nem garantia.

## 5.3. Cenários mensais

| Cenário de IA, sem voz | 30 h | 40 h | 50 h |
| --- | --- | --- | --- |
| Eficiente: texto autorizado já disponível + 10% de análise visual alta no Lite | US$ 3,72 | US$ 4,18 | US$ 4,65 |
| Integral: todo vídeo em alta no Lite | US$ 16,34 | US$ 21,01 | US$ 25,69 |
| Integral: vídeo em alta no Flash, tarifa de 2026; tutor Lite | US$ 35,50 | US$ 46,56 | US$ 57,63 |

Os valores já incluem saída prevista, tutor textual e 25% de reserva. O cenário eficiente **exige texto utilizável obtido legitimamente sem custo adicional**: não presume que qualquer vídeo público tenha uma API gratuita de legendas. Caso seja necessário pagar ASR ou processar todo o vídeo para obter texto, esse custo entra separadamente.

O modo agentic pode reduzir a análise em alguns casos, mas transcrição completa e perguntas detalhadas podem consumir mais que um resumo. A previsão não deduz uma porcentagem fixa por esse recurso. O arquivo `examples/calculadora-custos.mjs` reproduz os cenários e também simula a tarifa Flash de 2027.

## 5.4. Voz e outros custos

A tabela atual do Gemini 3.1 Flash Live Preview apresenta aproximações de US$ 0,005/min para entrada de áudio e US$ 0,018/min para saída de áudio. Em 5 horas de conversa com 150 minutos efetivamente enviados e 150 produzidos, a parcela de mídia seria cerca de **US$ 3,45**. Isso não é um preço all-inclusive por cinco horas de sessão: texto, contexto, repetições e padrão real de transmissão podem alterar o custo. [R01]

Como envelope inicial de projeto, reservar US$ 5-15 para cinco horas de voz e recalibrar com medição. Transcrição de arquivos, avaliação de pronúncia especializada e TTS adicional precisam de linhas próprias. Não cobrar duas vezes a mesma etapa: se o fluxo já produziu uma transcrição utilizável, não executar outro ASR sem motivo.

Recomendação financeira inicial: **US$ 30-45/mês de limite operacional para IA**, com Flash-Lite como padrão e voz moderada. Reservar, como verba de planejamento e não como cotação de fornecedor, mais US$ 15-30 para hospedagem, banco, armazenamento, logs e backups. Total de planejamento: US$ 45-75, antes de câmbio, impostos, domínio e serviços opcionais. Uso de Flash em todo o vídeo ou voz intensa exige ampliar ou restringir esse envelope.

## 5.5. Ordem de prioridade das economias

| Prioridade | Técnica | Como implementar |
| --- | --- | --- |
| 1 | Não chamar IA sem necessidade | Revisão, XP, navegação e cálculos no código. |
| 2 | Reusar resultados prontos | Persistir traduções, unidades e explicações por versão. |
| 3 | Texto antes de vídeo | Enviar somente evidências locais para tutor e exercícios. |
| 4 | Trechos e resolução por tarefa | Alta apenas quando detalhes visuais forem necessários. |
| 5 | Geração sob demanda | Preparar o bloco atual e, no máximo, o próximo. |
| 6 | Saída curta e estruturada | Uma habilidade, poucos itens, limites compatíveis com thinking. |
| 7 | Roteamento de modelos | Lite primeiro; promover por evidência de falha, não sempre. |
| 8 | Batch para tarefas não urgentes | Pré-geração autorizada e avaliação, fora da navegação. |
| 9 | Cache de contexto sob medição | Usar somente quando houver reutilização real. |

O Batch é documentado a 50% do custo Standard, com processamento assíncrono e prazo-alvo de 24 horas, não resposta imediata. Atualmente usa generateContent. A criação de job Batch não é idempotente: guardar o identificador e não reenviar cegamente após timeout. [R07]

## 5.6. Três caches diferentes

**Cache de resultado:** texto e atividade já preparados no banco. É a principal economia e não cobra tokens de inferência ao reler. **Cache implícito do provedor:** desconto quando um prefixo repetido elegível encontra cache; não é garantido. **Cache explícito:** objeto de contexto com custo de armazenamento e leitura; exige análise financeira e adaptador generateContent. [R06]

Prefixos estáveis e contexto comum no início favorecem reutilização. Não inserir timestamps aleatórios na parte estável, nem aumentar artificialmente um prompt apenas para atingir o tamanho mínimo de cache. Medir taxa de acerto e custo total.

Exemplo de armadilha: a US$ 1 por milhão de tokens por hora de armazenamento, manter 20 mil tokens em cache explícito por 30 dias custa **US$ 14,40 apenas para guardar**. Reenviar esses 20 mil tokens vinte vezes no Lite custaria aproximadamente US$ 0,12 de entrada. Nesse padrão de uso, o cache explícito é pior. Considerar ainda custo de criação e leituras com desconto. [R01]

## 5.7. Contexto e observabilidade

Limitar o perfil do aluno aos campos necessários: habilidade, objetivo e erros relevantes. Não mandar milhares de palavras conhecidas. Buscar exemplos por IDs e intervalos; resumir conversas encerradas uma vez; iniciar novo contexto quando apropriado. Não confundir menos bytes de rede com menos tokens faturados em conversa stateful.

Registrar por chamada: usuário, finalidade, fornecedor, modelo/configuração, versão do preço, tokens de entrada, cache, saída, thinking e uso de ferramentas, latência, request ID, resultado e custo estimado. Manter os dados brutos de uso, sem conteúdo sensível, para reconciliar. Categorias podem ter sobreposição na resposta: o adaptador precisa normalizá-las antes de somar, especialmente cache e ferramentas. [R02]

Separar custo previsto, reservado e confirmado. Comparar o livro-razão local com a fatura do provedor; não apresentar a estimativa local como cobrança final.

## 5.8. Barreiras financeiras

Antes da chamada, executar reserva atômica: saldo disponível = limite - gasto conciliado - reservas ativas. Negar a operação se o pior caso permitido, somado a uma margem, exceder o saldo. Liberar sobra após medir uso; manter uma reserva pendente em timeout ambíguo. Restringir concorrência, duração de mídia, quantidade de arquivos e saída máxima.

Configuração inicial proposta: alerta interno em US$ 25; bloqueio de novas chamadas em US$ 40; reserva de contingência fora do saldo de uso. Ao atingir o limite, biblioteca pronta e revisões continuam disponíveis. Novas análises e voz ficam pausadas, com explicação transparente.

Habilitar também o spend cap de projeto no AI Studio quando disponível. O recurso é experimental e a documentação informa latência e possibilidade de excedente, inclusive com tarefas longas. Ele complementa, não substitui, o controle da aplicação. Alertas comuns de Cloud Billing, por sua vez, não bloqueiam automaticamente gastos. [R11][R29]


<a id="capitulo-6"></a>

# 6. Segurança, direitos e qualidade

## 6.1. Fronteiras de segurança

Credenciais principais ficam somente no servidor, em secret manager ou variáveis protegidas. Nunca usar prefixo público de frontend para a chave Gemini. Separar ambientes, restringir APIs permitidas, rotacionar chaves e impedir que logs capturem cabeçalhos, tokens efêmeros ou URLs assinadas.

Todo endpoint verifica autenticação, propriedade do recurso e limites. Usar cookies seguros, proteção CSRF quando aplicável, CORS restritivo e cabeçalhos de segurança. Adicionar limites por usuário e projeto, não apenas por IP. O controle de custo precisa estar antes de qualquer inferência.

Validar URLs por parser e lista exata de hosts; extrair apenas o ID do YouTube e reconstruir uma URL canônica. Não fazer fetch de URLs arbitrárias enviadas pelo cliente. Em upload, verificar tamanho, tipo real, duração, dono e integridade, além de sanitizar nomes. Transcodificação de arquivos autorizados roda em sandbox com limites de CPU, memória e tempo.

Respostas de IA e legendas são dados não confiáveis. Renderizar texto ou Markdown sanitizado, nunca HTML livre. Os modelos não recebem acesso a credenciais, execução de código ou ferramentas de escrita para tarefas de aprendizado. Instruções maliciosas dentro de vídeos não têm autoridade sobre o sistema.

## 6.2. Privacidade e retenção

O aluno deve entender quando sua voz é gravada, para qual provedor é enviada, por quanto tempo fica armazenada e como excluí-la. Não gravar em segundo plano. Ao parar a atividade, encerrar as tracks do microfone e a conexão de voz.

A política do Gemini diferencia serviços pagos e gratuitos. Para gravações pessoais e uso regular, preferir configuração paga compatível com as necessidades de privacidade, verificando termos aplicáveis. 'Não usado para melhorar produtos' não significa 'nenhum armazenamento ou monitoramento'. [R12]

Política interna proposta: áudio bruto por 7 dias, com opção explícita para preservar amostras de progresso; conversas brutas por 30 dias; resumos pedagógicos até exclusão da conta; backups com ciclo de 30 dias. Esses prazos são decisões de produto a validar, não exigências legais universais.

Implementar exportação e exclusão de dados, incluindo objetos, cache, interações armazenadas no provedor quando aplicável e fila de jobs. Evitar que um job pendente recrie dados após exclusão; usar estado de conta e tombstone. Documentar a expiração residual de backups. Antes de abrir a terceiros, revisar obrigações de privacidade e proteção de dados com orientação adequada.

## 6.3. Direitos de conteúdo

Fonte pública não equivale a licença para redistribuir transcrições, copiar audiovisual ou construir um catálogo comercial. O produto deve registrar origem, escopo permitido, autorização e revisão. O suporte técnico de uma API a uma URL não resolve automaticamente todas as permissões do uso pretendido.

Para reduzir risco, o primeiro piloto usa conteúdo próprio/licenciado e URLs elegíveis dentro das condições aplicáveis. Exibir autoria e acesso ao original, não exportar por padrão transcrições integrais de terceiros, nem compartilhar materiais entre usuários sem direito confirmado. Uma futura comercialização exige revisão específica do fluxo.

Manter metadados do YouTube separados de evidências pedagógicas próprias. Criar rotina de revalidação e expiração compatível com as políticas de armazenamento, incluindo as regras de 30 dias quando aplicáveis. Retirar fontes indisponíveis sem apagar indevidamente o histórico pessoal legítimo. [R17]

## 6.4. Validação pedagógica

Criar um conjunto de referência com 12-20 trechos autorizados: fala clara, sotaques diferentes, código na tela, slides, conversa espontânea e áudio com ruído. Produzir referências humanas para fala, intervalos e atividades. Testar combinações de modelo, resolução e prompt nas mesmas amostras.

| Camada | Teste | Critério inicial de aceitação |
| --- | --- | --- |
| Transcrição | Comparar palavras com referência humana e revisar termos técnicos. | Meta de WER até 10% em fala limpa; fora disso, não liberar atividades literais automaticamente. |
| Timestamp | Comparar limites de fala em amostra revisada. | Meta de erro até 750 ms em 95% dos segmentos, ou rotular tempo aproximado. |
| Exercícios | Revisar 100 itens gerados. | Zero erro grave e pelo menos 95% utilizáveis; corrigir antes de publicar. |
| Evidência | Verificar citação de origem e intervalos. | 100% dos itens que alegam vir da fonte têm referência válida. |
| Feedback oral | Comparar rubrica com avaliação humana. | Ajustar por divergência; nunca usar nota única como certificação. |
| Aprendizado | Reaplicar tarefa paralela após intervalo. | Evolução em autonomia, não só acerto no mesmo item. |

Os números acima são gates propostos para o piloto, não precisão já alcançada. Um bom WER global pode esconder erro justamente na palavra-alvo. Por isso exercícios literais exigem validação local. Comparar texto com uma transcrição errada não comprova fidelidade ao áudio.

## 6.5. Testes de engenharia

Testes unitários cobrem normalização de URL, parsing de legenda, validação temporal, deduplicação, concessão de XP, atualização de revisão e cálculo de custos. Testes de contrato usam respostas gravadas e anonimizadas dos provedores. Testes de integração cobrem transações, fila, migrações e permissões.

Cenários obrigatórios: refresh durante preparo; falha após inferência; request duplicado; duas abas respondendo à mesma revisão; vídeo removido; legenda ausente; resultado truncado; prompt injection; microfone negado; payload excessivo; token vencido; saldo esgotado com jobs em andamento; modelo descontinuado; exclusão com job pendente.

Testes de interface cobrem navegação sem reset do player, retomada de estado, teclado, leitor de tela, responsividade e interrupção de rede. Realizar testes em navegador móvel real: suporte a formato de gravação, permissões e reprodução varia. Não assumir um único container de áudio para todos os clientes.

## 6.6. Observabilidade e resposta a falhas

Painel operacional: custo por tarefa, tokens por hora preparada, falhas de transcrição, itens rejeitados, taxa de cache de resultado, retries, fila, p95 do tutor e minutos de voz. Separar qualidade pedagógica de desempenho técnico. Uma resposta rápida e incorreta é falha.

Alertas internos: crescimento anormal de gasto; aumento de 429/5xx; excesso de jobs com resultado desconhecido; regressão de schema; degradação da validação. Circuit breaker suspende novas chamadas ao fornecedor com problema e preserva revisões locais. Rollback de prompt e modelo deve ser independente do deploy da interface.

Todo erro apresentado ao aluno oferece uma ação útil: tentar depois, usar conteúdo já preparado, praticar com material independente ou trocar a fonte. Não afirmar que uma resposta foi salva ou avaliada quando o processamento falhou.


<a id="capitulo-7"></a>

# 7. Roadmap, backlog e decisões

## 7.1. Construir por resultados verificáveis

Não começar pelo avatar, sistema de ligas ou animações. O primeiro incremento precisa provar que uma fonte gera uma atividade correta e que a atividade produz fala do aluno. Cada etapa abaixo termina em um critério de saída, não apenas em telas concluídas.

| Etapa | Entrega | Critério de saída |
| --- | --- | --- |
| 0. Prova técnica | Fontes autorizadas, chamadas reais, qualidade e medição de custo. | Capturar uso real; validar transcrição e fallback; escolher modelo com evidência. |
| 1. Caminho vertical | Login, fonte, trecho, atividade, gravação e feedback. | Uma sessão completa sem operação manual no banco. |
| 2. Memória e rotina | Cartões, FSRS, Hoje e retomada de sessão. | Revisões consistentes entre dispositivos e após reconexão. |
| 3. Jornada | XP idempotente, personagem, habilidades e desafio semanal. | Conquistas com evidências, sem incentivo por visualização. |
| 4. Conversa ao vivo | Live, interrupção, controle de gasto e reconexão. | Sessão fluida sem chave exposta e com limite aplicado no servidor. |
| 5. Expansão | Conteúdo adicional, outros usuários ou idiomas. | Revisão de direitos, isolamento e evidência de valor no uso pessoal. |

## 7.2. Escopo do MVP utilizável

Incluir login restrito, importação por URL ou fonte autorizada, player, texto segmentado com proveniência, tradução sob demanda, explicação contextual, atividade curta, gravação oral, cartões aprovados pelo usuário, revisão, progresso básico e painel de custo. O desenho modular permite entregar primeiro uma fatia menor e completar o conjunto sem reescrever.

Ficam fora: marketplace de cursos, assinatura e pagamentos, app nativo, multiplayer, rankings globais, avatar 3D, geração de vídeos, fine-tuning, importador universal de qualquer site e transcrição infalível. Conversa ao vivo e pronúncia fonética detalhada não bloqueiam a primeira versão.

## 7.3. Backlog priorizado

| ID | Item | Aceitação |
| --- | --- | --- |
| FQ-01 | Registro de provedores e preços | Modelos e tarifas versionados, sem alias silencioso. |
| FQ-02 | Guarda de orçamento | Chamadas concorrentes não excedem saldo reservado pela aplicação. |
| FQ-03 | Fonte e metadados | URL canônica, validação, estado de direitos e indisponibilidade. |
| FQ-04 | Importação assíncrona | Refresh não duplica preparo; estado parcial utilizável. |
| FQ-05 | Contrato de transcrição | Segmentos versionados e intervalos inválidos rejeitados. |
| FQ-06 | Gerador de atividade | Schema válido e evidência; conteúdo incerto não vira ditado. |
| FQ-07 | Sala de estudo | Troca de painel não recria o player; contexto preservado. |
| FQ-08 | Tutor de trecho | Usa contexto local e não reenvia vídeo inteiro. |
| FQ-09 | Resposta oral curta | Permissão explícita, feedback e exclusão da gravação. |
| FQ-10 | Cartões e FSRS | Itens confirmados, sem duplicidade e revisão idempotente. |
| FQ-11 | Evidências e progresso | Acerto, autonomia e ajuda armazenados separadamente. |
| FQ-12 | XP e jornada | Zero XP por YouTube; concessão única por atividade. |
| FQ-13 | Observabilidade e avaliação | Custos, latências e qualidade comparáveis por versão. |
| FQ-14 | Exportação e exclusão | Remove dados e impede recriação por jobs pendentes. |
| FQ-15 | Live controlado | Duração, autenticação, interrupção e custo testados. |

Dependências: FQ-01/02 precedem chamadas pagas; FQ-03/05 precedem FQ-06; FQ-06/09/10 alimentam FQ-11; FQ-11 precede a gamificação de domínio; FQ-15 depende de medição e controle financeiro funcionando. O backlog não exige terminar toda a biblioteca antes de praticar fala com material próprio.

## 7.4. Plano de piloto

Selecionar fontes que o aluno realmente queira consumir e que representem as condições esperadas. Comparar Lite e Flash, texto e visão, resolução baixa e alta apenas nas tarefas relevantes. Registrar qualidade humana, tokens reais, latência e custo por unidade utilizável, não apenas por chamada.

Após um conjunto inicial de sessões, revisar: houve fala em vez de só consumo? O aluno voltou voluntariamente? A fila de revisão coube no tempo disponível? O tutor corrigiu com consistência? Os custos ficaram dentro do envelope? O produto ajudou mais que uma combinação simples de player, tutor e flashcards?

Manter um diário curto de fricções. Corrigir navegação e qualidade antes de ampliar funcionalidades. Só abrir acesso a terceiros quando os fluxos de direitos, exclusão, isolamento e custo estiverem testados.

## 7.5. Registro de decisões arquiteturais

| ADR | Decisão | Motivo e condição de revisão |
| --- | --- | --- |
| 001 | Monólito modular | Baixo custo operacional; separar serviços apenas com necessidade medida. |
| 002 | Playback fora do pipeline de IA | Manter HD sem impor análise visual integral. |
| 003 | Fontes autorizadas e fallback explícito | Evitar dependência de scraping e transcrição inventada. |
| 004 | Interactions + adaptador generateContent | Usar interface recomendada sem fingir suporte a Batch/cache explícito. |
| 005 | Cache de resultado primeiro | Reutilização sem retenção cara de contexto ocioso. |
| 006 | Speaking assíncrono no MVP | Atender o objetivo de conversa sem complexidade inicial de Live. |
| 007 | XP separado de proficiência | Evitar gamificação enganosa e incentivo por visualização. |
| 008 | Controle local + barreiras do provedor | Custos e alertas externos podem chegar com atraso. |

## 7.6. Definição de pronto

Uma entrega está pronta quando o fluxo funciona, foi testado nos estados de falha, preserva permissões, registra custo, não quebra acessibilidade e oferece valor pedagógico verificável. Prompts, esquemas e modelos utilizados devem estar identificados. Mudança de modelo é mudança de comportamento e merece regressão.

Para este projeto, **um trecho, uma expressão, uma resposta falada e uma revisão futura** formam uma primeira fatia melhor que vinte telas vazias. O jogo deve reforçar esse ciclo, não adiá-lo.

## 7.7. Uso do pacote de documentação

Os documentos `docs/` podem ser versionados no repositório. `DOCUMENTACAO_COMPLETA.md` consolida a leitura. `examples/` contém calculadora e exemplos de integração, não um aplicativo pronto. A calculadora tem testes locais; os exemplos de fornecedor precisam de credenciais, integração com autenticação/orçamento e validação real antes de produção.

Brief para iniciar a implementação: 'Construa primeiro a fatia FQ-01 a FQ-06 com uma fonte autorizada. Preserve contratos de proveniência e não use scraping. Antes de integrar uma chamada paga, implemente reserva de orçamento e captura de uso. Teste falhas e duplicidade. Só então conecte sala de estudo, gravação e revisão. Não implemente recursos fora do MVP sem demonstrar necessidade'.


<a id="capitulo-8"></a>

# 8. Referências e revisão

Consulta: **14 de setembro de 2026**. Preços, recursos em preview, cotas e contratos devem ser revistos antes da implementação e de cada mudança de fornecedor. Os identificadores [R01]-[R31] nos capítulos remetem às fontes primárias abaixo. As metas de produto, UX, qualidade, verba de infraestrutura e regras de XP são propostas de projeto, não resultados comprovados.

**[R01]** [Google - Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)

**[R02]** [Google - Tokens and multimodal tokenization](https://ai.google.dev/gemini-api/docs/tokens)

**[R03]** [Google - Media resolution](https://ai.google.dev/gemini-api/docs/media-resolution)

**[R04]** [Google - Video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)

**[R05]** [Google - Interactions API overview](https://ai.google.dev/gemini-api/docs/interactions-overview)

**[R06]** [Google - Context caching](https://ai.google.dev/gemini-api/docs/caching)

**[R07]** [Google - Batch API](https://ai.google.dev/gemini-api/docs/batch-api)

**[R08]** [Google - Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)

**[R09]** [Google - Thinking](https://ai.google.dev/gemini-api/docs/thinking)

**[R10]** [Google - Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

**[R11]** [Google - Billing and project spend caps](https://ai.google.dev/gemini-api/docs/billing)

**[R12]** [Google - Gemini API additional terms](https://ai.google.dev/gemini-api/terms)

**[R13]** [YouTube - IFrame Player API reference](https://developers.google.com/youtube/iframe_api_reference)

**[R14]** [YouTube - videos.list](https://developers.google.com/youtube/v3/docs/videos/list)

**[R15]** [YouTube - captions.download](https://developers.google.com/youtube/v3/docs/captions/download)

**[R16]** [YouTube - Quota costs](https://developers.google.com/youtube/v3/determine_quota_cost)

**[R17]** [YouTube - API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

**[R18]** [Google - Gemini 3.5 Transcribe](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-transcribe)

**[R19]** [Google - Live API](https://ai.google.dev/gemini-api/docs/live-api)

**[R20]** [Google - Live API ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)

**[R21]** [Google - Live API session management](https://ai.google.dev/gemini-api/docs/live-api/session-management)

**[R22]** [Microsoft - Pronunciation Assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)

**[R23]** [Open Spaced Repetition - ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)

**[R24]** [Karpicke e Roediger (2008) - The critical importance of retrieval for learning. Science. DOI: 10.1126/science.1152408](https://pubmed.ncbi.nlm.nih.gov/18276894/)

**[R25]** [Council of Europe - CEFR descriptors](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors)

**[R26]** [pg-boss - PostgreSQL-backed job queue](https://github.com/timgit/pg-boss)

**[R27]** [W3C - WCAG 2.2, Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

**[R28]** [W3C - WCAG 2.2, Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

**[R29]** [Google Cloud - Budgets and budget alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets)

**[R30]** [Google - Gemini 3.8 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)

**[R31]** [Google - Gemini 3.5 Flash-Lite model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
