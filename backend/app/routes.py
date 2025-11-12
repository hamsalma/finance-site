import yfinance as yf
import numpy as np
import pandas as pd
from flask import Blueprint, jsonify, request
from sklearn.linear_model import LinearRegression
import scipy.stats as stats
import traceback

bp = Blueprint("routes", __name__)

# ────────────────────────────────
#  ROUTES DE BASE
# ────────────────────────────────
@bp.route("/")
def home():
    return "API de simulation de portefeuille — OK"

@bp.route("/test")
def health():
    return jsonify({"status": "ok"})

# ────────────────────────────────
#  1. SIMULATION DE PORTEFEUILLE
# ────────────────────────────────
@bp.route("/simulate", methods=["POST"])
def simulate_portfolio():
    data = request.get_json()
    montant_initial = float(data.get("montant_initial", 0))
    contribution = float(data.get("contribution", 0))
    frequence = data.get("frequence", "annuelle")
    duree = int(data.get("duree", 0))
    actif = data.get("actif", "actions")

    if montant_initial <= 0 or duree <= 0:
        return jsonify({"error": "Montant initial et durée doivent être positifs."}), 400

    # Paramètres selon le type d’actif
    frais_gestion_map = {"actions": 0.006, "etf": 0.004, "obligations": 0.002}
    taux_sans_risque_map = {"actions": 0.015, "etf": 0.017, "obligations": 0.02}
    frais_gestion = frais_gestion_map.get(actif, 0.005)
    taux_sans_risque = taux_sans_risque_map.get(actif, 0.017)

    freq_map = {"mensuelle": 12, "trimestrielle": 4, "semestrielle": 2, "annuelle": 1}
    n = freq_map.get(frequence, 1)
    periodes = duree * n

    valeurs = [montant_initial]
    for _ in range(periodes):
        nouvelle_valeur = (valeurs[-1] + contribution) * (1 - frais_gestion / n)
        valeurs.append(nouvelle_valeur)

    portefeuille_final = valeurs[-1]
    montant_total_investi = montant_initial + (contribution * n * duree)
    rendements = np.diff(valeurs) / valeurs[:-1]

    volatilite = np.std(rendements)
    cagr = (portefeuille_final / montant_initial) ** (1 / duree) - 1
    rendement_total = ((portefeuille_final - montant_initial) / montant_initial) * 100
    ratio_sharpe = ((rendement_total / 100) - taux_sans_risque) / volatilite if volatilite > 0 else 0

    historique = [{"periode": i, "valeur": round(v, 2)} for i, v in enumerate(valeurs)]
    rendements_histogramme = [{"periode": i + 1, "rendement": round(r * 100, 3)} for i, r in enumerate(rendements)]

    result = {
        "inputs": {
            "montant_initial": montant_initial,
            "contribution": contribution,
            "frequence": frequence,
            "duree": duree,
            "actif": actif,
            "date_debut": data.get("date_debut"),
            "date_fin": data.get("date_fin")
        },
        "resultats": {
            "portefeuille_final_estime": round(portefeuille_final, 2),
            "montant_total_investi": round(montant_total_investi, 2),
            "volatilite": round(volatilite, 4),
            "ratio_sharpe": round(ratio_sharpe, 4),
            "cagr": round(cagr, 4),
            "rendement_total": round(rendement_total, 2),
            "historique": historique,
            "rendements": rendements_histogramme
        }
    }
    return jsonify(result)

