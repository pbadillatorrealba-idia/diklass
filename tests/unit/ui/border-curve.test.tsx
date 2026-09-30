import { afterEach, describe, expect, test } from "bun:test";
import { Link } from "expo-router";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { SuggestedBlock } from "@/components/ui/suggested-block";
import { Text } from "@/components/ui/text";

// sistema-visual design.md D15: esquinas continuas de iOS en las superficies y controles con
// radio. En web no tiene efecto (RNW lo deja como estilo en línea).
const CURVE = "border-curve:continuous";

const ORIGINAL_OS = process.env.EXPO_OS;
afterEach(() => {
  process.env.EXPO_OS = ORIGINAL_OS;
});

describe("borderCurve continuo", () => {
  test.each([
    ["Card", <Card key="c" />],
    [
      "Callout",
      <Callout key="a" tone="info">
        x
      </Callout>,
    ],
    [
      "Input",
      <Input key="i">
        <InputField />
      </Input>,
    ],
    [
      "SuggestedBlock",
      <SuggestedBlock key="s">
        <Text>x</Text>
      </SuggestedBlock>,
    ],
  ] as [string, ReactElement][])("%s lo aplica en su contenedor", (_, element) => {
    const html = renderToStaticMarkup(element);
    const primera = html.match(/^<[^>]*>/)?.[0] ?? "";
    expect(primera).toContain(CURVE);
  });

  // En web, un `style` compuesto en el `Pressable` hace que NativeWind acumule las clases de
  // renders anteriores (un botón habilitado seguía con `opacity-50`): Button solo lo compone en
  // iOS, la única plataforma donde `borderCurve` tiene efecto.
  test("Button lo aplica en iOS", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(
      <Button>
        <ButtonText>x</ButtonText>
      </Button>,
    );
    expect(html.match(/^<[^>]*>/)?.[0]).toContain(CURVE);
  });

  test("Button no toca su style en web", () => {
    process.env.EXPO_OS = "web";
    const html = renderToStaticMarkup(
      <Button>
        <ButtonText>x</ButtonText>
      </Button>,
    );
    expect(html.match(/^<[^>]*>/)?.[0]).not.toContain("style=");
  });

  test("Button lo conserva en iOS bajo Link asChild, que le pasa su propio style", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(
      <Link asChild href="/patients">
        <Button style={{ opacity: 1 }}>
          <ButtonText>x</ButtonText>
        </Button>
      </Link>,
    );
    expect(html.match(/^<[^>]*>/)?.[0]).toContain(CURVE);
  });
});
