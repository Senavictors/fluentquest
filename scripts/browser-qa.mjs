import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
const root = new URL("../", import.meta.url);
const env = parseEnv(await readFile(new URL(".env.owner", root), "utf8"));
const dir = new URL(".impeccable/review/", root);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["microphone"],
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3215");
await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
await page.getByLabel("Senha", { exact: true }).fill(env.OWNER_PASSWORD);
await page.getByRole("button", { name: "Entrar", exact: true }).click();
await page
  .getByRole("heading", {
    name: "Explicar um bloqueio sem roteiro",
    exact: true,
  })
  .waitFor();
await page.screenshot({
  path: new URL("desktop.png", dir).pathname.replace(/^\/([A-Z]:)/, "$1"),
  fullPage: true,
});
await page
  .getByRole("button", { name: /(Começar|Continuar) minha sessão/ })
  .click();
await page
  .getByRole("heading", { name: "Debugging a flaky test", exact: true })
  .waitFor();
await page.getByRole("tab", { name: "Atividade", exact: true }).click();
await page
  .getByLabel("Sua resposta em inglês")
  .fill("I would run it with one worker to isolate shared state.");
// Keep QA read-only with respect to the owner's learning history: do not submit.
await page.getByRole("tab", { name: "Expressão", exact: true }).click();
await page.screenshot({
  path: new URL("study-desktop.png", dir).pathname.replace(/^\/([A-Z]:)/, "$1"),
  fullPage: true,
});
await page
  .getByRole("button", { name: "Tradução: revelar", exact: true })
  .click();
if (
  !(await page
    .getByText("O teste passa localmente todas as vezes.", { exact: true })
    .isVisible())
)
  throw new Error("Translation reveal failed");
await page.getByRole("tab", { name: "Tutor", exact: true }).click();
await page
  .getByText("Integração não configurada.", { exact: false })
  .first()
  .waitFor();
for (const route of [
  "biblioteca",
  "praticar",
  "revisar",
  "jornada",
  "configuracoes",
  "onboarding",
]) {
  await page.goto(`http://localhost:3215/${route}`);
  await page.locator(".page").waitFor();
  await page.screenshot({
    path: new URL(`${route}-desktop.png`, dir).pathname.replace(
      /^\/([A-Z]:)/,
      "$1",
    ),
    fullPage: true,
  });
}
await page.goto("http://localhost:3215/configuracoes");
await page.getByRole("button", { name: "Escuro", exact: true }).click();
await page.waitForFunction(
  () => document.documentElement.dataset.theme === "dark",
);
await page.screenshot({
  path: new URL("dark-desktop.png", dir).pathname.replace(/^\/([A-Z]:)/, "$1"),
  fullPage: true,
});
await page.getByRole("button", { name: "Claro", exact: true }).click();
await page.waitForFunction(
  () => document.documentElement.dataset.theme === "light",
);
await page.setViewportSize({ width: 390, height: 844 });
const overflows = [];
for (const route of [
  "",
  "biblioteca",
  "praticar",
  "revisar",
  "jornada",
  "configuracoes",
  "onboarding",
]) {
  await page.goto(`http://localhost:3215/${route}`);
  await page.locator(".page").waitFor();
  await page.screenshot({
    path: new URL(
      route ? `${route}-mobile.png` : "mobile.png",
      dir,
    ).pathname.replace(/^\/([A-Z]:)/, "$1"),
    fullPage: true,
  });
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (wide) overflows.push(route || "today");
}
await page.goto("http://localhost:3215");
await page
  .getByRole("button", { name: "Continuar minha sessão", exact: true })
  .click();
await page.locator(".study").waitFor();
await page.screenshot({
  path: new URL("study-mobile.png", dir).pathname.replace(/^\/([A-Z]:)/, "$1"),
  fullPage: true,
});
await page.goto("http://localhost:3215/praticar");
await page
  .getByLabel("Permito gravar minha voz nesta atividade.", { exact: false })
  .check();
await page
  .getByRole("button", { name: "Gravar minha resposta", exact: true })
  .click();
await page
  .getByRole("button", { name: "Parar gravação", exact: true })
  .waitFor();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Parar gravação", exact: true }).click();
await page
  .getByRole("button", { name: "Salvar tentativa", exact: true })
  .waitFor();
await page.getByRole("button", { name: "Descartar", exact: true }).click();
await writeFile(
  new URL("browser-results.json", dir),
  JSON.stringify(
    {
      errors,
      overflows,
      microphone: "recorded and discarded using browser fake device",
      viewportDesktop: "1440x1000",
      viewportMobile: "390x844",
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    errors,
    overflows,
    recorder: "passed",
    screenshots: "saved",
  }),
);
await browser.close();
if (errors.length || overflows.length) process.exitCode = 1;
