# Recordatorio de pasos por evento (catálogos de preguntas dinámicas)

## Pipeline por evento (siempre en este orden)

1. **Visión solo en páginas de preguntas** — ver los PNG de `dinamedical/fichas/images/<ficha>/` (según `dumps/vision/_indice_paginas.txt`, `preguntas=[...]`). Capturar TODOS los detalles (literales, numerales, opciones).
2. **OCR/texto extraído para reglas e instrucciones** — leer `dinamedical/fichas/dumps/extracto/<ficha>_dump.txt` (páginas instructivo_desde=...). De ahí salen: criterios OBLIG, show_if, reglas de visualización. Ground truth: el dump en disco, no recuerdos de resúmenes.
3. **Escribir dump de visión** — `dinamedical/fichas/dumps/vision/<slug>_vision.txt` con mapeo OBLIG + índice de páginas.
4. **Escribir script de migración** — `dinamedical/migraciones/XXX-detalles-<evento>-<codigo>.sql` (plantilla 030-040: `@slugs` + `@defs`, DELETE listas/detalles/respuestas, INSERT con `CASE` para lista_ref/padre_ref, PRINT). Convenciones: slugs ASCII (sin ñ/acentos), tipo `number` con unidad en label, labels verbatim (incl. erratas), matrices decomposed, reglas no codificables documentadas en el header.
5. **Cargar** — BOM-free UTF8: `$OutputEncoding = [System.Text.UTF8Encoding]::new($false); Get-Content -Encoding UTF8 <file> | docker exec -i mssql_web-api /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "AppGalvis@2024" -d dinamedical`
6. **Verificar por evento** — `COUNT(*)` de defs y `SUM(obligatorio)` vs el mapeo del dump; query mojibake `CHARINDEX(CHAR(63), col) > 0 AND col NOT LIKE '%?'` (los '?' tras paréntesis son legítimos).

Work por tramos de ~5-6 eventos, en el orden del índice.

---

## ✅ HECHOS (migraciones ejecutadas y verificadas)

| Evento | Migración | Estado |
|---|---|---|
| 210/220/580 Dengue | 027 | ✔ ejecutado + verificado |
| 113 DNT | 028 | ✔ |
| 114 Riesgo DNT | 029 | ✔ |
| 115 CA menores 18 | 030 | ✔ |
| 101 Animales venenosos | 031 | ✔ |
| 155 CA mama/cuello útero | 032 | ✔ |
| 200 Cólera | 033 | ✔ |
| 205 Chagas | 034 | ✔ |
| 215 Defectos congénitos | 035 | ✔ 28 defs / 12 oblig |
| 217 Chikungunya | 036 | ✔ 2 defs / 1 oblig |
| 230 Difteria | 037 | ✔ 21 defs / 18 oblig |
| 300 APTR | 038 | ✔ 26 defs / 13 oblig |
| 305 Tracoma | 039 | ✔ 24 defs / 20 oblig |
| 310 Fiebre amarilla | 040 | ✔ 9 defs / 2 oblig |
| 340 Hepatitis B | 041 | ✔ 18 defs / 11 oblig (58 opciones) |
| 342 Enf. huérfanas | 042 | ✔ 5 defs / 3 oblig (23 opciones) |
| 345 ESI/IRAG | 043 | ✔ 22 defs / 17 oblig (37 opciones) |
| 348 IRAG inusitado | 044 | ✔ 25 defs / 23 oblig (39 opciones) |

Excluidos (no aplicar): 100, 210-220-220 ya tiene catálogo; fichas genéricas `Datos_Básicos` (250-270-275-290, 320, 330, 346, 620, 831), Caracterización, Laboratorios.

Los PNG de páginas de preguntas de TODAS las fichas ya están renderizados (run del script: 0 nuevos). Falta solo la visión + dump por ficha.

---

## ⏳ FALTAN (batch C, orden del índice; números asignados)

| # | Evento | Ficha | Migración |
|---|---|---|---|
| 2 | 349 ETA colectivo | 349_ETA_Colectivo_2026 (p1) | 045 |
| 3 | 352 Infecciones ISO individual | 352 (p2) | 046 |
| 4 | 354 CAB — brotes | 354_CAB_2026 (p1) | 047 |
| 5 | 356 Int. suicidio | 356 (p2) | 048 |
| 6 | 357 IAD individual | 357 (p2) | 049 |
| 7 | 359 IAD colectivo | 359 (p1) | 050 |
| 8 | 362 ISO colectivo | 362 (p1) | 051 |
| 9 | 365 Intoxicaciones | 365 (p2) | 052 |
| 10 | 420/430/440 Leishmaniasis | 420_430_440 (p2) | 053 |
| 11 | 450 Lepra | 450 (p2) | 054 |
| 12 | 452 Lesiones pólvora | 452 (p2) | 055 |
| 13 | 453 Lesiones C. externa | 453 (p2) | 056 |
| 14 | 455 Leptospirosis | 455 (p2) | 057 |
| 15 | 465 Malaria | 465 (p2) | 058 |
| 16 | 535 Meningitis | 535 (p2) | 059 |
| 17 | 549 MME | 549 (p2) | 060 |
| 18 | 550 MM | 550 (p2) | 061 |
| 19 | 560 MPNT | 560 (p2) | 062 |
| 20 | 591 Mortal. <5 años | 591 (p2) | 063 |
| 21 | 607 Ebola | 607 (p1-3) | 064 |
| 22 | 610 PFA | 610 (p2) | 065 |
| 23 | 650/652 Rabia animal | 650_652 (p2) | 066 |
| 24 | 670 Rabia humana | 670 (p2) | 067 |
| 25 | 710/730 Sarampión/Rubeola | 710_730 (p2) | 068 |
| 26 | 720 S. Rubeola congénita | 720 (p2) | 069 |
| 27 | 739 MIS-C | 739 (p2) | 070 |
| 28 | 740/750 Sífilis | 740_750 (p2) | 071 |
| 29 | 760 Tétanos accidental | 760 (p2) | 072 |
| 30 | 770 Tétanos neonatal | 770 (p2) | 073 |
| 31 | 800 Tosferina | 800 (p2) | 074 |
| 32 | 813 Tuberculosis | 813 (p2) | 075 |
| 33 | 850 VIH/Sida | 850 (p2) | 076 |
| 34 | 875 Violencia de género | 875 (p2) | 077 |
| 35 | 880 Mpox | 880 (p2) | 078 |
| 36 | 895 Zika | 895 (p2) | 079 |
| 37 | 900 Evento sin establecer | 900 (p2) | 080 |
| 38 | 957 Brotes IAAS | 957 (p1) | 081 |
| 39 | 995 IRA colectiva | 995 (p1) | 082 |
| 40 | 998 830/621/901 y brotes | 998 (p1) | 083 |

Al terminar todo batch C: re-ejecutar `venv-py312\Scripts\python.exe dinamedical\fichas\procesar_fichas.py` para regenerar el índice de visión.

Retomar desde: **tramo = 349, 352, 354, 356** (352/356 vision p2 + extracto p3+; 349/354 solo p1). Visión: `fichas/dumps/vision/348_irag_inusitado_2026_vision.txt`.
