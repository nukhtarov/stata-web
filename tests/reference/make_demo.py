"""Генерирует синтетический учебный датасет housing_demo.xlsx.

Структура как у курсового датасета (48 «городов», те же 17 переменных), но все значения
выдуманы: города и страны — условные. Заложены типичные учебные ситуации:
сильная мультиколлинеарность (Population ~ Housing_stock), дамми (Euro_area ⊂ EU),
нелинейность по Density (чтобы linktest/ovtest было что ловить).

    .venv-ref/bin/python -I tests/reference/make_demo.py public/demo/housing_demo.xlsx
"""
import sys

import numpy as np
from openpyxl import Workbook

OUT = sys.argv[1]
rng = np.random.default_rng(48)
N = 48

country_id = np.repeat(np.arange(16), 3)
rng.shuffle(country_id)
countries = [f"Страна {chr(ord('A') + i)}" for i in range(16)]
eu_c = rng.random(16) < 0.75
euro_c = eu_c & (rng.random(16) < 0.7)

EU = eu_c[country_id].astype(int)
Euro_area = euro_c[country_id].astype(int)
Capital = np.zeros(N, int)
for c in range(16):
    idx = np.where(country_id == c)[0]
    Capital[idx[0]] = 1
# столиц 16, добавим ещё 8 «крупных центров», чтобы было ровно половина
Capital[rng.choice(np.where(Capital == 0)[0], 8, replace=False)] = 1

Population = np.clip(np.exp(rng.normal(0.25, 0.8, N)) * (1 + 0.8 * Capital), 0.35, 13)
Housing_stock = Population * 410 * np.exp(rng.normal(0, 0.18, N))
Pop2HS = Population * 1000 / Housing_stock
Density = np.clip(np.exp(rng.normal(1.25, 0.6, N)) + 1.5 * Capital, 1.2, 21)
GDP_PC_PPP = np.clip(rng.normal(30, 14, N) + 12 * Euro_area + 6 * Capital, 6, 80)
Gini = np.clip(rng.normal(33, 5.5, N) - 0.08 * (GDP_PC_PPP - 30), 23, 52)
HOR = np.clip(rng.normal(60, 22, N) - 0.4 * (GDP_PC_PPP - 30), 12, 96)
GBL_10y = np.clip(np.exp(rng.normal(1.4, 0.6, N)) - 2 * Euro_area + 1.5, 1.2, 22)
Inflation = np.clip(0.6 * GBL_10y + rng.normal(0, 1.4, N) - 0.5, -1.6, 10.5)
MIR = np.clip(1.2 * GBL_10y + 0.4 * Inflation + rng.normal(0, 1.2, N), 0.9, 26)
DMIR = np.round(rng.normal(-0.4, 0.7, N), 2)
URate = np.clip(rng.normal(9.5, 4.5, N) - 0.08 * (GDP_PC_PPP - 30) + 2 * (1 - EU), 1.7, 23)
Mortgage_PC = np.clip(0.35 * GDP_PC_PPP + rng.normal(0, 7, N) - 3, 0.2, 45)

Price = (
    -2500
    + 75 * Gini
    + 35 * GDP_PC_PPP
    + 260 * Density
    - 9 * Density**2  # нелинейность
    - 70 * URate
    + 900 * Pop2HS
    + 300 * Capital
    + 5 * Mortgage_PC
    + rng.normal(0, 650, N) * (1 + 0.15 * Capital)
)
Price = np.clip(Price, 900, None)

cols = {
    "Country": [countries[c] for c in country_id],
    "City": [f"Город {i + 1:02d}" for i in range(N)],
    "City_Short": [f"C{i + 1:02d}" for i in range(N)],
    "Price": np.round(Price, 6),
    "Gini": np.round(Gini, 1),
    "HOR": np.round(HOR, 1),
    "Inflation": np.round(Inflation, 1),
    "URate": np.round(URate, 6),
    "Capital": Capital,
    "Euro_area": Euro_area,
    "EU": EU,
    "Population": np.round(Population, 6),
    "Density": np.round(Density, 6),
    "Housing_stock": np.round(Housing_stock, 3),
    "Pop2HS": np.round(Pop2HS, 6),
    "GDP_PC_PPP": np.round(GDP_PC_PPP, 6),
    "GBL_10y": np.round(GBL_10y, 2),
    "MIR": np.round(MIR, 2),
    "DMIR": DMIR,
    "Mortgage_PC": np.round(Mortgage_PC, 2),
}

wb = Workbook()
ws = wb.active
ws.title = "Лист1"
ws.append(list(cols))
for i in range(N):
    ws.append([v[i].item() if hasattr(v[i], "item") else v[i] for v in cols.values()])
wb.properties.creator = "stata-web demo"
wb.save(OUT)
print("saved", OUT)
