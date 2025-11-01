import yfinance as yf
from flask import Blueprint, jsonify, request
import numpy as np

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
        "actif": actif
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
    import yfinance as yf

    data = request.get_json()
    montant_initial = float(data.get("montant_initial", 10000))
    date_debut = int(data.get("date_debut", 2015))
    date_fin = int(data.get("date_fin", 2025))

    try:
        # Téléchargement des données
        acwi = yf.download("ACWI", start=f"{date_debut}-01-01", end=f"{date_fin}-12-31", progress=False)

        if acwi.empty:
            acwi = yf.download("URTH", start=f"{date_debut}-01-01", end=f"{date_fin}-12-31", progress=False)

        if acwi.empty:
            return jsonify({"error": "Aucune donnée trouvée pour l’indice ACWI."}), 404

        # Calcul du rendement cumulé
        acwi["Rendement"] = acwi["Adj Close"].pct_change()
        acwi["Croissance"] = (1 + acwi["Rendement"]).cumprod() * montant_initial

        # Simplification : 1 point par mois
        acwi_monthly = acwi.resample("M").last()

        data_points = [
            {"date": d.strftime("%Y-%m"), "valeur": round(float(v), 2)}
            for d, v in zip(acwi_monthly.index, acwi_monthly["Croissance"])
        ]

        return jsonify({"acwi": data_points})

    except Exception as e:
        return jsonify({"error": f"Erreur téléchargement ACWI : {str(e)}"}), 500
