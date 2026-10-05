import { expect, test } from "@playwright/test";

test("login is accessible and responsive without configured external services", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await expect(page).toHaveTitle("Ingresar · Fondo Editorial Continental");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "Bienvenido al equipo." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toBeDisabled();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("temporalmente no disponible");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Ir al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);
  await page.screenshot({ path: `test-results/login-${test.info().project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("all administrative routes redirect without granting access", async ({ page }) => {
  for (const route of ["/admin", "/admin/correos", "/admin/pedidos"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?error=service_unavailable$/);
    await expect(page.getByRole("heading", { name: "Bienvenido al equipo." })).toBeVisible();
  }
});

test("direct auth and action requests fail closed when the service is unavailable", async ({ request }) => {
  const auth = await request.post("/api/auth/sign-in/social", {
    data: { provider: "google", callbackURL: "/admin" },
  });
  expect(auth.status()).toBe(503);
  expect(await auth.json()).toEqual({ message: "El inicio de sesión no está disponible. Intenta nuevamente." });

  const action = await request.post("/admin/correos", {
    headers: { "next-action": "forged-action", origin: "http://127.0.0.1:3100" },
    data: ["outsider@gmail.com"],
  });
  expect(action.status()).toBe(503);
  expect(await action.json()).toEqual({ error: "UNAVAILABLE" });
});
