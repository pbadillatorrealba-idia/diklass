import { ANA, expect, hasBackend, test } from "./fixtures";

// sistema-visual FR-089 · FR-090 · SC-057 (design.md D16): acceso que los gestores de contraseñas
// pueden guardar y rellenar, en una tarjeta con «Mostrar contraseña».
test.describe("acceso compatible con gestores de contraseñas", () => {
  test("los campos viven en un form con name y autocomplete de credenciales", async ({ page }) => {
    await page.goto("/login");
    const form = page.locator("form");
    await expect(form).toHaveCount(1);
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("action", "/login");
    const usuario = form.locator('input[name="username"]');
    const clave = form.locator('input[name="password"]');
    await expect(usuario).toHaveAttribute("autocomplete", "username");
    await expect(usuario).toHaveAttribute("id", "username");
    await expect(clave).toHaveAttribute("autocomplete", "current-password");
    await expect(clave).toHaveAttribute("id", "password");
    await expect(clave).toHaveAttribute("type", "password");
    // Nunca de solo lectura: un gestor no rellena campos `readonly`.
    await expect(usuario).not.toHaveAttribute("readonly", /.*/);
    await expect(clave).not.toHaveAttribute("readonly", /.*/);
    await expect(form.locator('button[type="submit"]')).toHaveCount(1);
  });

  test("«Mostrar contraseña» cambia el tipo y anuncia su estado", async ({ page }) => {
    await page.goto("/login");
    // Con React hidratado (WebKit tarda más): antes, el control es solo HTML estático.
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    const clave = page.locator("#password");
    const mostrar = page.getByRole("button", { name: "Mostrar contraseña" });
    await expect(mostrar).toHaveAttribute("aria-pressed", "false");
    await mostrar.focus();
    await page.keyboard.press("Enter");
    // Sin `secureTextEntry`, RNW omite el atributo: el campo es `text` implícito.
    await expect.poll(() => clave.evaluate((el) => (el as HTMLInputElement).type)).toBe("text");
    const ocultar = page.getByRole("button", { name: "Ocultar contraseña" });
    await expect(ocultar).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
  });

  test("a 320 px el control de la contraseña queda dentro del campo", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    const campo = await page.locator("#password").locator("..").boundingBox();
    const control = await page.getByTestId("login-password-toggle").boundingBox();
    if (!campo || !control) throw new Error("faltan cajas");
    expect(control.x + control.width).toBeLessThanOrEqual(campo.x + campo.width + 0.5);
  });

  test.describe("con backend", () => {
    test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

    test("Intro en la contraseña envía un único submit e inicia sesión sin recargar", async ({
      page,
    }) => {
      await page.goto("/login");
      await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
      await page.evaluate(() => {
        (window as { __envios?: number; __sinRecarga?: boolean }).__envios = 0;
        (window as { __sinRecarga?: boolean }).__sinRecarga = true;
        document.addEventListener(
          "submit",
          () => {
            (window as { __envios?: number }).__envios =
              ((window as { __envios?: number }).__envios ?? 0) + 1;
          },
          true,
        );
      });
      await page.locator("#username").click();
      await page.keyboard.type(ANA.email, { delay: 15 });
      await page.locator("#password").click();
      await page.keyboard.type(ANA.password, { delay: 15 });
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
      const estado = await page.evaluate(() => ({
        envios: (window as { __envios?: number }).__envios,
        sinRecarga: (window as { __sinRecarga?: boolean }).__sinRecarga,
      }));
      expect(estado).toEqual({ envios: 1, sinRecarga: true });
    });

    test("un valor rellenado antes de la hidratación se conserva y permite entrar", async ({
      page,
    }) => {
      // Simula un gestor que rellena el HTML estático antes de que React tome el control.
      await page.addInitScript(
        ({ email, password }) => {
          document.addEventListener("readystatechange", () => {
            if (document.readyState !== "interactive") return;
            const usuario = document.getElementById("username") as HTMLInputElement | null;
            const clave = document.getElementById("password") as HTMLInputElement | null;
            if (usuario) usuario.value = email;
            if (clave) clave.value = password;
          });
        },
        { email: ANA.email, password: ANA.password },
      );
      await page.goto("/login");
      const enviar = page.getByRole("button", { name: "Iniciar sesión" });
      await expect(enviar).toBeEnabled();
      await expect(page.locator("#username")).toHaveValue(ANA.email);
      await expect(page.locator("#password")).toHaveValue(ANA.password);
      await enviar.click();
      await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    });

    test("tras un error el correo se conserva y la contraseña queda vacía", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
      await page.locator("#username").click();
      await page.keyboard.type(ANA.email, { delay: 15 });
      await page.locator("#password").click();
      await page.keyboard.type("clave-incorrecta", { delay: 15 });
      await page.getByRole("button", { name: "Iniciar sesión" }).click();
      const error = page.getByTestId("login-error");
      await expect(error).toBeVisible({ timeout: 15_000 });
      await expect(error).toHaveAttribute("role", "alert");
      await expect(page.locator("#username")).toHaveValue(ANA.email);
      await expect(page.locator("#password")).toHaveValue("");
    });
  });
});
