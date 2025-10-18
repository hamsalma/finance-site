import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_URL = "http://127.0.0.1:5000";

export default function SimulationForm() {
  const [formData, setFormData] = useState({
    montant_initial: "",
    contribution: "",
    frequence: "mensuelle",
    actif: "actions",
    date_debut: "",
    date_fin: "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const currentYear = new Date().getFullYear();
    const dateDebut = parseInt(formData.date_debut);
    let dateFin = formData.date_fin ? parseInt(formData.date_fin) : currentYear;

    if (dateDebut < 1950 || dateDebut > currentYear) {
      alert(`Année de début : 1950 → ${currentYear}`);
      setLoading(false);
      return;
    }
    if (dateFin < dateDebut) {
      alert(`Année de fin doit être ≥ année de début`);
      setLoading(false);
      return;
    }

    const duree = dateFin - dateDebut;

    const dataToSend = {
      montant_initial: parseFloat(formData.montant_initial),
      contribution: parseFloat(formData.contribution),
      frequence: formData.frequence,
      duree: duree,
      actif: formData.actif,
    };

    try {
      const res = await fetch(`${API_URL}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      const data = await res.json();

      // ⚙️ Génération d’un historique simulé (pour affichage du graphique)
      const historique = [];
      const valeurInit = data.inputs.montant_initial;
      const totalFinal = data.resultats.portefeuille_final_estime;
      const steps = data.inputs.duree || 5;

      for (let i = 0; i <= steps; i++) {
        const valeur =
          valeurInit + ((totalFinal - valeurInit) * i) / steps;
        historique.push({ periode: `Année ${i}`, valeur: valeur.toFixed(2) });
      }

      data.resultats.historique = historique;

      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Erreur connexion serveur Flask.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1 className="page-title">Simulation de Portefeuille</h1>

      <div className="simulation-grid">
        {/* FORMULAIRE */}
        <form onSubmit={handleSubmit} className="simulation-form">
          <h2>Paramètres du portefeuille</h2>

          <label>
            Montant initial (€) :
            <input
              type="number"
              name="montant_initial"
              value={formData.montant_initial}
              onChange={handleChange}
              placeholder="Ex : 100"
              required
            />
          </label>

          <label>
            Contribution périodique (€) :
            <input
              type="number"
              name="contribution"
              value={formData.contribution}
              onChange={handleChange}
              placeholder="Ex : 50"
              required
            />
          </label>

          <label>
            Fréquence :
            <select
              name="frequence"
              value={formData.frequence}
              onChange={handleChange}
            >
              <option value="mensuelle">Mensuelle</option>
              <option value="trimestrielle">Trimestrielle</option>
              <option value="semestrielle">Semestrielle</option>
              <option value="annuelle">Annuelle</option>
            </select>
          </label>

          <label>
            Année de début :
            <input
              type="number"
              name="date_debut"
              value={formData.date_debut}
              onChange={handleChange}
              min="1950"
              max={new Date().getFullYear()}
              placeholder="Ex : 2000"
              required
            />
          </label>

          <label>
            Année de fin (optionnelle) :
            <input
              type="number"
              name="date_fin"
              value={formData.date_fin}
              onChange={handleChange}
              min="1950"
              max={new Date().getFullYear()}
              placeholder={`Si vide → ${new Date().getFullYear()}`}
            />
          </label>

          <label>
            Type d’actif :
            <select
              name="actif"
              value={formData.actif}
              onChange={handleChange}
            >
              <option value="actions">Actions</option>
              <option value="obligations">Obligations</option>
              <option value="etf">ETF</option>
            </select>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Calcul en cours..." : "Simuler"}
          </button>
        </form>

        {/* RÉSULTATS */}
        {result && (
          <div className="result-section">
            <h2>Résultats de la simulation</h2>

            <div className="cards-container">
              <div className="result-card">
                <h3>Montant total investi</h3>
                <p>
                  {(
                    result?.inputs?.montant_initial +
                    result?.resultats?.total_contribution
                  ).toFixed(2)}{" "}
                  €
                </p>
              </div>

              <div className="result-card">
                <h3>Durée</h3>
                <p>{result?.inputs?.duree ?? 0} années</p>
              </div>

              <div className="result-card">
                <h3>Volatilité</h3>
                <p>
                  {(result?.resultats?.volatilite * 100 ?? 0).toFixed(2)}%
                </p>
                <small>{result?.interpretations?.volatilite}</small>
              </div>

              <div className="result-card">
                <h3>Ratio Sharpe</h3>
                <p>{result?.resultats?.ratio_sharpe ?? 0}</p>
                <small>{result?.interpretations?.ratio_sharpe}</small>
              </div>

              <div className="result-card">
                <h3>CAGR</h3>
                <p>{(result?.resultats?.cagr * 100 ?? 0).toFixed(2)}%</p>
                <small>{result?.interpretations?.cagr}</small>
              </div>

              <div className="result-card">
                <h3>Rendement total</h3>
                <p>{result?.resultats?.rendement_total ?? 0} %</p>
                <small>{result?.interpretations?.rendement_total}</small>
              </div>
            </div>

            {/* --- GRAPHIQUE D'ÉVOLUTION --- */}
            <div className="result-chart">
              <h3>Évolution simulée du portefeuille</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={result.resultats.historique}>
                  <Line
                    type="monotone"
                    dataKey="valeur"
                    stroke="#7b68ee"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <XAxis dataKey="periode" stroke="#aaa" />
                  <YAxis hide />
                  <Tooltip />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
