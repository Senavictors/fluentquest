// TASK-021 / ADR-009: catálogo LRCLIB simulado para o QA de navegador.
// Carregado com `--import` só no servidor que `scripts/qa-isolated.ts` sobe:
// todo `fetch` para lrclib.net recebe resposta daqui e nunca sai para a rede;
// qualquer outro host passa direto. As letras são autorais, escritas para o
// teste — nunca letra real.
const records = {
  9001: {
    id: 9001,
    trackName: "Green Build",
    artistName: "The Linters",
    albumName: "Fixtures",
    duration: 12,
    instrumental: false,
    plainLyrics:
      "The build is green again\nShip it before lunch\nNobody touch the cache",
    syncedLyrics:
      "[00:01.50] The build is green again\n[00:04.00] Ship it before lunch\n[00:07.25] Nobody touch the cache\n[length:00:12.00]",
  },
  9002: {
    id: 9002,
    trackName: "Green Build (Acoustic)",
    artistName: "The Linters",
    albumName: null,
    duration: 14.6,
    instrumental: false,
    plainLyrics: "The build is green again\nShip it before lunch",
    syncedLyrics: null,
  },
  9003: {
    id: 9003,
    trackName: "Green Build (Instrumental)",
    artistName: "The Linters",
    albumName: "Fixtures",
    duration: 12,
    instrumental: true,
    plainLyrics: null,
    syncedLyrics: null,
  },
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.hostname !== "lrclib.net") return realFetch(input, init);
  if (url.pathname === "/api/search")
    return Response.json(Object.values(records));
  const id = /^\/api\/get\/(\d+)$/.exec(url.pathname)?.[1];
  return id && records[id]
    ? Response.json(records[id])
    : new Response("{}", { status: 404 });
};
