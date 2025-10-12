from flask import Blueprint, jsonify, request

bp = Blueprint("routes", __name__)

@bp.route("/")
def home():
    return "API de simulation de portefeuille — OK"

@bp.route("/test")
def health():
    return jsonify({"status": "ok"})

@bp.route("/simulate", methods=["POST"])
def simulate_portfolio():
    data = request.get_json()

    montant_initial = float(data.get('montant_initial', 0))
    contribution = float(data.get('contribution', 0))
    frequence = data.get('frequence')
    duree = int(data.get('duree', 0))
    actif = data.get('actif')

    # frais de gestion fixes
    frais_gestion = 0.5  

    total_contribution = contribution * duree
    portefeuille_final = (montant_initial + total_contribution) * (1 - frais_gestion)

    result = {
        "montant_initial": montant_initial,
        "contribution": contribution,
        "frequence": frequence,
        "duree": duree,
        "actif": actif,
        "frais_gestion": frais_gestion,
        "portefeuille_final_estime": round(portefeuille_final, 2)
    }

    return jsonify(result)
