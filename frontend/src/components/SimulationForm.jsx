import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/simulationForm.css";

const API_URL = "http://127.0.0.1:5000";

export default function SimulationForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    montant_initial: "",
    contribution: "",
    frequence: "mensuelle",
    actif: "",
    date_debut: "",
    date_fin: "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.portefeuille) {
      const p = location.state.portefeuille.inputs || {};
      setFormData({
        montant_initial: p.montant_initial ?? "",
        contribution: p.contribution ?? "",
        frequence: p.frequence ?? "mensuelle",
        actif: p.actif ?? "",
        date_debut: p.date_debut ?? "",
        date_fin: p.date_fin ?? "",
      });
      setResult(location.state.portefeuille);
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const currentYear = new Date().getFullYear();
    const dateDebut = parseInt(formData.date_debut);
    const dateFin = formData.date_fin ? parseInt(formData.date_fin) : currentYear;

    if (isNaN(dateDebut) || dateDebut < 1950 || dateDebut > currentYear) {
      alert(`Année de début : 1950 → ${currentYear}`);
      setLoading(false);
      return;
    }
    if (isNaN(dateFin) || dateFin < dateDebut) {
      alert("Année de fin doit être ≥ année de début");
      setLoading(false);
      return;
    }

    const duree = dateFin - dateDebut;

    const dataToSend = {
      montant_initial: parseFloat(formData.montant_initial),
      contribution: parseFloat(formData.contribution),
      frequence: formData.frequence,
      duree,
      actif: formData.actif || "defaut",
      date_debut: dateDebut,   // <-- IMPORTANT
      date_fin: dateFin,       // <-- IMPORTANT
    };

    try {
      const res = await fetch(`${API_URL}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      const data = await res.json();

      const enriched = {
        ...data,
        inputs: {
          ...(data.inputs || {}),
          date_debut: dateDebut,
          date_fin: dateFin,
        },
      };

      setResult(enriched);
    } catch (err) {
      console.error(err);
      alert("Erreur connexion serveur Flask.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simulate-page">
      <h1 className="page-title">Simulation de Portefeuille</h1>

      {/* --- SECTION PRINCIPALE --- */}
      <div className="main-section align-blocks">
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
              placeholder="Ex : 1000"
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
            Année de fin (Par défaut “2025”) :
            <input
              type="number"
              name="date_fin"
              value={formData.date_fin}
              onChange={handleChange}
              min="1950"
              max={new Date().getFullYear()}
              placeholder={`Ex : ${new Date().getFullYear()}`}
            />
          </label>

          <label>
            Type d’actif :
            <select
              name="actif"
              value={formData.actif}
              onChange={handleChange}
            >
              <option value="">— Sélectionnez —</option>
              <option value="actions">Actions</option>
              <option value="obligations">Obligations</option>
              <option value="etf">ETF</option>
            </select>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Calcul en cours..." : "Simuler"}
          </button>
        </form>

        {/* --- RÉSULTATS --- */}
        {result && (
          <div className="result-section">
            <h2>Résultats de la simulation</h2>

            <div className="cards-container">
              <div className="result-card">
                <h3>
                  Montant total investi sur {result?.inputs?.duree ?? 0} années
                </h3>
                <p>{result?.resultats?.montant_total_investi?.toFixed(2)} €</p>
              </div>

              <div className="result-card">
                <h3>Valeur nette d’investissement</h3>
                <p>{result?.resultats?.portefeuille_final_estime?.toFixed(2)} €</p>
              </div>

              <div className="result-card">
                <h3>Volatilité</h3>
                <p>{((result?.resultats?.volatilite ?? 0) * 100).toFixed(2)}%</p>
              </div>

              <div className="result-card">
                <h3>Ratio Sharpe</h3>
                <p>{(result?.resultats?.ratio_sharpe ?? 0).toFixed(2)}</p>
              </div>

              <div className="result-card">
                <h3>CAGR</h3>
                <p>{((result?.resultats?.cagr ?? 0) * 100).toFixed(2)}%</p>
              </div>

              <div className="result-card">
                <h3>Rendement total</h3>
                <p>{(result?.resultats?.rendement_total ?? 0).toFixed(2)}%</p>
              </div>
            </div>

            {/* Bouton de comparaison (dans le bloc cartes) */}
            <div className="compare-button-container-inside">
              <button
                className="compare-button"
                onClick={() => navigate("/compare", { state: { portefeuille: result } })}
              >
                Comparer à l’indice ACWI IMI
              </button>

              <button
                className="predict-button"
                onClick={() => navigate("/predict", { state: { portefeuille: result } })}
              >
                Prédire les rendements futurs
              </button>
            </div>

          </div>
        )}
      </div>

      {/* --- SECTION GRAPHIQUES --- */}
      {result && (
      <div className="charts-section">
        <h2 className="charts-title">Visualisations des performances</h2>

        <div className="chart-row">
          <div className="chart-box">
            <h3>Courbe de performance cumulée</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={result.resultats.historique}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="periode" stroke="#aaa" />
                <YAxis stroke="#aaa" />
                <Tooltip />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  dataKey="valeur"
                  stroke="#00c8ff"
                  strokeWidth={3}
                  dot={false}
                  name="Valeur du portefeuille (€)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-interpretation">
            <h4>📈 Interprétation</h4>
            <p>
              Cette courbe montre l’évolution du portefeuille investi en{" "}
              <strong>{result.inputs.actif || "actif non spécifié"}</strong> dans le temps,
              en tenant compte des contributions et des frais de gestion.
              Une pente ascendante indique une bonne croissance du capital.
            </p>
          </div>
        </div>

        <div className="chart-row">
          <div className="chart-box">
            <h3>Histogramme des rendements périodiques</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={result.resultats.rendements}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="periode"
                  stroke="#aaa"
                  label={{
                    value:
                      result.inputs.frequence === "mensuelle"
                        ? "Mois"
                        : result.inputs.frequence === "trimestrielle"
                        ? "Trimestre"
                        : result.inputs.frequence === "semestrielle"
                        ? "Semestre"
                        : "Année",
                    position: "insideBottom",
                    offset: -5,
                    fill: "#aaa",
                  }}
                />
                <YAxis
                  stroke="#aaa"
                  domain={["dataMin - 5", "dataMax + 5"]}
                  allowDataOverflow={true}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => `${value.toFixed(2)} %`}
                  labelFormatter={(label) =>
                    result.inputs.frequence === "mensuelle"
                      ? `Mois ${label}`
                      : `Année ${label}`
                  }
                />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="rendement" fill="#3ee38f" name="Rendement (%)" />
                <ReferenceLine y={0} stroke="#ff6b6b" strokeWidth={1.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-interpretation">
            <h4>📊 Interprétation</h4>
            <p>
              Cet histogramme illustre la distribution des rendements pour votre portefeuille en{" "}
              <strong>{result.inputs.actif || "actif non spécifié"}</strong>.
              Les barres vertes au-dessus de la ligne rouge représentent des gains,
              celles en dessous des pertes.
            </p>
          </div>
        </div>
      </div>
    )}
            {/* --- BOUTON DE COMPARAISON DES STRATÉGIES --- */}
      {result && (
        <div className="strategies-button-container">
          <button
            className="strategies-button"
            onClick={() => navigate("/compare_strategies", { state: { portefeuille: result } })}
          >
             Comparer les stratégies d’investissement (DCA vs Lump Sum)
          </button>
        </div>
      )}

    </div>
  );
}
