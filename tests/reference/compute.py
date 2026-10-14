"""Считает эталонные значения для юнит-тестов stats/.

Запуск (из корня проекта):
    python3 -m venv .venv-ref && .venv-ref/bin/pip install numpy scipy statsmodels pandas openpyxl
    .venv-ref/bin/python -I tests/reference/compute.py tests/fixtures

Пишет:
    tests/fixtures/distributions.json  — значения CDF/квантилей scipy
    tests/fixtures/synthetic.json      — синтетические датасеты + OLS statsmodels + shapiro scipy
    tests/fixtures/demo.json           — учебный public/demo/housing_demo.xlsx: регрессия и все тесты
    tests/fixtures/private/reference.json — курсовой датасет (если лежит локально, в git его нет)
"""
import json
import os
import sys

import numpy as np
import pandas as pd
import scipy.stats as st
import statsmodels.api as sm

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "fixtures")


def dump(name, obj):
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, indent=1, allow_nan=False)


# ---------------------------------------------------------------- distributions
dist = {"normal": [], "t": [], "F": [], "chi2": [], "invnormal": [], "invt": []}
for z in [-8, -5, -3.2, -1.96, -1, -0.3, 0, 0.5, 1.185, 2, 3.7, 6]:
    dist["normal"].append({"x": z, "cdf": st.norm.cdf(z), "sf": st.norm.sf(z)})
for p in [1e-10, 1e-5, 0.001, 0.025, 0.1, 0.4, 0.5, 0.7, 0.975, 0.999, 1 - 1e-9]:
    dist["invnormal"].append({"p": p, "x": st.norm.ppf(p)})
for df in [1, 2, 5, 31, 45, 200]:
    for x in [-4, -1.5, -0.03, 0, 0.7, 2.06, 3.0, 12]:
        dist["t"].append({"df": df, "x": x, "cdf": st.t.cdf(x, df), "sf": st.t.sf(x, df)})
    for p in [0.005, 0.025, 0.5, 0.9, 0.975, 0.995]:
        dist["invt"].append({"df": df, "p": p, "x": st.t.ppf(p, df)})
for d1, d2 in [(1, 1), (2, 45), (3, 28), (16, 31), (5, 300), (47, 2)]:
    for x in [0.01, 0.5, 1, 2.5, 6.25, 7.29, 106.93]:
        dist["F"].append({"d1": d1, "d2": d2, "x": x, "sf": st.f.sf(x, d1, d2), "cdf": st.f.cdf(x, d1, d2)})
for df in [1, 2, 16, 47, 64, 150]:
    for x in [0.1, 0.62, 1.33, 11.72, 48, 60.34, 200]:
        dist["chi2"].append({"df": df, "x": x, "sf": st.chi2.sf(x, df), "cdf": st.chi2.cdf(x, df)})
dist = {k: [{kk: float(vv) for kk, vv in r.items()} for r in v] for k, v in dist.items()}
dump("distributions.json", dist)


# ---------------------------------------------------------------- helpers
def ols(y, X):
    """X без константы; константа добавляется последней (как _cons в Stata)."""
    Xc = sm.add_constant(X, prepend=False, has_constant="add")
    m = sm.OLS(y, Xc).fit()
    return m


def ols_dict(m):
    return {
        "b": m.params.tolist(), "se": m.bse.tolist(), "t": m.tvalues.tolist(), "p": m.pvalues.tolist(),
        "ci": m.conf_int(0.05).tolist(), "rss": m.ssr, "mss": m.ess, "r2": m.rsquared,
        "adjr2": m.rsquared_adj, "F": m.fvalue, "pF": m.f_pvalue, "rmse": float(np.sqrt(m.mse_resid)),
        "df_m": m.df_model, "df_r": m.df_resid, "resid": m.resid.tolist(), "fitted": m.fittedvalues.tolist(),
    }


def stata_pctile(x, p):
    x = np.sort(x)
    n = len(x)
    P = n * p / 100
    i = int(np.floor(P))
    if P == i:
        return (x[i - 1] + x[i]) / 2 if i > 0 else x[0]
    return x[i]


