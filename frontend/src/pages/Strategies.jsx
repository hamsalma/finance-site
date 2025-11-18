import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "../styles/strategies.css";

const API_URL = "http://127.0.0.1:5000";

export default function Strategies() {
  const navigate = useNavigate();
  const location = useLocation();
  const portefeuille = location.state?.portefeuille;

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const inputs = portefeuille?.inputs || {};
        const res = await fetch(`${API_URL}/compare_strategies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actif: inputs.actif || "etf",
            ticker: inputs.ticker || "ACWI",
            montant_initial: inputs.montant_initial || 10000,
            date_debut: inputs.date_debut || 2015,
            date_fin: inputs.date_fin || new Date().getFullYear(),
          }),
        });
        const data = await res.json();
        if (data.error) {
          alert(`Erreur serveur : ${data.error}`);
          return;
        }
        setPayload(data);
      } catch (err) {
        console.error(err);
        alert("Erreur lors du chargement des stratégies");
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, [portefeuille]);

  if (loading) return <p className="loading">Chargement des stratégies...</p>;
  if (!payload || !payload.strategies)
    return <p>❌ Aucune donnée disponible.</p>;

  // 🔹 Données du backend
  const data = payload.strategies;
  const rendement = payload.rendements;

  // 🔹 Détermination de la meilleure stratégie
  const bestKey = Object.keys(rendement).reduce((a, b) =>
    rendement[a] > rendement[b] ? a : b
  );
  const bestValue = rendement[bestKey];
  const avgValue =
    Object.values(rendement).reduce((a, b) => a + b, 0) /
    Object.values(rendement).length;

  // 🔹 Interprétation textuelle dynamique
  const interpretation = `La stratégie ${bestKey.replace("_", " ")} ressort comme la plus performante, avec un rendement total de ${bestValue.toFixed(
    2
  )} %. Cela représente environ ${(bestValue - avgValue).toFixed(
    1
  )} % de plus que la moyenne des autres méthodes. ${
    bestKey === "LumpSum"
      ? "Cette performance élevée indique qu’un investissement immédiat a mieux profité des hausses de marché sur la période."
      : "L’approche DCA s’est révélée plus stable, limitant les risques de volatilité à court terme."
  }`;

  return (
    <div className="strategies-page">
      <h1>Comparaison des stratégies — {payload.ticker || "Indice"}</h1>
      <p className="strategies-desc">
        Cette analyse compare différentes approches d’investissement :
        versement unique (Lump Sum) contre investissements réguliers (DCA).
      </p>

      {/* --- GRAPHIQUE PRINCIPAL --- */}
      <div className="strategies-chart">
        <h3>Évolution de la valeur du portefeuille (€)</h3>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart
            data={data}
            margin={{ top: 30, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="date" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip
              formatter={(v) => `${v.toFixed(2)} €`}
              labelFormatter={(v) => `Date : ${v}`}
            />
            <Legend verticalAlign="top" align="center" height={50} />
            <Line
              type="monotone"
              dataKey="LumpSum"
              stroke="#ff4c4c"
              strokeWidth={3}
              dot={false}
              name="Lump Sum (unique)"
            />
            <Line
              type="monotone"
              dataKey="DCA_mensuel"
              stroke="#7b68ee"
              strokeWidth={3}
              dot={false}
              name="DCA Mensuel"
            />
            <Line
              type="monotone"
              dataKey="DCA_trimestriel"
              stroke="#00bfff"
              strokeWidth={3}
              dot={false}
              name="DCA Trimestriel"
            />
            <Line
              type="monotone"
              dataKey="DCA_semestriel"
              stroke="#2ecc71"
              strokeWidth={3}
              dot={false}
              name="DCA Semestriel"
            />
            <Line
              type="monotone"
              dataKey="DCA_annuel"
              stroke="#f1c40f"
              strokeWidth={3}
              dot={false}
              name="DCA Annuel"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* --- CARTES DE RÉSULTATS --- */}
      <div className="strategies-results">
        <h3>Rendement total des stratégies</h3>
        <div className="strategies-grid">
          {Object.entries(rendement).map(([key, value]) => (
            <div
              key={key}
              className={`strategy-card ${key === bestKey ? "best" : ""}`}
            >
              <h4>{key.replace("_", " ")}</h4>
              <p>{value.toFixed(2)} %</p>
              {key === bestKey && <span className="badge">🏆 Meilleure</span>}
            </div>
          ))}
        </div>
      </div>

      {/* --- INTERPRÉTATION AUTOMATIQUE --- */}
      <div className="strategies-interpretation">
        <h3>Interprétation </h3>
        <p>{interpretation}</p>
      </div>

      {/* --- BOUTON RETOUR --- */}
      <div className="strategies-footer">
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
