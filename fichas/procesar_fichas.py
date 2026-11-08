# -*- coding: utf-8 -*-
"""
Procesar fichas INS (solo las que NO ya tienen catalogo dinamico):
- Paginas de PREGUNTAS  -> se renderizan a PNG (vision del modelo).
- Resto (instructivo/reglas) -> extraccion de texto nativo (OCR ligero), sin imagen.
- Se genera un indice por ficha: en que pagina TERMINAN las preguntas.

Deteccion: la primera pagina que contiene "instructivo" marca el fin de las
paginas de preguntas. Una pagina sin texto nativo se trata como "vision_needed"
(escaneada) y SI se renderiza aunque estuviera classificada como instructivo.
"""
import os
import re
import pymupdf

BASE = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE, "images")
TEXT_DIR = os.path.join(BASE, "dumps", "extracto")
INDEX_FILE = os.path.join(BASE, "dumps", "vision", "_indice_paginas.txt")
DPI = 130

# Fichas excluidas: ya tienen catalogo de preguntas dinamicas o son genericas
EXCLUIDAS = ("100_", "113_", "114_", "210_220_580_",
             "Caracterizaci", "Datos_B", "Laboratorios_")

INSTRUCTIVO_RE = re.compile(r"(?i)instructivo")


def paginas_de_preguntas(pages):
    """Paginas de preguntas = las anteriores a la primera que menciona
    'instructivo' (el instructivo no repite la palabra en paginas siguientes).
    Una pagina sin texto nativo siempre cuenta como vision_needed."""
    primera_instr = None
    for i, p in enumerate(pages):
        if INSTRUCTIVO_RE.search(p.get_text()):
            primera_instr = i
            break
    preg = list(range(0, primera_instr)) if primera_instr is not None else list(range(len(pages)))
    vision_needed = [i for i, p in enumerate(pages) if not p.get_text().strip()]
    return sorted(set(preg) | set(vision_needed)), vision_needed, primera_instr


def main():
    pdfs = sorted(f for f in os.listdir(BASE)
                  if f.lower().endswith(".pdf")
                  and not any(f.startswith(p) for p in EXCLUIDAS))

    stats_render, stats_cleanup, vision_needed_total = 0, 0, 0
    lines = []

    for pdf in pdfs:
        slug = os.path.splitext(pdf)[0]
        doc = pymupdf.open(os.path.join(BASE, pdf))
        pages = list(doc)
        preg_idx, vn_idx, instr_idx = paginas_de_preguntas(pages)
        pregunta_pages = [i + 1 for i in preg_idx]
        vision_needed = [i + 1 for i in vn_idx]
        # fin de preguntas = ultima pagina de formulario (excluye escaneadas
        # tardias para no confundir el indice)
        fin_preguntas = max(pregunta_pages, default=0)
        instr_first = instr_idx + 1 if instr_idx is not None else None

        img_dir = os.path.join(IMAGES_DIR, slug)
        os.makedirs(img_dir, exist_ok=True)

        # 1) imagenes SOLO para paginas de preguntas (o escaneadas)
        for i, p in enumerate(pages):
            n = i + 1
            png = os.path.join(img_dir, f"p{n:02d}.png")
            if n in pregunta_pages:
                if not os.path.exists(png):
                    p.get_pixmap(dpi=DPI).save(png)
                    stats_render += 1
            else:
                # limpiar PNG que ya no debe existir (instructivo -> texto)
                if os.path.exists(png):
                    os.remove(png)
                    stats_cleanup += 1

        # 2) extraccion de texto del resto (instructivo/reglas)
        os.makedirs(TEXT_DIR, exist_ok=True)
        txt_path = os.path.join(TEXT_DIR, slug + ".txt")
        with open(txt_path, "w", encoding="utf-8") as fh:
            for i, p in enumerate(pages):
                fh.write(f"===== PAGINA {i+1} =====\n")
                fh.write(p.get_text().strip() + "\n\n")

        vision_needed_total += len(vision_needed)
        lines.append(
            f"{slug} | total={len(pages)} | preguntas={pregunta_pages} "
            f"| fin_preguntas=p{fin_preguntas} | instructivo_desde=p{instr_first}"
            + (f" | VISION_NEEDED={vision_needed}" if vision_needed else "")
        )
        doc.close()

    os.makedirs(os.path.dirname(INDEX_FILE), exist_ok=True)
    with open(INDEX_FILE, "w", encoding="utf-8") as fh:
        fh.write("Indice de paginas de preguntas por ficha (vision) vs "
                 "instructivo (texto).\n")
        fh.write(f"Renderizados {stats_render} PNG nuevos, eliminados "
                 f"{stats_cleanup} PNG de instructivo, "
                 f"{vision_needed_total} paginas escaneadas (vision obligada).\n\n")
        fh.write("\n".join(lines) + "\n")

    for l in lines:
        print(l)
    print(f"\nPNG nuevos={stats_render}  eliminados={stats_cleanup}  "
          f"vision_needed={vision_needed_total}")
    print(f"Indice: {INDEX_FILE}")


if __name__ == "__main__":
    main()
