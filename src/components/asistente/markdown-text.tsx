import { Link } from "expo-router";
import { lexer, type Token, type Tokens } from "marked";
import { Fragment, type ReactNode } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { LinkText } from "@/components/ui/link-text";
import { Text } from "@/components/ui/text";
import { hostOf, isInternalHref, isSafeHref } from "@/features/asistente/markdown-links";

/**
 * Markdown del asistente (asistente-conversacional «Markdown seguro» · design.md D9): `marked` solo
 * tokeniza; este renderizador pinta los tokens con las primitivas y los tokens del sistema, sin
 * estilos externos. El HTML crudo y las imágenes se muestran como texto (no se interpretan ni se
 * cargan) y los enlaces son solo `http(s)` o rutas internas.
 */
const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};
// `marked` escapa el texto en línea para HTML; aquí se pinta como texto, así que se deshace.
const plano = (text: string) => text.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTIDADES[e] ?? e);

function Inline({ tokens }: { tokens: Token[] | undefined }): ReactNode {
  return (tokens ?? []).map((token, index) => {
    const key = `${token.type}-${index}`;
    switch (token.type) {
      case "text":
      case "escape": {
        const t = token as Tokens.Text;
        return t.tokens ? (
          <Inline key={key} tokens={t.tokens} />
        ) : (
          <Fragment key={key}>{plano(t.text)}</Fragment>
        );
      }
      case "strong":
        return (
          <Text className="font-semibold" key={key}>
            <Inline tokens={(token as Tokens.Strong).tokens} />
          </Text>
        );
      case "em":
        return (
          <Text className="italic" key={key}>
            <Inline tokens={(token as Tokens.Em).tokens} />
          </Text>
        );
      case "del":
        return (
          <Text className="line-through" key={key}>
            <Inline tokens={(token as Tokens.Del).tokens} />
          </Text>
        );
      case "codespan":
        return (
          <Text className="font-mono" key={key}>
            {plano((token as Tokens.Codespan).text)}
          </Text>
        );
      case "br":
        return <Fragment key={key}>{"\n"}</Fragment>;
      case "link": {
        const link = token as Tokens.Link;
        const contenido = <Inline tokens={link.tokens} />;
        if (!isSafeHref(link.href)) return <Fragment key={key}>{contenido}</Fragment>;
        const interno = isInternalHref(link.href);
        return (
          <Fragment key={key}>
            <Link
              asChild
              href={link.href as never}
              {...(interno ? {} : { rel: "noopener noreferrer", target: "_blank" })}
            >
              <LinkText>{contenido}</LinkText>
            </Link>
            {interno ? null : <Text tone="muted">{` (${hostOf(link.href)})`}</Text>}
          </Fragment>
        );
      }
      // HTML crudo e imágenes: texto, nunca interpretado ni cargado.
      default:
        return <Fragment key={key}>{plano(token.raw)}</Fragment>;
    }
  });
}

function Cell({ cell, header }: { cell: Tokens.TableCell; header?: boolean }) {
  return (
    <View
      className="min-w-0 flex-1 border border-border p-2"
      role={header ? "columnheader" : "cell"}
    >
      <Text className={header ? "font-semibold" : ""} variant="caption">
        <Inline tokens={cell.tokens} />
      </Text>
    </View>
  );
}

function List({ list }: { list: Tokens.List }) {
  return (
    <View className="gap-1" role="list">
      {list.items.map((item, index) => (
        <View className="flex-row gap-2" key={`${item.raw}-${index}`} role="listitem">
          <Text>{list.ordered ? `${Number(list.start || 1) + index}.` : "•"}</Text>
          <View className="min-w-0 flex-1 gap-1">
            <Blocks tokens={item.tokens} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Blocks({ tokens }: { tokens: Token[] }): ReactNode {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;
    switch (token.type) {
      case "space":
        return null;
      case "heading": {
        const h = token as Tokens.Heading;
        return (
          <Heading key={key} level={h.depth === 1 ? 2 : 3}>
            <Inline tokens={h.tokens} />
          </Heading>
        );
      }
      case "paragraph":
      case "text": {
        const t = token as Tokens.Paragraph;
        return <Text key={key}>{t.tokens ? <Inline tokens={t.tokens} /> : plano(t.text)}</Text>;
      }
      case "list":
        return <List key={key} list={token as Tokens.List} />;
      case "blockquote":
        return (
          <View className="gap-1 border-l border-border pl-3" key={key}>
            <Blocks tokens={(token as Tokens.Blockquote).tokens} />
          </View>
        );
      case "code":
        return (
          <View className="rounded-sm border border-border bg-card p-3" key={key}>
            <Text variant="data">{(token as Tokens.Code).text}</Text>
          </View>
        );
      case "table": {
        const table = token as Tokens.Table;
        return (
          <View key={key} role="table">
            <View className="flex-row" role="row">
              {table.header.map((cell, i) => (
                <Cell cell={cell} header key={`h-${i}`} />
              ))}
            </View>
            {table.rows.map((row, r) => (
              <View className="flex-row" key={`r-${r}`} role="row">
                {row.map((cell, i) => (
                  <Cell cell={cell} key={`c-${r}-${i}`} />
                ))}
              </View>
            ))}
          </View>
        );
      }
      case "hr":
        return <View className="my-1 border-t border-border" key={key} />;
      // `html` y cualquier otro: su texto original, sin interpretar.
      default:
        return <Text key={key}>{token.raw}</Text>;
    }
  });
}

export function MarkdownText({ text }: { text: string }) {
  const tokens = lexer(text);
  if (tokens.length === 0) return null;
  return (
    <View className="gap-2">
      <Blocks tokens={tokens} />
    </View>
  );
}
