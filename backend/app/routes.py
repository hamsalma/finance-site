import yfinance as yf
from flask import Blueprint, jsonify, request
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

bp = Blueprint("routes", __name__)

# --- ROUTE DE BASE ---
@bp.route("/")
def home():
    return "API de simulation de portefeuille — OK"

@bp.route("/test")
def health():
    return jsonify({"status": "ok"})

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

    if actif == "actions":
        frais_gestion = 0.006       # 0,6 % / an
        taux_sans_risque = 0.015    # 1,5 %
    elif actif == "etf":
        frais_gestion = 0.004       # 0,4 % / an
        taux_sans_risque = 0.017    # 1,7 %
    elif actif == "obligations":
        frais_gestion = 0.002       # 0,2 % / an
        taux_sans_risque = 0.02     # 2,0 %
    else:
        frais_gestion = 0.005
        taux_sans_risque = 0.017


    freq_map = {"mensuelle": 12, "trimestrielle": 4, "semestrielle": 2, "annuelle": 1}
    n = freq_map.get(frequence, 1)
    periodes = duree * n

    valeurs = [montant_initial]

    for _ in range(periodes):

        nouvelle_valeur = valeurs[-1] + contribution

        nouvelle_valeur *= (1 - frais_gestion / n)

        valeurs.append(nouvelle_valeur)

    portefeuille_final = valeurs[-1]

    montant_total_investi = montant_initial + (contribution * n * duree)

    rendements_portefeuille = np.diff(valeurs) / valeurs[:-1]

    volatilite = np.std(rendements_portefeuille)

    cagr = (portefeuille_final / montant_initial) ** (1 / duree) - 1

    rendement_total = ((portefeuille_final - montant_initial) / montant_initial) * 100

    R_p = rendement_total / 100
    ratio_sharpe = (R_p - taux_sans_risque) / volatilite if volatilite > 0 else 0

    # --- Historique du portefeuille (évolution cumulée) ---
    historique = [
    {"periode": i, "valeur": round(v, 2)}
    for i, v in enumerate(valeurs)
]

    # --- Rendements périodiques pour histogramme ---
    rendements_portefeuille = np.diff(valeurs) / valeurs[:-1]
    rendements_histogramme = [
    {"periode": i + 1, "rendement": round(r * 100, 3)}  # en %
    for i, r in enumerate(rendements_portefeuille)
]

    
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

@bp.route("/compare_acwi", methods=["POST"])
def compare_acwi():

    data = request.get_json()
    montant_initial = float(data.get("montant_initial", 10000))
    portefeuille_final = float(data.get("portefeuille_final", montant_initial * 1.2))
    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))

    try:
        print(f"--- Téléchargement ACWI de {date_debut} à {date_fin} ---")
        acwi = yf.download(
            "ACWI",
            start=f"{date_debut}-01-01",
            end=f"{date_fin}-12-31",
            progress=False,
            auto_adjust=True,  
        )

        if acwi.empty:
            print("⚠️ Données vides pour ACWI, tentative avec URTH…")
            acwi = yf.download(
                "URTH",
                start=f"{date_debut}-01-01",
                end=f"{date_fin}-12-31",
                progress=False,
                auto_adjust=True,
            )
        if acwi.empty:
            return jsonify({"error": "Aucune donnée disponible pour ACWI/URTH."}), 404


        close_series = None
        if isinstance(acwi.columns, pd.MultiIndex):
            candidates = [c for c in acwi.columns
                          if any(str(level).lower() in ("adj close", "close") for level in (c if isinstance(c, tuple) else (c,)))]
            if candidates:
                close_series = acwi[candidates[0]]
        
        if close_series is None:
            if "Adj Close" in acwi.columns:
                close_series = acwi["Adj Close"]
            elif "Close" in acwi.columns:
                close_series = acwi["Close"]

        if close_series is None:
            num_cols = acwi.select_dtypes(include="number")
            if num_cols.shape[1] == 0:
                return jsonify({"error": "Aucune colonne numérique exploitable dans ACWI."}), 500
            close_series = num_cols.iloc[:, 0]

        monthly_close = close_series.resample("M").last().dropna()
        if monthly_close.empty:
            return jsonify({"error": "Pas de points mensuels valides pour l’indice."}), 400

        monthly_ret = monthly_close.pct_change()
        acwi_growth = (1.0 + monthly_ret).cumprod() * montant_initial
        acwi_growth = acwi_growth.dropna()

        n = len(acwi_growth)
        port_path = np.linspace(montant_initial, portefeuille_final, n)

        comparaison = [
            {
                "date": idx.strftime("%Y-%m"),
                "portefeuille": round(float(port_path[i]), 2),
                "acwi": round(float(acwi_growth.iloc[i]), 2),
            }
            for i, idx in enumerate(acwi_growth.index)
        ]

        print(f"✅ Données ACWI prêtes ({len(comparaison)} points)")
        return jsonify({"comparaison": comparaison})

    except Exception as e:
        import traceback
        print("❌ ERREUR /compare_acwi :", e)
        traceback.print_exc()
        return jsonify({"error": f"Erreur téléchargement ACWI : {str(e)}"}), 500

