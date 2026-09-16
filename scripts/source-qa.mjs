import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
if (
  !process.env.FQ_QA_PASSWORD ||
  !process.env.FQ_QA_SOURCE_ID ||
  !process.env.FQ_QA_AI_SOURCE_ID
)
  throw new Error("Execute por scripts/qa-isolated.ts");
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
try {
  await page.goto("http://localhost:3215");
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.FQ_QA_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.locator(".page").waitFor();
  for (const theme of ["light", "dark"]) {
    await page.goto("http://localhost:3215/configuracoes");
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
      await page.goto(
        `http://localhost:3215/estudar/${process.env.FQ_QA_SOURCE_ID}`,
      );
      await expect(
        page.getByRole("heading", {
          name: "Transcrever o vídeo com Gemini",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Transcrever com Gemini",
          exact: true,
        }),
      ).toBeDisabled();
      await expect(
        page.locator(".ai-transcription .error-text"),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Adicionar legenda", exact: true })
        .click();
      await expect(page.getByLabel("Direito de uso da legenda")).toHaveValue(
        "licensed",
      );
      await expect(
        page.getByRole("button", { name: "Salvar legenda" }),
      ).toBeDisabled();
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      results.push({ theme, width, violations: scan.violations, overflow });
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `.impeccable/review/caption-${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page
    .getByLabel("SRT ou VTT autorizado")
    .fill(
      "1\n00:00:01,000 --> 00:00:03,000\nAn authorized caption for testing.",
    );
  await page
    .getByLabel("Confirmo autoria ou autorização para usar a legenda.")
    .check();
  await page.getByRole("button", { name: "Salvar legenda" }).click();
  await expect(
    page
      .getByText("An authorized caption for testing.", { exact: true })
      .last(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByText("An authorized caption for testing.", { exact: true })
      .last(),
  ).toBeVisible();
  await page.goto(
    `http://localhost:3215/estudar/${process.env.FQ_QA_AI_SOURCE_ID}`,
  );
  await expect(
    page.getByText("Transcrição automática não revisada", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("A provider generated fixture for visual QA.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("http://localhost:3215/praticar");
  await expect(
    page.getByText("O feedback envia sua gravação ao Gemini.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Receber feedback", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: ".impeccable/review/voice-consent-mobile.png",
    fullPage: true,
  });
  await writeFile(
    ".impeccable/review/source-results.json",
    JSON.stringify(
      {
        results,
        errors,
        captionSavedAndReloaded: true,
        feedbackDisabledWithoutAI: true,
        videoTranscriptionDisabledWithoutAI: true,
        aiProvenanceVisible: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      captionSavedAndReloaded: true,
      feedbackDisabledWithoutAI: true,
      videoTranscriptionDisabledWithoutAI: true,
      aiProvenanceVisible: true,
      errors,
      variants: results.map(({ theme, width, violations, overflow }) => ({
        theme,
        width,
        violations: violations.length,
        overflow,
      })),
    }),
  );
  if (errors.length || results.some((r) => r.violations.length || r.overflow))
    process.exitCode = 1;
} finally {
  await browser.close();
}
