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

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export default function Predict() {
  const navigate = useNavigate();
  const location = useLocation();
  const portefeuille = location.state?.portefeuille;

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const inputs = portefeuille?.inputs || {};
        const res = await fetch(`${API_URL}/predict_returns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actif: inputs.actif || "etf",
            ticker: inputs.ticker || "ACWI",
            date_debut: inputs.date_debut || 2015,
            date_fin: inputs.date_fin || new Date().getFullYear(),
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
  if (!prediction || prediction.error) return <p>❌ Aucune donnée à afficher.</p>;

  const historique = prediction.historique || [];

  // --- Récupération des écarts-types (déjà en %) ---
  const sigma = prediction.ecarts_types?.["σ"] ?? 0;
  const sigma2 = prediction.ecarts_types?.["2σ"] ?? 0;
  const sigma3 = prediction.ecarts_types?.["3σ"] ?? 0;

  const mean = prediction.rendement_moyen || 0;
  const predMean = prediction.rendement_prevu_moyen || 0;

  const beta = prediction.beta || 0;

  const borneInf = prediction.intervalle_confiance?.borne_inf?.toFixed(2);
  const borneSup = prediction.intervalle_confiance?.borne_sup?.toFixed(2);
  const niveauConfiance = prediction.intervalle_confiance?.niveau || "95%";

  // --- Ligne de régression ---
  const tendance = historique.map((d) => ({
    periode: d.periode,
    valeur: d.tendance,
  }));

  // --- Texte interprétation ---
  const interpretation = (() => {
    const tendanceDirection =
      beta > 0
        ? "une tendance haussière 📈"
        : beta < 0
        ? "une tendance baissière 📉"
        : "une stabilité des rendements ⚪";

    const tendanceTexte =
      predMean > mean
        ? "une amélioration attendue des rendements futurs"
        : predMean < mean
        ? "un affaiblissement probable des performances"
        : "une stabilité prévue du rendement moyen futur";

    return `Le modèle linéaire montre ${tendanceDirection}, avec une volatilité σ ≈ ${sigma.toFixed(
      2
    )}% 
    et un rendement futur moyen estimé à ${predMean.toFixed(
      3
    )} %. L’intervalle de confiance à ${niveauConfiance} est compris entre ${borneInf}% et ${borneSup}%.`;
  })();

  return (
    <div className="predict-page">
      <h1>Analyse de régression linéaire — {prediction.actif}</h1>
      <p className="predict-desc">
        Visualisation scientifique : rendements historiques (nuage de points),
        droite de régression et bandes d’incertitude à ±σ, ±2σ, ±3σ.
      </p>

      {/* --- GRAPHE --- */}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={480}>
          <ScatterChart margin={{ top: 20, right: 40, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />

            <XAxis
              dataKey="periode"
              stroke="#ccc"
              label={{
                value: "Périodes trimestrielles",
                position: "insideBottom",
                offset: -5,
                fill: "#aaa",
              }}
              tick={{ fill: "#aaa" }}
            />
            <YAxis
              dataKey="rendement"
              stroke="#ccc"
              domain={["auto", "auto"]}
              label={{
                value: "Performance (%)",
                angle: -90,
                position: "insideLeft",
                fill: "#aaa",
              }}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />

            {/* --- Nuage de points --- */}
            <Scatter
              name="Rendements historiques"
              data={historique}
              fill="#ffffffdd"
              shape="circle"
              opacity={0.9}
            />

            {/* --- Droite de régression --- */}
            <Line
              type="linear"
              dataKey="valeur"
              data={tendance}
              stroke="#00e6b8"
              strokeWidth={3}
              dot={false}
              name="Régression linéaire"
            />

            {/* --- Bandes σ / 2σ / 3σ (déjà en %) --- */}
            <ReferenceLine y={sigma} stroke="#00bfff" strokeDasharray="4 4" />
            <ReferenceLine y={-sigma} stroke="#00bfff" strokeDasharray="4 4" />

            <ReferenceLine y={sigma2} stroke="#9370db" strokeDasharray="5 5" />
            <ReferenceLine y={-sigma2} stroke="#9370db" strokeDasharray="5 5" />

            <ReferenceLine y={sigma3} stroke="#ff6b6b" strokeDasharray="6 6" />
            <ReferenceLine y={-sigma3} stroke="#ff6b6b" strokeDasharray="6 6" />

            <Legend
              verticalAlign="top"
              align="center"
              height={50}
              wrapperStyle={{ color: "#ddd", fontWeight: 500 }}
              payload={[
                {
                  value: "Rendements historiques",
                  type: "circle",
                  color: "#ffffff",
                },
                { value: "Régression linéaire", type: "line", color: "#00e6b8" },
                { value: "±σ / ±2σ / ±3σ", type: "line", color: "#9370db" },
              ]}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* --- STATISTIQUES --- */}
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
            <p>{sigma.toFixed(2)} %</p>
          </div>
          <div className="stat-card">
            <h4>Volatilité 2σ / 3σ</h4>
            <p>
              {sigma2.toFixed(2)} % / {sigma3.toFixed(2)} %
            </p>
          </div>
        </div>
      </div>

      {/* --- INTERPRÉTATION --- */}
      <div className="predict-interpretation">
        <h4>Interprétation</h4>
        <p>{interpretation}</p>
      </div>

      <div className="predict-footer">
        <button
          className="back-button"
          onClick={() => navigate("/simulate", { state: { portefeuille } })}
        >
          ← Retour à la simulation
        </button>
      </div>
    </div>
  );
}