def summarize_detail(x):
    x = np.asarray(x, float)
    n = len(x)
    mu = x.mean()
    d = x - mu
    m2, m3, m4 = (d ** 2).mean(), (d ** 3).mean(), (d ** 4).mean()
    return {
        "N": n, "mean": mu, "sd": x.std(ddof=1), "var": x.var(ddof=1), "min": x.min(), "max": x.max(),
        "skewness": m3 / m2 ** 1.5, "kurtosis": m4 / m2 ** 2,
        "pctiles": {str(p): stata_pctile(x, p) for p in [1, 5, 10, 25, 50, 75, 90, 95, 99]},
    }


def full_tests(y, X, names):
    N, p = X.shape
    k = p + 1
    m = ols(y, X)
    e, yhat = m.resid, m.fittedvalues
    res = {"ols": ols_dict(m)}
    # linktest
    lt = ols(y, np.column_stack([yhat, yhat ** 2]))
    res["linktest"] = ols_dict(lt)
    res["linktest"].pop("resid"); res["linktest"].pop("fitted")
    # ovtest
    z = (yhat - yhat.min()) / (yhat.max() - yhat.min())
    mu = ols(y, np.column_stack([X, z ** 2, z ** 3, z ** 4]))
    F = ((m.ssr - mu.ssr) / 3) / (mu.ssr / (N - k - 3))
    res["ovtest"] = {"F": F, "df1": 3, "df2": N - k - 3, "p": st.f.sf(F, 3, N - k - 3)}
    # vif
    vifs = []
    for j in range(p):
        r2 = ols(X[:, j], np.delete(X, j, axis=1)).rsquared
        vifs.append({"name": names[j], "vif": 1 / (1 - r2)})
    vifs.sort(key=lambda r: -r["vif"])
    res["vif"] = {"rows": vifs, "mean": float(np.mean([r["vif"] for r in vifs]))}
    # hettest
    s2 = m.ssr / N
    h = ols(e ** 2 / s2, yhat)
    chi = h.ess / 2
    res["hettest"] = {"chi2": chi, "df": 1, "p": st.chi2.sf(chi, 1)}
    # imtest (Cameron & Trivedi): σ² = RSS/N, нецентрированный R² для skew/kurt
    cols = [X[:, j] for j in range(p)]
    for i in range(p):
        for j in range(i, p):
            cols.append(X[:, i] * X[:, j])
    A = np.column_stack(cols)
    # убрать коллинеарные: QR по нормированным столбцам, жадно (как _rmcoll)
    keep = []
    Q = [np.ones(N) / np.sqrt(N)]
    for j in range(A.shape[1]):
        v = A[:, j] - A[:, j].mean()
        nv = np.linalg.norm(v)
        if nv == 0:
            continue
        v = v / nv
        for q in Q:
            v = v - (q @ v) * q
        if np.linalg.norm(v) > 1e-9:
            keep.append(j)
            Q.append(v / np.linalg.norm(v))
    Ak = A[:, keep]
    hm = sm.OLS(e ** 2, sm.add_constant(Ak, prepend=False)).fit()
    het = N * hm.rsquared if len(keep) < N - 1 else float(N)
    het_df = len(keep)

    def unc_r2(dep, R):
        R1 = np.ones((N, 1)) if R is None else np.column_stack([R, np.ones(N)])
        b, *_ = np.linalg.lstsq(R1, dep, rcond=None)
        r = dep - R1 @ b
        return 1 - r @ r / (dep @ dep)

    u3 = e ** 3 - 3 * s2 * e
    u4 = e ** 4 - 6 * s2 * e ** 2 + 3 * s2 ** 2
    skew = N * unc_r2(u3, X)
    kurt = N * unc_r2(u4, None)
    res["imtest"] = {
        "het": {"chi2": het, "df": het_df, "p": st.chi2.sf(het, het_df)},
        "skew": {"chi2": skew, "df": p, "p": st.chi2.sf(skew, p)},
        "kurt": {"chi2": kurt, "df": 1, "p": st.chi2.sf(kurt, 1)},
        "total": {"chi2": het + skew + kurt, "df": het_df + p + 1, "p": st.chi2.sf(het + skew + kurt, het_df + p + 1)},
    }
    # white (classical): N·R² — то же, что het
    # swilk
    W, _ = st.shapiro(e)
    res["swilk_W"] = float(W)
    res["sum_resid"] = summarize_detail(e)
    # kdensity bandwidth
    s = summarize_detail(e)
    iqr = s["pctiles"]["75"] - s["pctiles"]["25"]
    res["kdensity_bw"] = 0.9 * min(s["sd"], iqr / 1.349) * N ** -0.2
    return res


