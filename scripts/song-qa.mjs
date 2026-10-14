// TASK-021 / ADR-009: QA da aba "Música". Roda por scripts/qa-isolated.ts,
// com o servidor ligado ao LRCLIB simulado (scripts/qa-lrclib-fixture.mjs).
// Cobre teclado, rótulos de origem, catálogo desligado, axe e overflow em
// 1440/390, claro/escuro.
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
if (!process.env.FQ_QA_PASSWORD)
  throw new Error("Execute por scripts/qa-isolated.ts");
const base = "http://localhost:3215";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.EDGE_PATH ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const results = [];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const scan = async (label, theme, width) => {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".youtube-host iframe")
    .analyze();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  results.push({ label, theme, width, violations: axe.violations, overflow });
};
const openSongTab = async () => {
  await page.goto(`${base}/biblioteca`);
  await page.locator(".page").waitFor();
  await page.getByRole("button", { name: "Adicionar conteúdo" }).click();
  const tab = page.getByRole("button", { name: "Música", exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-pressed", "true");
};
let sourceUrl = "";
try {
  await page.goto(base);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.FQ_QA_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.locator(".page").waitFor();
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/configuracoes`);
    await page
      .getByRole("button", {
        name: theme === "light" ? "Claro" : "Escuro",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (value) => document.documentElement.dataset.theme === value,
      theme,
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await openSongTab();
      // Título e autor vêm do catálogo: os campos digitados somem nesta aba.
      await expect(page.getByLabel("Título", { exact: true })).toHaveCount(0);
      const search = page.getByLabel("Buscar música");
      await search.fill("green build");
      await expect(page.getByText("3 versões encontradas.")).toBeVisible();
      // RN-01: instrumental aparece, mas desabilitado.
      await expect(
        page.getByRole("radio", { name: /Green Build \(Instrumental\)/ }),
      ).toBeDisabled();
      await expect(page.getByText("Letra sincronizada")).toBeVisible();
      await expect(page.getByText("Só texto, sem tempo")).toBeVisible();
      await expect(
        page.getByText("The Linters · Fixtures · 0:12").first(),
      ).toBeVisible();
      // CA-01: teclado. Space marca, seta passa para a próxima versão
      // habilitada, sem cair no instrumental.
      const first = page.getByRole("radio", { name: /^Green Build The/ });
      await first.focus();
      await page.keyboard.press("Space");
      await expect(first).toBeChecked();
      await page.keyboard.press("ArrowDown");
      await expect(
        page.getByRole("radio", { name: /Green Build \(Acoustic\)/ }),
      ).toBeChecked();
      await page.keyboard.press("ArrowUp");
      await expect(first).toBeChecked();
      await scan("musica-resultados", theme, width);
      await page.screenshot({
        path: `.impeccable/review/song-${theme}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("checkbox").check();
      await page
        .getByRole("button", { name: "Adicionar à biblioteca" })
        .click();
      // A primeira importação cria a fonte; as seguintes recebem
      // SOURCE_EXISTS e abrem a mesma fonte.
      await page.waitForURL(/\/estudar\//);
      if (!sourceUrl) sourceUrl = page.url();
      else if (page.url() !== sourceUrl)
        throw new Error("Reimportação abriu outra fonte em vez da existente");
      await page.locator(".study").waitFor();
      // RN-03: origem visível no cabeçalho e ao pé do trecho.
      await expect(
        page
          .getByText("Letra da comunidade (LRCLIB), não revisada", {
            exact: false,
          })
          .first(),
      ).toBeVisible();
      await page.getByText("The build is green again").first().click();
      await expect(
        page.getByText(
          "Letra da comunidade (LRCLIB), não revisada · tempo aproximado",
        ),
      ).toBeVisible();
      await scan("musica-sala", theme, width);
      await page.screenshot({
        path: `.impeccable/review/song-study-${theme}-${width}.png`,
        fullPage: true,
      });
      // RN-04: artista como autor na biblioteca, nunca "Material próprio".
      await page.goto(`${base}/biblioteca`);
      const row = page.locator(".source-row", { hasText: "Green Build" });
      await expect(row).toContainText("The Linters");
      await expect(row).toContainText("Letra (LRCLIB)");
      await expect(row).not.toContainText("Material próprio");
    }
  }
  // RN-02: catálogo desligado. Só a resposta do bootstrap muda, no navegador.
  await page.route("**/api/bootstrap", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.integrations.lyrics = false;
    await route.fulfill({ response, json: body });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSongTab();
  await expect(
    page.getByText("Integração não configurada: a busca de letras"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adicionar à biblioteca" }),
  ).toBeDisabled();
  await scan("musica-desligada", "dark", 1440);
  await page.getByRole("button", { name: "Ir para Texto ou legenda" }).click();
  await expect(
    page.getByRole("button", { name: "Texto ou legenda", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.unroute("**/api/bootstrap");
  // TASK-022 / ADR-009: modo karaokê. Só o script da API do player do YouTube
  // é trocado, neste navegador de teste, por um player simulado com relógio
  // próprio — reprodução real em navegador headless é instável e não daria
  // para medir a latência do verso (CA-01). Tela, rota e banco são os reais.
  const fakeYouTube = `(() => {
    class Player {
      constructor(el, options) {
        this.options = options;
        this.at = (options.playerVars && options.playerVars.start) || 0;
        this.base = 0;
        this.playing = false;
        const frame = document.createElement("iframe");
        frame.title = "Player simulado do YouTube";
        frame.srcdoc = "<p>player simulado</p>";
        el.replaceWith(frame);
        window.__fakePlayer = this;
        setTimeout(() => options.events.onReady({ target: this }), 0);
      }
      emit(data) {
        if (this.options.events.onStateChange)
          this.options.events.onStateChange({ data });
      }
      getCurrentTime() {
        return this.playing
          ? this.at + (performance.now() - this.base) / 1000
          : this.at;
      }
      playVideo() {
        if (this.playing) return;
        this.base = performance.now();
        this.playing = true;
        this.emit(1);
      }
      pauseVideo() {
        if (!this.playing) return;
        this.at = this.getCurrentTime();
        this.playing = false;
        this.emit(2);
      }
      seekTo(seconds) {
        this.at = seconds;
        this.base = performance.now();
        if (this.playing) {
          this.emit(3);
          this.emit(1);
        }
      }
      setPlaybackRate() {}
      getAvailablePlaybackRates() {
        return [1];
      }
      destroy() {}
    }
    window.YT = { Player };
    if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
  })();`;
  await page.route("https://www.youtube.com/iframe_api", (route) =>
    route.fulfill({ contentType: "text/javascript", body: fakeYouTube }),
  );
  const setTheme = async (theme) => {
    await page.goto(`${base}/configuracoes`);
    await page
      .getByRole("button", {
        name: theme === "light" ? "Claro" : "Escuro",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (value) => document.documentElement.dataset.theme === value,
      theme,
    );
  };
  // Tempo, em ms do relógio do player, até o verso `text` acender. Começa do
  // zero, parado, sem verso aceso.
  const timeUntil = (text) =>
    page.evaluate(
      (expected) =>
        new Promise((resolve, reject) => {
          const player = window.__fakePlayer;
          player.pauseVideo();
          player.seekTo(0);
          const lit = () => document.querySelector('[aria-current="time"]');
          const started = performance.now();
          const waitDark = () => {
            if (lit()) {
              if (performance.now() - started > 3000)
                return reject(new Error("verso continuou aceso parado"));
              return requestAnimationFrame(waitDark);
            }
            const t0 = performance.now();
            player.playVideo();
            const check = () => {
              if (lit()?.textContent.includes(expected))
                return resolve(performance.now() - t0);
              if (performance.now() - t0 > 15000)
                return reject(new Error(`verso não acendeu: ${expected}`));
              requestAnimationFrame(check);
            };
            check();
          };
          waitDark();
        }),
      text,
    );
  const within = (label, value, min, max) => {
    if (value < min || value > max)
      throw new Error(
        `${label}: ${Math.round(value)} ms fora de ${min}–${max}`,
      );
    return Math.round(value);
  };
  await setTheme("light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSongTab();
  await page.getByLabel("Buscar música").fill("deploy friday");
  await expect(page.getByText("1 versão encontrada.")).toBeVisible();
  await page.getByRole("radio", { name: /^Deploy Friday/ }).check();
  await page
    .getByLabel("Link do clipe oficial no YouTube (opcional)")
    .fill("https://www.youtube.com/watch?v=karaokeqa01");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Adicionar à biblioteca" }).click();
  await page.waitForURL(/\/estudar\//);
  const karaokeUrl = page.url().split("?")[0];
  await page.goto(karaokeUrl);
  await page.waitForFunction(() => window.__fakePlayer);
  const followButton = page.getByRole("button", { name: "Acompanhar a letra" });
  const offset = page.locator(".karaoke-offset output");
  await expect(followButton).toHaveAttribute("aria-pressed", "true");
  await expect(offset).toHaveText("0,0 s");
  await expect(page.getByText(/K: acompanhar/)).toBeVisible();
  // CA-01: o verso acende sozinho em até ~300 ms do início declarado.
  const latency = {
    first: within(
      "1º verso",
      await timeUntil("Deploy on a Friday"),
      1500,
      1800,
    ),
    second: within(
      "2º verso",
      await timeUntil("Pager on my pillow"),
      4000,
      4300,
    ),
  };
  // RN-04 / CA-02: +1,0 s atrasa o verso e persiste ao reabrir.
  await page.getByRole("button", { name: "+0,5 s" }).click();
  await page.getByRole("button", { name: "+0,5 s" }).click();
  await expect(offset).toHaveText("+1,0 s");
  latency.shifted = within(
    "1º verso com +1,0 s",
    await timeUntil("Deploy on a Friday"),
    2500,
    2800,
  );
  await page.waitForTimeout(500);
  await page.goto(karaokeUrl);
  await page.waitForFunction(() => window.__fakePlayer);
  await expect(offset).toHaveText("+1,0 s");
  // RN-03: K desliga e religa; desligado, nenhum verso fica aceso.
  await page.locator(".study-heading h1").click();
  await page.keyboard.press("k");
  await expect(followButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[aria-current="time"]')).toHaveCount(0);
  await page.keyboard.press("k");
  await expect(followButton).toHaveAttribute("aria-pressed", "true");
  // RN-03: clicar num trecho pausa o acompanhamento até a próxima reprodução.
  await page.evaluate(() => window.__fakePlayer.playVideo());
  await expect(page.locator('[aria-current="time"]')).toHaveCount(1, {
    timeout: 4000,
  });
  await page
    .locator(".segment-select", { hasText: "Rollback before sunrise" })
    .click();
  await expect(page.getByText(/Acompanhamento pausado/)).toBeVisible();
  await expect(page.locator('[aria-current="time"]')).toHaveCount(0);
  await page.evaluate(() => {
    window.__fakePlayer.pauseVideo();
    window.__fakePlayer.playVideo();
  });
  await expect(page.getByText(/Acompanhamento pausado/)).toHaveCount(0);
  await expect(page.locator('[aria-current="time"]')).toHaveCount(1, {
    timeout: 2000,
  });
  // CA-03: A–B continua prendendo o trecho, agora com o deslocamento.
  await page
    .locator(".segment-select", { hasText: "Pager on my pillow" })
    .click();
  await page.getByRole("button", { name: "A–B" }).click();
  const looped = await page.evaluate(async () => {
    const player = window.__fakePlayer;
    player.seekTo(8.0);
    player.playVideo();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return player.getCurrentTime();
  });
  if (looped < 5 || looped > 8.25)
    throw new Error(`A–B não voltou ao trecho deslocado: ${looped}s`);
  await page.getByRole("button", { name: "A–B" }).click();
  await page.evaluate(() => window.__fakePlayer.pauseVideo());
  // CA-03: o modo cinema continua abrindo, com a barra da letra.
  await page.keyboard.press("c");
  await expect(page.locator(".study.cinema")).toHaveCount(1);
  await expect(followButton).toBeVisible();
  await scan("karaoke-cinema", "light", 1440);
  await page.keyboard.press("Escape");
  await expect(page.locator(".study.cinema")).toHaveCount(0);
  for (const theme of ["light", "dark"]) {
    await setTheme(theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(karaokeUrl);
      await page.waitForFunction(() => window.__fakePlayer);
      await page.evaluate(() => {
        window.__fakePlayer.seekTo(5.2);
        window.__fakePlayer.playVideo();
      });
      await expect(page.locator('[aria-current="time"]')).toContainText(
        "Pager on my pillow",
      );
      await page.evaluate(() => window.__fakePlayer.pauseVideo());
      await scan("karaoke-sala", theme, width);
      await page.screenshot({
        path: `.impeccable/review/karaoke-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  // CA-04: vídeo com legenda que não é letra do catálogo não muda.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/estudar/${process.env.FQ_QA_SOURCE_ID}`);
  await page.locator(".study").waitFor();
  await expect(
    page.getByRole("button", { name: "Acompanhar a letra" }),
  ).toHaveCount(0);
  await expect(page.getByText(/K: acompanhar/)).toHaveCount(0);
  await page.unroute("https://www.youtube.com/iframe_api");
  console.log(JSON.stringify({ karaokeLatencyMs: latency, loopedAt: looped }));
  await setTheme("light");
  await writeFile(
    ".impeccable/review/song-results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      errors,
      variants: results.map(
        ({ label, theme, width, violations, overflow }) => ({
          label,
          theme,
          width,
          violations: violations.map((v) => v.id),
          overflow,
        }),
      ),
    }),
  );
  if (errors.length || results.some((r) => r.violations.length || r.overflow))
    process.exitCode = 1;
} finally {
  await browser.close();
}