# ────────────────────────────────
#  2. COMPARAISON AVEC L’INDICE ACWI
# ────────────────────────────────
@bp.route("/compare_acwi", methods=["POST"])
def compare_acwi():
    data = request.get_json()
    montant_initial = float(data.get("montant_initial", 10000))
    portefeuille_final = float(data.get("portefeuille_final", montant_initial * 1.2))
    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))

    try:
        print(f"--- Téléchargement ACWI {date_debut}-{date_fin} ---")
        acwi = yf.download("ACWI", start=f"{date_debut}-01-01", end=f"{date_fin}-12-31", progress=False, auto_adjust=True)
        if acwi.empty:
            print("⚠️ Données vides pour ACWI, tentative URTH...")
            acwi = yf.download("URTH", start=f"{date_debut}-01-01", end=f"{date_fin}-12-31", progress=False, auto_adjust=True)

        if acwi.empty:
            return jsonify({"error": "Aucune donnée disponible pour ACWI/URTH."}), 404

        # 🔹 Nettoyage du DataFrame
        if isinstance(acwi.columns, pd.MultiIndex):
            acwi.columns = [c[-1] for c in acwi.columns]

        prix = acwi["Close"] if "Close" in acwi.columns else acwi.select_dtypes("number").iloc[:, 0]
        prix_mensuel = prix.resample("ME").last().dropna()

        if prix_mensuel.empty:
            return jsonify({"error": "Pas de données mensuelles valides pour ACWI."}), 404

        croissance_acwi = (1 + prix_mensuel.pct_change()).cumprod() * montant_initial
        croissance_acwi = croissance_acwi.dropna()

        n = len(croissance_acwi)
        portefeuille = np.linspace(montant_initial, portefeuille_final, n)

        # 🔹 Calculs de rendements (convertis en float)
        rendement_portefeuille = float(((portefeuille[-1] / portefeuille[0]) - 1) * 100)
        rendement_acwi = float(((croissance_acwi.iloc[-1] / croissance_acwi.iloc[0]) - 1) * 100)
        ecart = float(rendement_portefeuille - rendement_acwi)

        # 🔹 Interprétation dynamique
        if ecart > 1:
            interpretation = f"Votre portefeuille a surperformé l’indice ACWI IMI de {ecart:.2f}% sur la période {date_debut}-{date_fin}."
        elif ecart < -1:
            interpretation = f"Votre portefeuille a sous-performé l’indice ACWI IMI de {abs(ecart):.2f}% sur la période {date_debut}-{date_fin}."
        else:
            interpretation = f"La performance de votre portefeuille est similaire à celle de l’indice ACWI IMI (écart de {ecart:.2f}%)."

        # 🔹 Données pour graphique
        comparaison = [
            {
                "date": idx.strftime("%Y-%m"),
                "portefeuille": round(float(portefeuille[i]), 2),
                "acwi": round(float(croissance_acwi.iloc[i].item() if hasattr(croissance_acwi.iloc[i], "item") else croissance_acwi.iloc[i]), 2)
            }
            for i, idx in enumerate(croissance_acwi.index)
        ]

        print(f"✅ Données ACWI prêtes : {len(comparaison)} points")

        return jsonify({
            "comparaison": comparaison,
            "rendement_portefeuille": round(rendement_portefeuille, 2),
            "rendement_acwi": round(rendement_acwi, 2),
            "ecart": round(ecart, 2),
            "interpretation": interpretation
        })

    except Exception as e:
        print("\n❌ ERREUR /compare_acwi :", e)
        traceback.print_exc()
        return jsonify({"error": f"Erreur interne : {str(e)}"}), 500

