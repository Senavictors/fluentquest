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
  await page.goto(`${base}/configuracoes`);
  await page.getByRole("button", { name: "Claro", exact: true }).click();
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
