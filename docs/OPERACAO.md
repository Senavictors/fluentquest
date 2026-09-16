---
estado: real
fonte: package.json, scripts/backup.ts, scripts/restore.ts, src/worker.ts
ultima-revisao: 2026-09-15 (TASK-008; metadados documentais)
---

# Operação local

## Processos e arquivos

`npm run dev` inicia web e worker. PostgreSQL já roda como serviço do Windows. O app fica em `http://localhost:3215`. Segredos ficam em `.env.local`, `.env.owner` e, para operações administrativas, `.env.setup`; todos ignorados pelo Git. Não inclua esses arquivos ao compartilhar o código.

`data/objects` contém mídia privada. `data/tmp` recebe arquivos temporários de inspeção e é limpo após cada validação. Nunca exponha essas pastas por servidor estático.

## Backup e restauração

1. Encerre web e worker para um backup consistente entre banco e arquivos.
2. Execute `npm run backup`.
3. O comando cria `backups/<data>/database.dump`, os objetos e um manifesto. Remove apenas backups desse diretório com mais de 30 dias.
4. Guarde uma cópia protegida em outro dispositivo. O MVP fornece execução manual; não foi criada tarefa agendada do Windows.
5. Para testar restauração, execute `npm run restore -- backups/<data>`.

A restauração usa um banco separado, `fluentquest_restore`, e a pasta `data-restore`. Recusa sobrescrever esse banco se ele já existe. O banco ativo não é apagado. Valide os dados antes de decidir mudar `DATABASE_URL` e `DATA_DIR`.

Um teste de restauração foi realizado em 14/09/2026. A cópia de verificação fica separada do banco ativo. Credenciais não fazem parte do backup; guarde `.env.local` de forma protegida para manter acesso e configuração.

## Retenção e exclusão

Com o worker ligado, a manutenção roda a cada 15 segundos: apaga gravações expiradas não preservadas, conversas antigas e conclui pedidos de exclusão. Quando o computador está desligado, a limpeza ocorre na próxima inicialização do worker.

Excluir a conta cancela jobs e revoga sessões imediatamente. Um tombstone impede novos jobs/resultados daquela conta. Backups podem conter dados anteriores até o prazo de 30 dias; a remoção de backups antigos ocorre ao executar o próximo backup. Não restaure um backup antigo como forma de desfazer uma exclusão sem revisar essa consequência.

## Falhas e recuperação

- Sem chave de IA: estudar material próprio, gravar e revisar continuam disponíveis.
- Sem transcrição: reproduzir a fonte ou usar um cenário independente; adicionar SRT/VTT autorizado.
- Sem PostgreSQL: a interface mostra erro e opção de tentar novamente; nenhum estado é anunciado como salvo.
- Job interrompido: após dez minutos sem atualização, fica em revisão. Inferência externa não é repetida cegamente.
- Custo desconhecido: reserva permanece em estado `unknown` até conciliação administrativa. Verifique o fornecedor antes de liberar saldo.
- 429 ou indisponibilidade: tente depois. Três resultados ambíguos recentes suspendem novas inferências por dez minutos.
- Permissão de microfone negada: habilite no navegador ou envie resposta escrita. Microfone fecha ao parar ou sair da tela.

## Diagnóstico

O terminal identifica erros por código e requestId sem imprimir credenciais ou gravações. Consulte `jobs`, `job_events`, `budget_reservations` e `usage_events` no banco exclusivo do projeto para investigação. Estado de UX vem de dados persistidos; não há porcentagem fictícia de preparo.

Na sandbox do Codex deste computador, `os.userInfo()` falha em algumas ferramentas Node. A validação usou um preload em `Documents/Codex/2026-09-14/cr/work/runtime-compat.cjs` para essa consulta opcional de identidade. Esse contorno pertence ao ambiente de testes e não é necessário em um terminal normal do Windows; o código do produto não depende dele.
