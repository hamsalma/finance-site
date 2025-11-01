import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ScatterChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import "../styles/predict.css";

const API_URL = "http://127.0.0.1:5000";

export default function Predict() {
  const navigate = useNavigate();
  const location = useLocation();
  const portefeuille = location.state?.portefeuille;

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const res = await fetch(`${API_URL}/predict_returns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actif: portefeuille?.inputs?.actif || "ACWI",
            date_debut: portefeuille?.inputs?.date_debut || 2015,
            date_fin: portefeuille?.inputs?.date_fin || 2025,
            montant_initial: portefeuille?.inputs?.montant_initial || 10000,
          }),
        });
        const data = await res.json();
        setPrediction(data);
      } catch (err) {
        console.error(err);
        alert("Erreur lors du chargement des prédictions : " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPrediction();
  }, [portefeuille]);

  if (loading) return <p className="loading">Chargement des prédictions...</p>;
  if (!prediction || prediction.error)
    return <p>❌ Aucune donnée à afficher.</p>;

  const historique = prediction.historique || [];
  const sigma = prediction.ecarts_types["σ"];
  const sigma2 = prediction.ecarts_types["2σ"];
  const sigma3 = prediction.ecarts_types["3σ"];
  const mean = prediction.rendement_moyen * 100;
  const predMean = prediction.rendement_prevu_moyen * 100;

  const tendance = historique.map((d) => ({
    periode: d.periode,
    valeur: d.tendance,
  }));

  const interpretation = (() => {
    const volatilite = sigma * 100;
    const confiance = 99.7;
    let tendanceTexte =
      predMean > mean
        ? "une légère amélioration attendue des rendements futurs."
        : predMean < mean
        ? "un affaiblissement probable des performances à venir."
        : "une stabilité du rendement moyen futur.";
    return `Le modèle linéaire indique une volatilité estimée à ${volatilite.toFixed(
      2
    )}% et une tendance moyenne des rendements à ${(predMean).toFixed(
      3
    )}%. Avec un intervalle de confiance de ${confiance} %, on prévoit ${tendanceTexte}`;
  })();

  return (
    <div className="predict-page">
      <h1>Analyse de régression linéaire — {prediction.actif}</h1>
      <p className="predict-desc">
        Visualisation scientifique : rendements historiques (nuage de points),
        droite de régression et bandes d’incertitude à ±σ, ±2σ, ±3σ.
      </p>

      {/* --- GRAPHIQUE --- */}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={480}>
          <ScatterChart margin={{ top: 30, right: 30, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis
              dataKey="periode"
              name="Période"
              stroke="#ccc"
              label={{
                value: "Périodes (jours ou mois)",
                position: "insideBottom",
                offset: -5,
                fill: "#aaa",
              }}
              tick={{ fill: "#aaa" }}
              tickCount={8}
            />
            <YAxis
              dataKey="rendement"
              name="Rendement (%)"
              stroke="#ccc"
              domain={["auto", "auto"]}
              label={{
                value: "Rendement (%)",
                angle: -90,
                position: "insideLeft",
                fill: "#aaa",
              }}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />
            <Tooltip
              formatter={(v) => `${v.toFixed(3)} %`}
              labelFormatter={(v) => `Période : ${v}`}
            />
            <Legend verticalAlign="top" height={40} />

            {/* --- Données --- */}
            <Scatter
              name="Rendements historiques"
              data={historique}
              fill="#d9d9d9"
              opacity={0.75}
            />

            <Line
              type="linear"
              dataKey="valeur"
              data={tendance}
              stroke="#00e6b8"
              strokeWidth={2.5}
              dot={false}
              name="Régression linéaire"
            />

            {/* --- Bandes d’écart-type --- */}
            <ReferenceLine y={sigma * 100} stroke="#00bfff" strokeDasharray="3 3" label="+1σ" />
            <ReferenceLine y={-sigma * 100} stroke="#00bfff" strokeDasharray="3 3" label="-1σ" />
            <ReferenceLine y={sigma2 * 100} stroke="#9370db" strokeDasharray="4 4" label="+2σ" />
            <ReferenceLine y={-sigma2 * 100} stroke="#9370db" strokeDasharray="4 4" label="-2σ" />
            <ReferenceLine y={sigma3 * 100} stroke="#ff6b6b" strokeDasharray="4 4" label="+3σ" />
            <ReferenceLine y={-sigma3 * 100} stroke="#ff6b6b" strokeDasharray="4 4" label="-3σ" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* --- STATISTIQUES DYNAMIQUES --- */}
      <div className="stats-section">
        <h3>Résumé statistique</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Rendement moyen historique</h4>
            <p>{mean.toFixed(3)} %</p>
          </div>
          <div className="stat-card">
            <h4>Rendement prédit moyen</h4>
            <p>{predMean.toFixed(3)} %</p>
          </div>
          <div className="stat-card">
            <h4>Écart-type (σ)</h4>
            <p>{(sigma * 100).toFixed(2)} %</p>
          </div>
          <div className="stat-card">
            <h4>Volatilité 2σ / 3σ</h4>
            <p>
              {`${(sigma2 * 100).toFixed(2)} % / ${(sigma3 * 100).toFixed(2)} %`}
            </p>
          </div>
        </div>
      </div>

      {/* --- INTERPRÉTATION DYNAMIQUE --- */}
      <div className="predict-interpretation">
        <h4>Interprétation automatique</h4>
        <p>{interpretation}</p>
      </div>

      {/* --- BOUTON RETOUR --- */}
      <div className="predict-footer">
        <button
          className="back-button"
          onClick={() =>
            navigate("/simulate", { state: { portefeuille } })
          }
        >
          ← Retour à la simulation
        </button>
      </div>
    </div>
  );
}