@bp.route("/predict_returns", methods=["POST"])
def predict_returns():
    import scipy.stats as stats

    data = request.get_json()

    actif_type = data.get("actif", "defaut").lower()
    actif_map = {
        "actions": "SPY",        # ETF d'actions US
        "obligations": "BND",    # ETF d’obligations
        "etf": "ACWI",           # ETF global
        "defaut": "ACWI"
    }
    ticker = actif_map.get(actif_type, "ACWI")

    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))
    montant_initial = float(data.get("montant_initial", 10000))

    try:
        print(f"--- Téléchargement historique {ticker} ({date_debut}-{date_fin}) ---")
        df = yf.download(
            ticker,
            start=f"{date_debut}-01-01",
            end=f"{date_fin}-12-31",
            progress=False
        )

        # 🔹 Normalisation du dataframe
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [col[-1] for col in df.columns]

        # 🔹 Choix du prix pertinent
        if "Adj Close" in df.columns:
            prix = df["Adj Close"]
        elif "Close" in df.columns:
            prix = df["Close"]
        else:
            num_cols = df.select_dtypes(include="number")
            if num_cols.shape[1] == 0:
                return jsonify({"error": "Aucune colonne de prix exploitable."}), 500
            prix = num_cols.iloc[:, 0]

        if prix.empty:
            return jsonify({"error": f"Aucune donnée trouvée pour {ticker}."}), 404

        # --- Calcul des rendements journaliers (%)
        df["Return"] = prix.pct_change() * 100
        df = df.dropna().reset_index()

        X = np.arange(len(df)).reshape(-1, 1)
        y = df["Return"].values.reshape(-1, 1)

        # --- Régression linéaire
        model = LinearRegression()
        model.fit(X, y)
        trend = model.predict(X).flatten()
        beta = float(model.coef_[0])

        # --- Projection sur 12 périodes futures
        future_X = np.arange(len(df), len(df) + 12).reshape(-1, 1)
        future_pred = model.predict(future_X).flatten()

        # --- Résidus et écarts-types
        residuals = y.flatten() - trend
        std_1 = np.std(residuals)
        std_2 = 2 * std_1
        std_3 = 3 * std_1

        # --- Intervalle de confiance empirique (Student)
        n = len(df)
        conf = 0.95
        stderr = np.std(residuals, ddof=1) / np.sqrt(n)
        t_crit = stats.t.ppf((1 + conf) / 2, df=n - 1)
        margin_error = t_crit * stderr
        ci_lower = np.mean(future_pred) - margin_error
        ci_upper = np.mean(future_pred) + margin_error

        # --- Données à renvoyer
        hist_data = [
            {"periode": i + 1, "rendement": float(df["Return"].iloc[i]),
             "tendance": float(trend[i])}
            for i in range(len(df))
        ]
        future_data = [
            {"periode": len(df) + i + 1, "prediction": float(future_pred[i])}
            for i in range(len(future_pred))
        ]

        print(f"✅ Prédiction terminée : {ticker} ({len(hist_data)} points)")

        return jsonify({
            "actif": ticker,
            "beta": beta,
            "historique": hist_data,
            "futur": future_data,
            "rendement_moyen": round(np.mean(df["Return"]), 5),
            "rendement_prevu_moyen": round(np.mean(future_pred), 5),
            "ecarts_types": {
                "σ": round(std_1 / 100, 5),  # ramené à proportions
                "2σ": round(std_2 / 100, 5),
                "3σ": round(std_3 / 100, 5)
            },
            "intervalle_confiance": {
                "niveau": f"{int(conf * 100)}%",
                "borne_inf": round(ci_lower, 4),
                "borne_sup": round(ci_upper, 4)
            }
        })

    except Exception as e:
        import traceback
        print("❌ ERREUR /predict_returns :", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500








