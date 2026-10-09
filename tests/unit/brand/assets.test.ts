import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Identidad visual (FR-101 · SC-063): ícono, ícono adaptativo y favicon salen de assets/brand y
// tienen las dimensiones que exige cada plataforma. Se lee el IHDR del PNG: sin dependencias.
const expo = JSON.parse(readFileSync("app.json", "utf8")).expo;

function png(path: string) {
  const buf = readFileSync(join(path));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

describe("assets de marca (FR-101)", () => {
  test("ícono 1024² sin canal alfa (iOS rechaza la transparencia)", () => {
    expect(expo.icon).toBe("./assets/brand/icon.png");
    const { width, height, colorType } = png(expo.icon);
    expect([width, height]).toEqual([1024, 1024]);
    expect(colorType).not.toBe(6); // 6 = RGBA
  });

  test("ícono adaptativo de Android: primer plano 1024² sobre índigo", () => {
    const adaptive = expo.android?.adaptiveIcon;
    expect(adaptive?.foregroundImage).toBe("./assets/brand/adaptive-icon.png");
    expect(adaptive?.backgroundColor).toBe("#3E3888");
    const { width, height } = png(adaptive.foregroundImage);
    expect([width, height]).toEqual([1024, 1024]);
  });

  test("favicon web cuadrado, enlazado desde app.json", () => {
    expect(expo.web?.favicon).toBe("./assets/brand/favicon.png");
    const { width, height } = png(expo.web.favicon);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(48);
  });
});
