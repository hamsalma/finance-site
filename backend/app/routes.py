import yfinance as yf
import numpy as np
import pandas as pd
from flask import Blueprint, jsonify, request
from sklearn.linear_model import LinearRegression
import scipy.stats as stats
import traceback

bp = Blueprint("routes", __name__)

# ===============================
#  UNIVERSE D’INDICES EU / MONDIAUX
# ===============================
UNIVERSE = {
  "actions": {
    "AIR.PA": "Airbus SE (AIR.PA)",
    "OR.PA": "L’Oréal (OR.PA)",
    "MC.PA": "LVMH Moët Hennessy Louis Vuitton (MC.PA)",
    "BNP.PA": "BNP Paribas (BNP.PA)",
    "SAN.PA": "Sanofi (SAN.PA)",
  },
  "obligations": {
    "IEAC.L": "iShares Euro Corporate Bond (IEAC.L)",
    "ECRP.PA": "Amundi Euro Corporate Bond (ECRP.PA)",
    "IBGX.MI": "iShares € Corp Bond (IBGX.MI)",
  },
  "etf": {
    "ACWI": "iShares MSCI ACWI (ACWI)",
    "URTH": "iShares MSCI World (URTH)",
    "IWDA.AS": "iShares Core MSCI World (IWDA.AS)",
  },
}
# ============  UTILITAIRES =============
def resolve_ticker(category, ticker):
    category = (category or "etf").lower()
    if ticker and str(ticker).strip():
        return ticker.strip()
    if category in UNIVERSE and UNIVERSE[category]:
        return list(UNIVERSE[category].keys())[0]
    return "ACWI"


def safe_download(ticker, start, end, auto_adjust=True):
    try:
        df = yf.download(ticker, start=start, end=end, progress=False, auto_adjust=auto_adjust)
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[-1] for c in df.columns]
        return df
    except Exception:
        return None


def pick_price(df):
    if df is None or df.empty:
        return None
    if "Adj Close" in df.columns:
        return df["Adj Close"]
    if "Close" in df.columns:
        return df["Close"]
    num = df.select_dtypes(include="number")
    return num.iloc[:, 0] if num.shape[1] else None


# ===============================
#  ROUTES DE BASE
# ===============================
@bp.route("/")
def home():
    return "API de simulation de portefeuille — OK"


@bp.route("/test")
def health():
    return jsonify({"status": "ok"})


