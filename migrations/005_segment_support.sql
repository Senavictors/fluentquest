-- O apoio de estudo de um trecho deixa de ser um texto único em Markdown e
-- passa a ser um objeto com quatro campos (tradução, ponto, exemplo, pergunta),
-- para que a interface possa hierarquizá-los em vez de imprimir um parágrafo.
-- `translation` é preservada: as linhas antigas continuam legíveis como texto
-- corrido até serem regeneradas, e regenerar custa uma chamada de IA.
ALTER TABLE segments
  ADD COLUMN IF NOT EXISTS support jsonb;
