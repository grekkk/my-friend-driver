import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname, sep } from "node:path";

const key = "my-friend-driver:data";
async function addFriend(page: Page, name = "Kuba", rate = "5,50") {
  await page
    .getByRole("button", { name: "Dodaj znajomego", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Imię lub nazwa" }).fill(name);
  await page
    .getByRole("textbox", { name: "Stawka za przejazd", exact: true })
    .fill(rate);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Dodaj znajomego", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function addRide(page: Page) {
  await page.getByRole("button", { name: "Przejazd", exact: true }).click();
  await page
    .getByRole("button", { name: "Dodaj przejazd", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function data(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("codzienne przejazdy, edycja znajomego, rozliczenie części i całości, trwałość i historia", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "Twoje rozliczenia" }),
  ).toBeVisible();
  expect(await data(page)).toBeNull();
  await addFriend(page);
  await page.getByRole("button", { name: "Przejazd", exact: true }).click();
  await expect(page.getByLabel("Znajomy", { exact: true })).toHaveValue(
    (await data(page)).friends[0].id,
  );
  await page.getByRole("button", { name: "Więcej przejazdów" }).click();
  await expect(page.getByText("11,00 zł", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Dodaj przejazd", exact: true })
    .click();
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "11,00 zł",
  );
  await page.getByRole("button", { name: /Kuba 5,50/ }).click();
  await page
    .getByRole("button", { name: "Edytuj znajomego", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Imię lub nazwa" }).fill("Jakub");
  await page
    .getByRole("textbox", { name: "Stawka za przejazd", exact: true })
    .fill("6,00");
  await page
    .getByRole("button", { name: "Zapisz zmiany", exact: true })
    .click();
  expect((await data(page)).transactions[0].rate).toBe(550);
  await addRide(page);
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "17,00 zł",
  );
  await page.getByRole("button", { name: "Płatność", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Kwota płatności", exact: true })
    .fill("7");
  await page.getByRole("button", { name: "Zapisz płatność" }).click();
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "10,00 zł",
  );
  await page.getByRole("button", { name: "Płatność", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Kwota płatności", exact: true })
    .fill("11");
  await page.getByRole("button", { name: "Zapisz płatność" }).click();
  await expect(page.getByRole("alert")).toContainText("Do rozliczenia");
  await page.getByRole("button", { name: "Rozlicz całość" }).click();
  await expect(
    page.getByRole("textbox", { name: "Kwota płatności", exact: true }),
  ).toHaveValue("10,00");
  await page.getByRole("button", { name: "Zapisz płatność" }).click();
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "0,00 zł",
  );
  await page.reload();
  expect((await data(page)).transactions).toHaveLength(4);
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "0,00 zł",
  );
  const secondPage = await context.newPage();
  await secondPage.goto("./");
  await expect(
    secondPage.getByRole("button", { name: /Jakub 6,00/ }),
  ).toBeVisible();
  await secondPage.close();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.locator(".history-groups .entry-row")).toHaveCount(4);
  await page
    .locator(".history-groups .entry-row")
    .filter({ hasText: "Przejazd" })
    .last()
    .click();
  await page.getByRole("switch", { name: "Własny koszt przejazdu" }).check();
  await page
    .getByRole("textbox", { name: "Łączny koszt po zmianie" })
    .fill("12");
  await page
    .getByRole("button", { name: "Zapisz zmiany", exact: true })
    .click();
  await page.getByRole("button", { name: "Główna", exact: true }).click();
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "1,00 zł",
  );
  await expect(page.locator(".balance-number [aria-hidden]")).toHaveText(
    "1,00 zł",
  );
  expect(errors).toEqual([]);
});

test("osobne miesiące kosztów i płatności, poprzedni rok, wybór miesiąca i znajomego", async ({
  page,
}) => {
  await addFriend(page);
  await page.getByRole("button", { name: "Przejazd", exact: true }).click();
  await page.getByLabel("Data", { exact: true }).fill("2025-12-31");
  await page
    .getByRole("button", { name: "Dodaj przejazd", exact: true })
    .click();
  await page.getByRole("button", { name: "Płatność", exact: true }).click();
  await page.getByLabel("Data", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Rozlicz całość" }).click();
  await page.getByRole("button", { name: "Zapisz płatność" }).click();
  await page.getByRole("button", { name: "Analityka", exact: true }).click();
  await page.getByLabel("Rok analityki").selectOption("2025");
  await page.getByLabel("Miesiąc analityki").selectOption("12");
  await expect(page.locator(".analytics-total")).toHaveAttribute(
    "aria-label",
    "5,50 zł",
  );
  await expect(page.locator(".analytics-pair .number").last()).toHaveAttribute(
    "aria-label",
    "0,00 zł",
  );
  await expect(page.locator(".chart svg")).toBeVisible();
  await page.getByLabel("Rok analityki").selectOption("2026");
  await page.getByLabel("Miesiąc analityki").selectOption("1");
  await expect(page.locator(".analytics-total")).toHaveAttribute(
    "aria-label",
    "0,00 zł",
  );
  await expect(page.locator(".analytics-pair .number").last()).toHaveAttribute(
    "aria-label",
    "5,50 zł",
  );
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.getByLabel("Okres historii").selectOption("custom");
  await page.getByLabel("Miesiąc historii").fill("2025-12");
  await expect(page.locator(".history-groups .entry-row")).toHaveCount(1);
  await expect(page.locator(".history-groups .entry-row")).toContainText(
    "Przejazd",
  );
});

test("eksport, błędny import, import z potwierdzeniem i migracja", async ({
  page,
}) => {
  await addFriend(page);
  await addRide(page);
  const original = await data(page);
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksportuj kopię JSON" }).click();
  const downloaded = await downloading;
  expect(
    JSON.parse((await readFile((await downloaded.path())!)).toString()),
  ).toEqual(original);
  const file = page.getByLabel("Plik kopii JSON");
  await file.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{invalid"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Nie można odczytać pliku JSON",
  );
  expect(await data(page)).toEqual(original);
  const old = {
    ...original,
    version: 1,
    settings: { theme: "dark", defaultRate: 750 },
  };
  await file.setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await expect(page.getByRole("dialog")).toContainText("Zastąpić obecne dane?");
  expect(await data(page)).toEqual(original);
  await page.getByRole("button", { name: "Importuj i zastąp" }).click();
  expect((await data(page)).version).toBe(2);
  expect((await data(page)).transactions).toEqual(original.transactions);
  expect((await data(page)).settings.defaultRate).toBe(750);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("usuwanie wpisu, znajomego z historią i podwójny reset tylko danych aplikacji", async ({
  page,
}) => {
  await addFriend(page);
  await addRide(page);
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.locator(".entry-row").click();
  await page.getByRole("button", { name: "Usuń wpis", exact: true }).click();
  await page.getByRole("button", { name: "Anuluj", exact: true }).click();
  expect((await data(page)).transactions).toHaveLength(1);
  await page.getByRole("button", { name: "Usuń wpis", exact: true }).click();
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Usuń wpis", exact: true })
    .click();
  expect((await data(page)).transactions).toHaveLength(0);
  await page.getByRole("button", { name: "Główna", exact: true }).click();
  await addRide(page);
  await page.getByRole("button", { name: /Kuba 5,50/ }).click();
  await page
    .getByRole("button", { name: "Usuń znajomego", exact: true })
    .click();
  await expect(page.getByRole("dialog").last()).toContainText(
    "całą powiązaną historię",
  );
  await page
    .getByRole("button", { name: "Usuń znajomego i historię", exact: true })
    .click();
  expect((await data(page)).transactions).toHaveLength(0);
  expect((await data(page)).friends).toHaveLength(0);
  await addFriend(page, "Ola");
  await page.evaluate(() => localStorage.setItem("other-app", "keep"));
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  await page
    .getByRole("button", { name: "Usuń wszystkie dane", exact: true })
    .click();
  await page.getByRole("button", { name: "Przejdź dalej" }).click();
  expect((await data(page)).friends).toHaveLength(1);
  await page.getByRole("button", { name: "Usuń bezpowrotnie" }).click();
  expect((await data(page)).friends).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem("other-app"))).toBe(
    "keep",
  );
});

test("błąd localStorage nie pokazuje zapisu jako sukcesu", async ({ page }) => {
  await addFriend(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Przejazd", exact: true }).click();
  await page
    .getByRole("button", { name: "Dodaj przejazd", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Nie zapisano zmiany");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await data(page)).transactions).toHaveLength(0);
});

test("uszkodzony magazyn nie jest automatycznie nadpisywany", async ({
  page,
}) => {
  await page.evaluate((k) => localStorage.setItem(k, "broken-json"), key);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Oryginał pozostaje nienaruszony",
  );
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "broken-json",
  );
  await page
    .getByRole("button", { name: "Dodaj znajomego", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Imię lub nazwa" }).fill("Kuba");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Dodaj znajomego", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Najpierw odzyskaj",
  );
});

test("manifest i zasoby działają w podkatalogu, offline po restarcie i dodawanie offline", async ({
  page,
  context,
  request,
}) => {
  const manifest = await request.get("manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.start_url).toBe("/my-friend-driver/");
  expect(json.scope).toBe("/my-friend-driver/");
  for (const icon of json.icons)
    expect((await request.get(icon.src)).ok()).toBeTruthy();
  await addFriend(page);
  await addRide(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Twoje rozliczenia" }),
  ).toBeVisible();
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "5,50 zł",
  );
  await addRide(page);
  await expect(page.locator(".balance-number")).toHaveAttribute(
    "aria-label",
    "11,00 zł",
  );
  await page.reload();
  expect((await data(page)).transactions).toHaveLength(2);
  await context.setOffline(false);
});

test("systemowy i ciemny motyw, zredukowany ruch, sheet Escape, responsywność", async ({
  page,
}) => {
  await addFriend(page);
  await addRide(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await addRide(page);
  await expect(page.locator(".balance-number [aria-hidden]")).toHaveText(
    "11,00 zł",
  );
  await page.getByRole("button", { name: "Przejazd", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Przejazd", exact: true }),
    ).toBeInViewport();
  }
});

test("aktualizacja Service Workera zachowuje historię i czeka na zakończenie edycji", async ({
  page,
}) => {
  let revision = 1;
  const root = resolve("dist");
  const mime: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  const server = createServer(async (request, response) => {
    const relative =
      (request.url ?? "/").split("?")[0].replace(/^\/my-friend-driver\//, "") ||
      "index.html";
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      let content = await readFile(file);
      if (relative === "sw.js")
        content = Buffer.from(
          content.toString() + `\n// test revision ${revision}`,
        );
      response.writeHead(200, {
        "content-type": mime[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(4179, "127.0.0.1", done));
  try {
    await page.goto("http://127.0.0.1:4179/my-friend-driver/");
    await addFriend(page);
    await addRide(page);
    const before = await data(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await page.getByRole("button", { name: "Przejazd", exact: true }).click();
    revision = 2;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect(
      page.getByRole("button", { name: "Aktualizuj", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Zamknij panel" }).click();
    await expect(
      page.getByRole("button", { name: "Aktualizuj", exact: true }),
    ).toBeEnabled();
    await Promise.all([
      page.waitForEvent("load"),
      page.getByRole("button", { name: "Aktualizuj", exact: true }).click(),
    ]);
    await expect(
      page.getByRole("heading", { name: "Twoje rozliczenia" }),
    ).toBeVisible();
    expect(await data(page)).toEqual(before);
  } finally {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
});

test("domyślna stawka, preferencje, CountUp i wizualna kontrola ekranów", async ({
  page,
}) => {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("button", { name: /Domyślna stawka/ }).click();
  await page
    .getByRole("textbox", { name: "Domyślna stawka", exact: true })
    .fill("4,75");
  await page.getByRole("button", { name: "Zapisz stawkę" }).click();
  await page.getByRole("switch", { name: "Zapamiętuj znajomego" }).uncheck();
  expect((await data(page)).settings.rememberFriend).toBe(false);
  await page.getByRole("button", { name: "Główna", exact: true }).click();
  await page
    .getByRole("button", { name: "Dodaj znajomego", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Stawka za przejazd", exact: true }),
  ).toHaveValue("4,75");
  await page.getByRole("textbox", { name: "Imię lub nazwa" }).fill("Kuba");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Dodaj znajomego", exact: true })
    .click();
  await addRide(page);
  await expect(page.locator(".balance-number [aria-hidden]")).toHaveText(
    "4,75 zł",
  );
  await page.evaluate(() => {
    const values: string[] = [];
    (window as unknown as { animationValues: string[] }).animationValues =
      values;
    new MutationObserver(() =>
      values.push(
        document.querySelector(".balance-number [aria-hidden]")!.textContent!,
      ),
    ).observe(document.querySelector(".balance-number [aria-hidden]")!, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await addRide(page);
  await expect(page.locator(".balance-number [aria-hidden]")).toHaveText(
    "9,50 zł",
  );
  const frames = await page.evaluate(
    () => (window as unknown as { animationValues: string[] }).animationValues,
  );
  expect(new Set(frames).size).toBeGreaterThan(2);
  if (!process.env.CI) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".toast")).toHaveCount(0);
    await page.screenshot({ path: ".qa/home-light-mobile.png" });
    await page.getByRole("button", { name: "Przejazd", exact: true }).click();
    await page.screenshot({ path: ".qa/ride-mobile.png" });
    await page.getByRole("button", { name: "Zamknij panel" }).click();
    await page.getByRole("button", { name: "Analityka", exact: true }).click();
    await page.screenshot({ path: ".qa/analytics-mobile.png" });
    await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
    await page.screenshot({ path: ".qa/settings-mobile.png" });
    await page.getByRole("button", { name: "Ciemny", exact: true }).click();
    await page.getByRole("button", { name: "Główna", exact: true }).click();
    await page.screenshot({ path: ".qa/home-dark-mobile.png" });
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
    await page.getByRole("button", { name: "Jasny", exact: true }).click();
    await page.getByRole("button", { name: "Główna", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: ".qa/home-desktop.png" });
  }
});
