"""Genera los assets de marca desde assets/brand/logo-fuente.png (identidad-visual D4).

El PNG fuente trae el wordmark blanco sobre un degradado índigo; se recupera el canal alfa a
partir del rojo y se recortan isotipo y wordmark. Uso: python3 scripts/brand/generar-assets.py
Es una herramienta de desarrollo (Pillow); sus salidas se versionan, no se ejecuta en el build.
"""
from PIL import Image, ImageChops, ImageDraw

SRC, OUT = "assets/brand/logo-fuente.png", "assets/brand/"
TOP, BOTTOM, INK = (37, 17, 52), (62, 56, 136), (37, 17, 52)
# Cajas medidas sobre el PNG fuente: isotipo (D con nodo), wordmark y wordmark + lema.
ISO, WORD, LOCKUP = (305, 494, 560, 739), (305, 494, 1636, 739), (305, 494, 1636, 858)

img = Image.open(SRC).convert("RGB")
w, h = img.size
red = img.getchannel("R")
# El fondo solo varía en vertical: la columna x=20 es el fondo de cada fila.
bg = red.crop((20, 0, 21, h)).resize((w, h))
alpha = ImageChops.subtract(red, bg).point(lambda v: min(255, int(v * 1.22)))


def mark(box, height, color):
    a = alpha.crop(box)
    a = a.resize((round(a.width * height / a.height), height), Image.LANCZOS)
    a = a.point(lambda v: max(0, min(255, int((v - 128) * 1.6 + 128))))  # recupera filo al ampliar
    out = Image.new("RGBA", a.size, color + (0,))
    out.putalpha(a)
    return out


def gradient(size):
    g = Image.new("RGB", size)
    d = ImageDraw.Draw(g)
    for y in range(size[1]):
        t = y / (size[1] - 1)
        d.line([(0, y), (size[0], y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))
    return g


def center(base, layer):
    base.alpha_composite(layer, ((base.width - layer.width) // 2, (base.height - layer.height) // 2))
    return base


mark(WORD, 200, (255, 255, 255)).save(OUT + "wordmark-blanco.png")
mark(WORD, 200, INK).save(OUT + "wordmark-tinta.png")
mark(LOCKUP, 400, (255, 255, 255)).save(OUT + "splash-wordmark.png")
mark(ISO, 200, (255, 255, 255)).save(OUT + "isotipo-blanco.png")
# Ícono de iOS/Android: 1024², sin transparencia (iOS la rechaza).
center(gradient((1024, 1024)).convert("RGBA"), mark(ISO, 520, (255, 255, 255))).convert("RGB").save(OUT + "icon.png")
# Primer plano del ícono adaptativo: el isotipo cabe en el 66 % central (zona segura de Android).
center(Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)), mark(ISO, 400, (255, 255, 255))).save(OUT + "adaptive-icon.png")
center(gradient((48, 48)).convert("RGBA"), mark(ISO, 28, (255, 255, 255))).convert("RGB").save(OUT + "favicon.png")
