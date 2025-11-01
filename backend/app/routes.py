import yfinance as yf
from flask import Blueprint, jsonify, request
import numpy as np
import pandas as pd

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



