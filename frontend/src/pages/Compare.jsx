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

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/compare_acwi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            montant_initial: portefeuille?.inputs?.montant_initial || 10000,
            portefeuille_final:
              portefeuille?.resultats?.portefeuille_final_estime || 15000,
            date_debut: parseInt(portefeuille?.inputs?.date_debut) || 2015,
            date_fin: parseInt(portefeuille?.inputs?.date_fin) || 2025,
          }),
        });

        const result = await res.json();
        if (result.comparaison) setData(result);
        else alert("Aucune donnée à afficher.");
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

  return (
    <div className="compare-page">
      <h1>Comparaison avec l’indice mondial ACWI IMI</h1>
      <p className="compare-desc">
        Ce graphique compare la performance de votre portefeuille simulé avec
        celle de l’indice mondial <strong>ACWI IMI</strong> (ETF iShares ACWI).
      </p>

      <div className="compare-chart">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data.comparaison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip formatter={(v) => `${v.toFixed(2)} €`} />
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

      {/* --- Interprétation dynamique --- */}
      {data.interpretation && (
        <div className="compare-interpretation">
          <h4>Interprétation automatique</h4>
          <p>{data.interpretation}</p>
          <div className="compare-stats">
            <p>
              <strong>Rendement portefeuille :</strong>{" "}
              {data.rendement_portefeuille}%
            </p>
            <p>
              <strong>Rendement ACWI IMI :</strong> {data.rendement_acwi}%
            </p>
            <p>
              <strong>Écart :</strong>{" "}
              {data.ecart > 0 ? "+" : ""}
              {data.ecart}%
            </p>
          </div>
        </div>
      )}

      <div className="compare-footer">
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