def to_jsonable(o):
    if isinstance(o, dict):
        return {k: to_jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [to_jsonable(v) for v in o]
    if isinstance(o, (np.floating, np.integer)):
        return float(o)
    return o


# ---------------------------------------------------------------- xlsx-датасеты
XS = "Gini HOR Inflation URate Capital Euro_area EU Population Density Housing_stock Pop2HS GDP_PC_PPP GBL_10y MIR DMIR Mortgage_PC".split()


def xlsx_reference(path, out_name):
    df = pd.read_excel(path, sheet_name="Лист1")
    y = df["Price"].astype(float).values
    X = df[XS].astype(float).values
    r = full_tests(y, X, XS)
    r.update({"names": XS, "y": y.tolist(), "X": [list(c) for c in X.T.tolist()]})
    dump(out_name, to_jsonable(r))
    return r


# учебный синтетический датасет (публичный, public/demo)
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
demo = xlsx_reference(os.path.join(ROOT, "public", "demo", "housing_demo.xlsx"), "demo.json")

# курсовой датасет — только если лежит локально (в git его нет)
private = os.path.join(OUT, "private", "Dataset_(12).xlsx")
ref = xlsx_reference(private, os.path.join("private", "reference.json")) if os.path.exists(private) else None

# ---------------------------------------------------------------- synthetic
rng = np.random.default_rng(20261014)
syn = []


def add(name, y, X, names, extra=None):
    d = {"name": name, "y": y.tolist(), "X": [list(r) for r in X.T.tolist()], "names": names}
    d.update(full_tests(y, X, names))
    if extra:
        d.update(extra)
    syn.append(d)


# 1: малый N, непрерывные
N = 15
X1 = rng.normal(size=(N, 2)) * [3, 0.5] + [10, 1]
y1 = 2 + 0.7 * X1[:, 0] - 3 * X1[:, 1] + rng.normal(size=N)
add("small", y1, X1, ["x1", "x2"])
# 2: дамми + лог-нормальный y, N=60
N = 60
X2 = np.column_stack([rng.normal(50, 10, N), (rng.random(N) > 0.5).astype(float), rng.exponential(2, N)])
y2 = np.exp(1 + 0.02 * X2[:, 0] + 0.3 * X2[:, 1] + 0.1 * X2[:, 2] + rng.normal(0, 0.3, N))
add("dummy", y2, X2, ["inc", "male", "exper"])
# 3: большие масштабы (как цены), N=200, гетероскедастичность
N = 200
X3 = np.column_stack([rng.uniform(1e3, 1e5, N), rng.normal(0, 1, N), rng.integers(0, 4, N).astype(float)])
y3 = 1e4 + 0.05 * X3[:, 0] + 300 * X3[:, 1] + rng.normal(0, 1, N) * X3[:, 0] * 0.01
add("hetero", y3, X3, ["area", "z", "rooms"])
# 4: N=8 (swilk малых выборок)
N = 8
X4 = np.column_stack([np.arange(1, N + 1, dtype=float)])
y4 = 3 + 2 * X4[:, 0] + rng.normal(0, 1, N)
add("tiny", y4, X4, ["t"])
# 5: коллинеарность: x3 = x1 + 2*x2 (statsmodels — через pinv, сверяем на модели без x3)
N = 30
a = rng.normal(size=N); b = rng.normal(size=N)
X5 = np.column_stack([a, b])
y5 = 1 + a - b + rng.normal(size=N)
add("collinear", y5, X5, ["a", "b"], {"collinear_extra": (a + 2 * b).tolist()})

# shapiro на разных N (W и коэффициенты)
sw = []
for n in [3, 4, 7, 11, 12, 20, 48, 100, 500]:
    x = rng.standard_t(5, n)
    W, p = st.shapiro(x)
    sw.append({"x": x.tolist(), "W": float(W), "p": float(p)})
dump("synthetic.json", to_jsonable({"datasets": syn, "shapiro": sw}))
print("ok", len(syn), "datasets")
r = ref or demo
print("F", r["ols"]["F"], "ovtest", r["ovtest"]["F"], "het", r["hettest"], "bw", r["kdensity_bw"], "W", r["swilk_W"])
print("imtest", r["imtest"])
print("vif mean", r["vif"]["mean"], r["vif"]["rows"][:2])
print("linktest", r["linktest"]["F"], r["linktest"]["b"])
