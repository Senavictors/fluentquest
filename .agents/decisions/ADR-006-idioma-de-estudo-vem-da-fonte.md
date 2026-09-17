---
id: ADR-006
title: O idioma de estudo é propriedade da fonte, não do perfil; o perfil guarda só a língua de explicação
status: accepted
date: 2026-09-17
---

# ADR-006 — O idioma de estudo é propriedade da fonte, não do perfil; o perfil guarda só a língua de explicação

## Contexto

Levantamento pedido pelo proprietário em 17/09/2026: o produto estuda inglês e explica em português (BR), e isso não é configuração — é contrato.

O que trava, especificamente:

- `sourceInput.language` e `cardInput.language` em `src/domain/content.ts` são `z.enum(["en-US","en-GB"])`.
- `src/client/Study.tsx` envia `language: "en-US"` fixo ao criar qualquer fonte; o campo nunca é perguntado.
- O perfil tem `englishVariant`, não "idioma de estudo".
- Os três prompts de `src/server/providers.ts` nomeiam os idiomas no texto: `"English practice tutor… Explain in Portuguese"`, `"in natural Brazilian Portuguese"` mais `"one NEW English sentence"`, e `"Transcribe the spoken English faithfully"`.
- `normalize()` usa `toLocaleLowerCase("en")` — e é aplicada tanto à expressão (idioma de estudo) quanto ao significado (português).
- `Practice.tsx` alterna `lang` entre `pt-BR` e `en` na marra.

O que **não** trava: o banco. `sources.language` e `cards.language` são `text`, e a chave única de cartão já é `(user_id, language, normalized_expression, normalized_meaning, mode)` — o schema foi desenhado para mais de um idioma desde a migração 001. Quem recusa é o Zod, o prompt e a tela.

Descoberta do levantamento: `learner_profiles.locale` existe desde a 001 com default `pt-BR` e **nunca é lido nem escrito** por nenhum código — aparece só no espelho de `src/server/schema.ts`. É exatamente a coluna que a língua de explicação precisa.

## Decisão

**O idioma de estudo é propriedade da fonte. O perfil guarda só a língua de explicação.**

- `sourceInput.language` deixa de ser enum de inglês e passa a aceitar uma lista fechada de idiomas suportados, declarada uma vez em `src/domain/content.ts`. O formulário de importação pergunta o idioma; deixa de existir `language: "en-US"` fixo no cliente.
- O cartão herda o idioma da fonte de origem. A coluna e a chave única já existem, então nenhum dado precisa ser migrado.
- A língua de explicação vai para `learner_profiles.locale`, a coluna morta que já está lá. `english_variant` permanece, rebaixada a preferência de variedade **quando** a fonte é inglês — não é o seletor de idioma.
- Os três prompts recebem os nomes dos idiomas por parâmetro, e a versão de prompt sobe junto: um prompt parametrizado não é o mesmo prompt, e o `result_cache` precisa enxergar isso.
- `normalize()` passa a receber o idioma, porque hoje ela aplica regra de inglês ao significado em português. Na prática só muda resultado em idioma com casing próprio (turco `İ`), mas aplicar a regra errada de propósito é dívida, não simplificação.
- **Idioma sem conteúdo autoral entra sem conteúdo autoral.** O pacote de exemplo (`src/server/example.ts`), os cinco cenários de prática e a questão de diagnóstico existem só em inglês, e a tela diz isso em vez de esconder. Nada é gerado por IA para preencher esse espaço.
- Revisar mistura idiomas por padrão, com filtro opcional por idioma. O baralho é um só; a chave única já impede colisão entre idiomas.

## Alternativas consideradas

- **Par de idiomas no perfil, um por vez.** Menor mudança: uma migração, um parâmetro nos prompts, um seletor no Onboarding. Rejeitada por criar uma segunda fonte de verdade do idioma, em contradição com um schema que já guarda `language` na fonte e no cartão — e por impedir estudar dois idiomas ao mesmo tempo, sem que nada no banco exigisse essa limitação.
- **Fatiar: abrir contrato e prompts agora, tela depois.** Entrega pequena, reversível e sem custo de QA de acessibilidade. Rejeitada porque a fase 1 não entrega nada visível e adia justamente a decisão difícil — capacidade sem interface tende a apodrecer sem ninguém perceber que apodreceu.
- **Gerar o conteúdo autoral por IA, marcado como não revisado.** Desbloquearia qualquer idioma na hora. Rejeitada: o pacote de exemplo é o material que o produto apresenta como seu, e trocá-lo por texto fabricado é da mesma família do que a Constituição proíbe em avaliação. A marca de "não revisado" serve para transcrição de material real do proprietário, não para inventar o material.
- **Escrever conteúdo autoral por idioma antes de liberar cada um.** Preserva a qualidade. Adiada, não descartada: trava cada idioma novo num trabalho de escrita do proprietário, e o levantamento não mostrou que o pacote de exemplo seja pré-requisito para estudar — ele é atalho de primeiro uso.

## Consequências

- Estudar mais de um idioma ao mesmo tempo passa a ser possível sem migração de dados: o schema já suportava.
- `difficulty` (A1–C1) do perfil fica ambíguo — nível em qual idioma? Esta decisão **não** resolve isso; mantém o campo como está, declaradamente global e escolhido pelo proprietário, e registra a ambiguidade como pendência. Resolver exigiria nível por idioma, que é outra decisão.
- A versão de prompt sobe, então o `result_cache` existente daquele escopo deixa de ser aproveitado. É o comportamento correto: resposta gerada sob outro prompt não é a mesma resposta.
- `videoTranscript.language` já volta do provedor como texto livre. Com idioma declarado na fonte, passa a existir com o que comparar — divergência entre declarado e detectado vira sinal utilizável, não ruído.
- Cada idioma novo entra sem pacote de exemplo, sem cenários de prática e sem diagnóstico. A tela precisa dizer isso; esconder seria a versão silenciosa do mesmo problema.
- `english_variant` vira preferência condicional. Manter o nome da coluna evita migração de dados, ao custo de um nome que já não descreve o que a coluna faz — anotado de propósito, não esquecido.
