import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/compare.css";

const API_URL = "http://127.0.0.1:5000";

export default function Compare() {
  const navigate = useNavigate();
  const location = useLocation();
  const portefeuille = location.state?.portefeuille;

  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  if (!portefeuille) {
    setLoading(false);
    return;
  }

  const fetchData = async () => {
    try {
      const inputs = portefeuille.inputs || {};
      const res = await fetch(`${API_URL}/compare_acwi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            montant_initial: inputs.montant_initial,
            montant_total_investi: portefeuille.resultats?.montant_total_investi,
            rendement_portefeuille: portefeuille.resultats?.rendement_total,
            historique_portefeuille: portefeuille.resultats?.historique,
            contribution: inputs.contribution,
            frequence: inputs.frequence,
            duree: inputs.duree,

            date_debut: parseInt(inputs.date_debut),
            date_fin: parseInt(inputs.date_fin),

            actif: inputs.actif,
            ticker: inputs.ticker,
        }),

      });

      const result = await res.json();
      if (result.error) {
        alert(result.error);
        return;
      }

      if (result?.comparaison?.length) {
        setData(result.comparaison);
        setMeta({
          interpretation: result.interpretation,
          r_port: result.rendement_portefeuille,
          r_acwi: result.rendement_acwi,
          ecart: result.ecart,
        });
      } else {
        alert("Aucune donnée à afficher.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors du chargement des données ACWI.");
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [portefeuille]);


  if (loading) return <p className="loading">Chargement des données...</p>;
  if (!data.length) return <p>❌ Aucune donnée à afficher.</p>;

  return (
    <div className="compare-page">
      <h1>Comparaison avec l’indice mondial ACWI IMI</h1>
      <p className="compare-desc">
        Ce graphique compare la performance de votre portefeuille simulé avec celle
        de l’indice mondial <strong>ACWI IMI</strong> (ETF iShares MSCI ACWI).
      </p>

      {/* --- GRAPHIQUE --- */}
      <div className="compare-chart">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
            <Legend verticalAlign="top" height={36} />
            <Line
              type="monotone"
              dataKey="portefeuille"
              stroke="#7b68ee"
              strokeWidth={3}
              dot={false}
              name="Votre portefeuille (€)"
            />
            <Line
              type="monotone"
              dataKey="acwi"
              stroke="#2ecc71"
              strokeWidth={3}
              dot={false}
              name="Indice ACWI IMI (€)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* --- INTERPRÉTATION --- */}
      {meta && (
        <div className="compare-interpretation">
          <h4>Interprétation</h4>
          <p>{meta.interpretation}</p>

          <div className="compare-stats">
            <p><strong>Rendement portefeuille :</strong> {meta.r_port?.toFixed(2)}%</p>
            <p><strong>Rendement ACWI IMI :</strong> {meta.r_acwi?.toFixed(2)}%</p>
            <p>
              <strong>Écart :</strong>{" "}
              {meta.ecart > 0 ? "+" : ""}
              {meta.ecart?.toFixed(2)}%
            </p>
          </div>

          <p className="compare-conclusion">
            Une surperformance indique une meilleure gestion ou un actif plus performant
            que le marché mondial. Une sous-performance signifie que le portefeuille
            a évolué moins rapidement que l’indice de référence.
          </p>
        </div>
      )}

      {/* --- RETOUR --- */}
      <div className="compare-footer">
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