# ===============================
#  1. SIMULATION DE PORTEFEUILLE
# ===============================
@bp.route("/simulate", methods=["POST"])
def simulate_portfolio():
    data = request.get_json() or {}

    # --------- Entrées ----------
    montant_initial = float(data.get("montant_initial", 0))
    contribution = float(data.get("contribution", 0))
    frequence = data.get("frequence", "mensuelle")
    duree = int(data.get("duree", 0))
    actif = (data.get("actif") or "etf").lower()
    ticker = resolve_ticker(actif, data.get("ticker"))
    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))

    if montant_initial <= 0 or duree <= 0:
        return jsonify({"error": "Montant initial et durée doivent être positifs."}), 400

    # --------- Paramètres ----------
    frais_gestion_map = {"actions": 0.006, "etf": 0.004, "obligations": 0.002}
    taux_sans_risque_map = {"actions": 0.015, "etf": 0.017, "obligations": 0.02}

    frais_gestion_annuel = frais_gestion_map.get(actif, 0.005)
    taux_sans_risque = taux_sans_risque_map.get(actif, 0.017)

    # --------- Téléchargement ----------
    try:
        df = safe_download(
            ticker,
            f"{date_debut}-01-01",
            f"{date_fin}-12-31",
            auto_adjust=True,
        )
        if df is None or df.empty:
            return jsonify({"error": f"Aucune donnée trouvée pour {ticker}."}), 404

        prix = pick_price(df)
        if prix is None or prix.empty:
            return jsonify({"error": f"Pas de colonne de prix valide pour {ticker}."}), 404

        prix_mensuel = prix.resample("ME").last().dropna()
        if len(prix_mensuel) < 2:
            return jsonify({"error": "Historique insuffisant."}), 400

        # --------- Conversion séries ----------
        dates = prix_mensuel.index
        prices = prix_mensuel.values.astype(float)

        # Fréquence DCA
        step_map = {"mensuelle": 1, "trimestrielle": 3, "semestrielle": 6, "annuelle": 12}
        step = step_map.get(frequence, 1)
        n = step  

        # --------- Simulation portefeuille ----------
        units = 0.0
        valeurs = []
        montant_total_investi = 0.0

        first_price = prices[0]
        if first_price <= 0:
            return jsonify({"error": "Prix initial invalide."}), 400

        units = montant_initial / first_price
        montant_total_investi += montant_initial

        frais_mensuel = frais_gestion_annuel / 12.0

        for i, (dt, price) in enumerate(zip(dates, prices)):
            price = float(price)
            if price <= 0:
                continue

            if i > 0 and contribution > 0 and (i % step == 0):
                units += contribution / price
                montant_total_investi += contribution

            valeur_brute = units * price
            valeur_nette = valeur_brute * (1 - frais_mensuel)

            units = valeur_nette / price
            valeurs.append(valeur_nette)

        if len(valeurs) < 2:
            return jsonify({"error": "Simulation trop courte."}), 400

        portefeuille_final = valeurs[-1]

        valeurs_arr = np.array(valeurs)
        rendements_portefeuille = np.diff(valeurs_arr) / valeurs_arr[:-1]

        # Volatilité annualisée
        volatilite_m = float(np.std(rendements_portefeuille, ddof=1))
        volatilite_annuelle = volatilite_m * np.sqrt(12) if volatilite_m > 0 else 0.0

        # Rendement total
        rendement_total = ((portefeuille_final - montant_total_investi) / montant_total_investi) * 100

        # Durée effective
        duree_effective = (dates[-1] - dates[0]).days / 365.25
        if duree_effective <= 0:
            duree_effective = max(duree, 1e-9)

        # CAGR vrai
        valeur_initiale = valeurs[0]
        cagr = (portefeuille_final / valeur_initiale) ** (1 / duree_effective) - 1

        # Sharpe
        sharpe = (cagr - taux_sans_risque) / volatilite_annuelle if volatilite_annuelle > 0 else 0.0

        # --------- Historique et rendements ----------
        historique = [
            {"periode": i + 1, "valeur": round(float(v), 2)}
            for i, v in enumerate(valeurs)
        ]

        dates_r = prix_mensuel.index[1:]
        rendements_histogramme = [
            {
                "periode": i + 1,
                "date": dates_r[i].strftime("%Y-%m"),
                "rendement": round(float(r) * 100, 3),
            }
            for i, r in enumerate(rendements_portefeuille)
        ]

        # --------- Sharpe Rolling ----------
        sharpe_rolling = []
        if len(rendements_portefeuille) >= 3:
            window = min(6, len(rendements_portefeuille))
            rf_period = (1 + taux_sans_risque) ** (1 / 12) - 1

            for i in range(window - 1, len(rendements_portefeuille)):
                win = rendements_portefeuille[i - window + 1 : i + 1]
                excess = win - rf_period
                m = excess.mean()
                s = excess.std()
                sharpe_val = float(m / s) if s > 0 else 0.0

                sharpe_rolling.append({
                    "periode": i + 1,
                    "valeur": round(sharpe_val, 3)
                })

        # --------- PER pédagogique ----------
        per_series = []
        if len(prix_mensuel) >= 3:
            pm = prix_mensuel.copy()
            r_actif = pm.pct_change().dropna()

            prix0 = float(pm.iloc[0])
            earnings = prix0 / 15.0  

            for i in range(1, len(pm)):
                ret = float(r_actif.iloc[i - 1])
                earnings *= (1 + 0.3 * ret)
                per_val = float(pm.iloc[i]) / earnings if earnings != 0 else 0.0

                per_series.append({
                    "periode": i,
                    "date": pm.index[i].strftime("%Y-%m"),
                    "per": round(per_val, 2),
                })
                
        return jsonify({
            "inputs": {
                "montant_initial": montant_initial,
                "contribution": contribution,
                "frequence": frequence,
                "duree": duree,
                "actif": actif,
                "ticker": ticker,
                "date_debut": date_debut,
                "date_fin": date_fin,
            },
            "resultats": {
                "portefeuille_final_estime": round(float(portefeuille_final), 2),
                "montant_total_investi": round(float(montant_total_investi), 2),
                "volatilite": round(float(volatilite_annuelle), 4),
                "ratio_sharpe": round(float(sharpe), 4),
                "cagr": round(float(cagr), 4),
                "rendement_total": round(float(rendement_total), 2),

                "historique": historique,
                "rendements": rendements_histogramme,
                "sharpe_rolling": sharpe_rolling,
                "per_series": per_series,

                "taux_sans_risque": taux_sans_risque,
            },
        })

    except Exception as e:
        print("❌ ERREUR /simulate :", e)
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ===============================
#  2. COMPARAISON AVEC ACWI
# ===============================
@bp.route("/compare_acwi", methods=["POST"])
def compare_acwi():
    data = request.get_json() or {}

    montant_initial = float(data.get("montant_initial", 10000))
    contribution = float(data.get("contribution", 0))
    frequence = data.get("frequence", "mensuelle")
    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))

    rendement_portefeuille = float(data.get("rendement_portefeuille", 0.0))
    hist_sim = data.get("historique_portefeuille") or []

    if not hist_sim:
        return jsonify({"error": "Aucun historique de portefeuille reçu."}), 400

    try:
        acwi_df = safe_download("ACWI", f"{date_debut}-01-01", f"{date_fin}-12-31", auto_adjust=True)
        if acwi_df is None or acwi_df.empty:
            acwi_df = safe_download("URTH", f"{date_debut}-01-01", f"{date_fin}-12-31", auto_adjust=True)
        if acwi_df is None or acwi_df.empty:
            return jsonify({"error": "Aucune donnée ACWI/URTH."}), 404

        prix_acwi = pick_price(acwi_df)
        prix_acwi_m = prix_acwi.resample("ME").last().dropna()
        if len(prix_acwi_m) < 2:
            return jsonify({"error": "Historique ACWI insuffisant."}), 400

        n_port = len(hist_sim)
        n_acwi = len(prix_acwi_m)

        n = min(n_port, n_acwi)
        if n < 2:
            return jsonify({"error": "Pas assez de données communes pour comparer."}), 400

        acwi_prices = prix_acwi_m.iloc[-n:]
        dates = acwi_prices.index
        hist_vals = [float(h["valeur"]) for h in hist_sim][-n:]

        step_map = {"mensuelle": 1, "trimestrielle": 3, "semestrielle": 6, "annuelle": 12}
        step = step_map.get(frequence, 1)

        units_acwi = 0.0
        valeurs_acwi = []
        montant_total_investi_acwi = 0.0

        prices = acwi_prices.values.astype(float)

        first_price = prices[0]
        if first_price <= 0:
            return jsonify({"error": "Prix ACWI initial invalide."}), 400

        units_acwi = montant_initial / first_price
        montant_total_investi_acwi += montant_initial

        for i, price in enumerate(prices):
            price = float(price)
            if price <= 0:
                continue

            if i > 0 and contribution > 0 and (i % step == 0):
                units_acwi += contribution / price
                montant_total_investi_acwi += contribution

            valeur = units_acwi * price  # pas de frais sur l'indice
            valeurs_acwi.append(float(valeur))

        if len(valeurs_acwi) < 2:
            return jsonify({"error": "Simulation ACWI trop courte."}), 400

        acwi_final = valeurs_acwi[-1]

        rendement_acwi = (
            (acwi_final - montant_total_investi_acwi) / montant_total_investi_acwi * 100
            if montant_total_investi_acwi > 0 else 0.0
        )

        ecart = rendement_portefeuille - rendement_acwi

        if ecart > 1:
            interpretation = f"Votre portefeuille a surperformé l’indice ACWI IMI de {ecart:.2f} %."
        elif ecart < -1:
            interpretation = f"Votre portefeuille a sous-performé l’indice ACWI IMI de {abs(ecart):.2f} %."
        else:
            interpretation = f"La performance de votre portefeuille est proche de celle de l’indice ACWI IMI."

        comparaison = [
            {
                "date": dates[i].strftime("%Y-%m"),
                "portefeuille": round(hist_vals[i], 2),
                "acwi": round(valeurs_acwi[i], 2),
            }
            for i in range(n)
        ]

        return jsonify({
            "comparaison": comparaison,
            "rendement_portefeuille": round(float(rendement_portefeuille), 2),
            "rendement_acwi": round(float(rendement_acwi), 2),
            "ecart": round(float(ecart), 2),
            "interpretation": interpretation,
        })

    except Exception as e:
        print("❌ ERREUR /compare_acwi :", e)
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
# ===============================
#  3. PRÉDICTION DES RENDEMENTS
# ===============================
@bp.route("/predict_returns", methods=["POST"])
def predict_returns():
    data = request.get_json() or {}
    actif = (data.get("actif") or "etf").lower()
    ticker = resolve_ticker(actif, data.get("ticker"))
    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))

    try:
        df = safe_download(
            ticker,
            f"{date_debut}-01-01",
            f"{date_fin}-12-31",
            auto_adjust=True,
        )
        if df is None or df.empty:
            return jsonify({"error": f"Aucune donnée trouvée pour {ticker}."}), 404

        prix = pick_price(df)
        if prix is None or prix.empty:
            return jsonify({"error": f"Pas de colonne de prix valide pour {ticker}."}), 404

        prix_trimestriel = prix.resample("QE").last().dropna()
        rendements = prix_trimestriel.pct_change().dropna() * 100

        if len(rendements) < 10:
            return jsonify({"error": "Série trop courte pour effectuer une régression."}), 400

        X = np.arange(len(rendements)).reshape(-1, 1)
        y = rendements.values.astype(float)

        model = LinearRegression().fit(X, y)
        trend = model.predict(X)
        beta = float(model.coef_[0])  

        future_X = np.arange(len(rendements), len(rendements) + 12).reshape(-1, 1)
        future_pred = model.predict(future_X)

        residuals = y - trend
        std_resid = float(np.std(residuals, ddof=1))  

        mean_hist = float(np.mean(rendements))
        mean_future = float(np.mean(future_pred))

        n = len(rendements)
        stderr = std_resid / np.sqrt(n)
        t_crit = stats.t.ppf(0.975, df=max(n - 1, 1))
        margin = t_crit * stderr

        borne_inf = mean_future - margin
        borne_sup = mean_future + margin
        hist_data = [
                    {
                        "periode": i + 1,
                        "rendement": float(rendements.iloc[i]),
                        "tendance": float(trend[i]),
                    }
                    for i in range(len(rendements))
                    ]
        futur_data = [
            {"periode": len(rendements) + i + 1, "prediction": float(v)}
            for i, v in enumerate(future_pred)
        ]

        return jsonify({
            "actif": actif,
            "ticker": ticker,
            "beta": beta,
            "historique": hist_data,
            "futur": futur_data,
            "rendement_moyen": round(mean_hist, 4),             # en %
            "rendement_prevu_moyen": round(mean_future, 4),     # en %
            "ecarts_types": {
                "σ": round(std_resid, 4),
                "2σ": round(2 * std_resid, 4),
                "3σ": round(3 * std_resid, 4),
            },
            "intervalle_confiance": {
                "niveau": "95%",
                "borne_inf": round(borne_inf, 4),
                "borne_sup": round(borne_sup, 4),
            },
        })

    except Exception as e:
        print("❌ ERREUR /predict_returns :", e)
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ===============================
#  4. COMPARAISON DCA VS LUMP SUM
# ===============================
@bp.route("/compare_strategies", methods=["POST"])
def compare_strategies():
    data = request.get_json() or {}
    actif = (data.get("actif") or "etf").lower()
    ticker = resolve_ticker(actif, data.get("ticker"))
    montant_initial = float(data.get("montant_initial", 12000))
    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))

    try:
        df = safe_download(ticker, f"{date_debut}-01-01", f"{date_fin}-12-31", auto_adjust=True)
        if df is None or df.empty:
            return jsonify({"error": f"Aucune donnée trouvée pour {ticker}."}), 404
        prix = pick_price(df)
        prix_mensuel = prix.resample("ME").last().dropna()

        n = len(prix_mensuel)
        contribution = montant_initial / n

        # Lump sum
        lump_sum = montant_initial * (prix_mensuel / prix_mensuel.iloc[0])

        # DCA mensuel
        valeur_dca = (contribution / prix_mensuel).cumsum() * prix_mensuel

        # DCA trimestriel / semestriel / annuel
        valeur_trim = ((montant_initial / len(prix_mensuel[::3])) / prix_mensuel[::3]).cumsum().reindex(prix_mensuel.index, method="ffill") * prix_mensuel
        valeur_sem = ((montant_initial / len(prix_mensuel[::6])) / prix_mensuel[::6]).cumsum().reindex(prix_mensuel.index, method="ffill") * prix_mensuel
        valeur_ann = ((montant_initial / len(prix_mensuel[::12])) / prix_mensuel[::12]).cumsum().reindex(prix_mensuel.index, method="ffill") * prix_mensuel

        data_points = [
            {
                "date": d.strftime("%Y-%m"),
                "LumpSum": round(float(lump_sum.iloc[i]), 2),
                "DCA_mensuel": round(float(valeur_dca.iloc[i]), 2),
                "DCA_trimestriel": round(float(valeur_trim.iloc[i]), 2),
                "DCA_semestriel": round(float(valeur_sem.iloc[i]), 2),
                "DCA_annuel": round(float(valeur_ann.iloc[i]), 2),
            }
            for i, d in enumerate(prix_mensuel.index)
        ]

        rendements = {
            "LumpSum": round(float(lump_sum.iloc[-1] / montant_initial - 1) * 100, 2),
            "DCA_mensuel": round(float(valeur_dca.iloc[-1] / montant_initial - 1) * 100, 2),
            "DCA_trimestriel": round(float(valeur_trim.iloc[-1] / montant_initial - 1) * 100, 2),
            "DCA_semestriel": round(float(valeur_sem.iloc[-1] / montant_initial - 1) * 100, 2),
            "DCA_annuel": round(float(valeur_ann.iloc[-1] / montant_initial - 1) * 100, 2),
        }

        return jsonify({
            "ticker": ticker,
            "strategies": data_points,
            "rendements": rendements,
        })
    except Exception as e:
        print("❌ ERREUR /compare_strategies :", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

