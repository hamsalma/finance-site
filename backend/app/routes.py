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

# --- ROUTE DE SIMULATION ---
@bp.route("/simulate", methods=["POST"])
def simulate_portfolio():
    data = request.get_json()
    
    montant_initial = float(data.get("montant_initial", 0))
    contribution = float(data.get("contribution", 0))
    frequence = data.get("frequence", "annuelle")
    duree = int(data.get("duree", 0))
    actif = data.get("actif", "actions")

    # Validation
    if montant_initial <= 0 or duree <= 0:
        return jsonify({"error": "Montant initial et durée doivent être positifs."}), 400

    # --- Paramètres ---
    frais_gestion = 0.005  # 0,5 %
    taux_sans_risque = 0.02  # 2 %

    # Multiplicateur selon fréquence
    freq_map = {
        "mensuelle": 12,
        "trimestrielle": 4,
        "semestrielle": 2,
        "annuelle": 1
    }
    freq_multiplicateur = freq_map.get(frequence, 1)
    periodes = duree * freq_multiplicateur

    # --- Simulation réaliste du portefeuille ---
    # Rendement moyen 6 % par an, volatilité 10 % annualisée
    rendement_moyen_annuel = 0.06
    volatilite_annuelle = 0.10

    # Conversion par période
    rendement_moyen = rendement_moyen_annuel / freq_multiplicateur
    volatilite_par_periode = volatilite_annuelle / np.sqrt(freq_multiplicateur)

    rendements = np.random.normal(rendement_moyen, volatilite_par_periode, periodes)

    valeurs = [montant_initial]
    for r in rendements:
        nouvelles_valeurs = valeurs[-1] * (1 + r) + contribution
        nouvelles_valeurs *= (1 - frais_gestion / freq_multiplicateur)
        valeurs.append(nouvelles_valeurs)

    portefeuille_final = valeurs[-1]

    # --- Calculs des ratios financiers ---
    rendements_portefeuille = np.diff(valeurs) / valeurs[:-1]
    volatilite = np.std(rendements_portefeuille) * np.sqrt(freq_multiplicateur)
    rendement_moyen_reel = np.mean(rendements_portefeuille) * freq_multiplicateur
    ratio_sharpe = (rendement_moyen_reel - taux_sans_risque) / volatilite if volatilite > 0 else 0
    cagr = (portefeuille_final / montant_initial) ** (1 / duree) - 1
    rendement_total = ((portefeuille_final - montant_initial) / montant_initial) * 100

    # --- Interprétations simples ---
    interpretations = {
        "volatilite": "Faible" if volatilite < 0.1 else "Modérée" if volatilite < 0.2 else "Élevée",
        "ratio_sharpe": "Excellent" if ratio_sharpe > 1 else "Correct" if ratio_sharpe > 0.5 else "Faible",
        "cagr": "Croissance soutenue" if cagr > 0.07 else "Croissance modérée" if cagr > 0 else "En baisse",
        "rendement_total": "Portefeuille gagnant" if rendement_total > 0 else "Portefeuille en perte"
    }

    result = {
        "inputs": {
            "montant_initial": montant_initial,
            "contribution": contribution,
            "frequence": frequence,
            "duree": duree,
            "actif": actif,
            "frais_gestion": frais_gestion
        },
        "resultats": {
            "portefeuille_final_estime": round(portefeuille_final, 2),
            "total_contribution": round(contribution * freq_multiplicateur * duree, 2),
            "volatilite": round(volatilite, 4),
            "ratio_sharpe": round(ratio_sharpe, 4),
            "cagr": round(cagr, 4),
            "rendement_total": round(rendement_total, 2)
        },
        "interpretations": interpretations
    }

    return jsonify(result)
