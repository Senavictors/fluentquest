-- Até aqui a única forma de registrar uma chave de provedor era editar
-- `.env.local` e reiniciar web e worker. Numa instalação de proprietário único
-- isso significa que trocar uma chave exige sair do aplicativo, mexer em arquivo
-- e derrubar dois processos — e a tela de Integrações só sabia dizer
-- "não configurado", sem oferecer o caminho.
--
-- A chave fica cifrada em repouso (AES-256-GCM, chave derivada de
-- BETTER_AUTH_SECRET) porque o banco entra no backup de `scripts/backup.ts`, e
-- um dump com credencial em texto puro transforma cópia de segurança em
-- vazamento. `hint` guarda só os quatro últimos caracteres: é o que a interface
-- mostra para o proprietário reconhecer qual chave está lá sem nunca devolver o
-- segredo pela API.
--
-- A variável de ambiente continua válida e vira fallback: quem já tem
-- `.env.local` funcionando não precisa recadastrar nada.
CREATE TABLE IF NOT EXISTS integration_credentials (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('gemini','openai','youtube')),
  ciphertext text NOT NULL,
  iv text NOT NULL,
  tag text NOT NULL,
  hint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, provider)
);