# ────────────────────────────────
#  3. PRÉDICTION DES RENDEMENTS FUTURS
# ────────────────────────────────
@bp.route("/predict_returns", methods=["POST"])
def predict_returns():
    data = request.get_json()
    actif_type = data.get("actif", "defaut").lower()
    ticker = {"actions": "EWQ", "obligations": "EUNA.L", "etf": "ACWI"}.get(actif_type, "ACWI")
    date_debut, date_fin = int(data.get("date_debut", 2015)), int(data.get("date_fin", 2025))

    try:
        df = yf.download(ticker, start=f"{date_debut}-01-01", end=f"{date_fin}-12-31", progress=False)
        if isinstance(df.columns, pd.MultiIndex): df.columns = [c[-1] for c in df.columns]
        prix = df.get("Adj Close", df.get("Close", df.select_dtypes("number").iloc[:, 0]))
        if prix.empty: return jsonify({"error": f"Aucune donnée trouvée pour {ticker}."}), 404

        df["Return"] = prix.pct_change() * 100
        df = df.dropna().reset_index()
        X, y = np.arange(len(df)).reshape(-1, 1), df["Return"].values.reshape(-1, 1)

        model = LinearRegression().fit(X, y)
        trend, beta = model.predict(X).flatten(), float(model.coef_[0])
        future_pred = model.predict(np.arange(len(df), len(df) + 12).reshape(-1, 1)).flatten()

        residuals = y.flatten() - trend
        std = np.std(residuals)
        conf = 0.95
        stderr = std / np.sqrt(len(df))
        t_crit = stats.t.ppf((1 + conf) / 2, df=len(df) - 1)
        margin = t_crit * stderr

        hist_data = [{"periode": i + 1, "rendement": float(df["Return"].iloc[i]), "tendance": float(trend[i])} for i in range(len(df))]
        future_data = [{"periode": len(df) + i + 1, "prediction": float(future_pred[i])} for i in range(len(future_pred))]

        return jsonify({
            "actif": ticker,
            "beta": beta,
            "historique": hist_data,
            "futur": future_data,
            "rendement_moyen": round(np.mean(df["Return"]), 5),
            "rendement_prevu_moyen": round(np.mean(future_pred), 5),
            "ecarts_types": {"σ": round(std / 100, 5), "2σ": round(2 * std / 100, 5), "3σ": round(3 * std / 100, 5)},
            "intervalle_confiance": {"niveau": f"{int(conf * 100)}%", "borne_inf": round(np.mean(future_pred) - margin, 4), "borne_sup": round(np.mean(future_pred) + margin, 4)}
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────
#  4. COMPARAISON DCA VS LUMP SUM
# ────────────────────────────────
@bp.route("/compare_strategies", methods=["POST"])
def compare_strategies():
    data = request.get_json()
    montant_initial = float(data.get("montant_initial", 12000))
    date_debut, date_fin = int(data.get("date_debut", 2015)), int(data.get("date_fin", 2025))
    ticker = {"actions": "EWQ", "obligations": "EUNA.L", "etf": "ACWI"}.get(data.get("actif", "etf").lower(), "ACWI")

    try:
        df = yf.download(ticker, start=f"{date_debut}-01-01", end=f"{date_fin}-12-31", progress=False, auto_adjust=True)
        if df.empty: return jsonify({"error": f"Aucune donnée trouvée pour {ticker}."}), 404

        prix_mensuel = df["Close"].resample("ME").last().dropna()
        n = len(prix_mensuel)
        contribution = montant_initial / n

        lump_sum = montant_initial * (prix_mensuel / prix_mensuel.iloc[0])
        valeur_dca = (contribution / prix_mensuel).cumsum() * prix_mensuel
        valeur_trim = ((montant_initial / len(prix_mensuel[::3])) / prix_mensuel[::3]).cumsum().reindex(prix_mensuel.index, method="ffill") * prix_mensuel
        valeur_sem = ((montant_initial / len(prix_mensuel[::6])) / prix_mensuel[::6]).cumsum().reindex(prix_mensuel.index, method="ffill") * prix_mensuel
        valeur_ann = ((montant_initial / len(prix_mensuel[::12])) / prix_mensuel[::12]).cumsum().reindex(prix_mensuel.index, method="ffill") * prix_mensuel

        data_points = [
        {
        "date": date.strftime("%Y-%m"),
        "LumpSum": round(float(lump_sum.iloc[i]), 2),
        "DCA_mensuel": round(float(valeur_dca.iloc[i]), 2),
        "DCA_trimestriel": round(float(valeur_trim.iloc[i]), 2),
        "DCA_semestriel": round(float(valeur_sem.iloc[i]), 2),
        "DCA_annuel": round(float(valeur_ann.iloc[i]), 2),
        }
        for i, date in enumerate(prix_mensuel.index)
    ]


        rendements = {
            k: float(round((v.iloc[-1] / montant_initial - 1) * 100, 2))
            for k, v in {
                "LumpSum": lump_sum,
                "DCA_mensuel": valeur_dca,
                "DCA_trimestriel": valeur_trim,
                "DCA_semestriel": valeur_sem,
                "DCA_annuel": valeur_ann,
            }.items()
        }

        return jsonify({
            "strategies": [dict(point) for point in data_points],
            "rendements": {k: float(v) for k, v in rendements.items()}
        })

    except Exception as e:
        print("\n❌ ERREUR /compare_strategies :", e)
        traceback.print_exc()
        return jsonify({"error": f"Erreur interne : {str(e)}"}), 500

