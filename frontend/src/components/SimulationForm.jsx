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
  Cell,
} from "recharts";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/simulationForm.css";

const API_URL = "http://127.0.0.1:5000";

const UNIVERSE = {
  actions: {
    "AIR.PA": "Airbus SE (AIR.PA)",
    "OR.PA": "L’Oréal (OR.PA)",
    "MC.PA": "LVMH Moët Hennessy Louis Vuitton (MC.PA)",
    "BNP.PA": "BNP Paribas (BNP.PA)",
    "SAN.PA": "Sanofi (SAN.PA)",
  },
  obligations: {
    "IEAC.L": "iShares Euro Corporate Bond (IEAC.L)",
    "ECRP.PA": "Amundi Euro Corporate Bond (ECRP.PA)",
    "IBGX.MI": "iShares € Corp Bond (IBGX.MI)",
  },
  etf: {
    "ACWI": "iShares MSCI ACWI (ACWI)",
    "URTH": "iShares MSCI World (URTH)",
    "IWDA.AS": "iShares Core MSCI World (IWDA.AS)",
  },
};

function interpretPortfolioCurve(historique, cagr, volatilite) {
  if (!historique || historique.length < 2) return "Données insuffisantes.";

  const first = historique[0].valeur;
  const last = historique[historique.length - 1].valeur;

  const croissance = ((last - first) / first) * 100;

  let message = "L’évolution du portefeuille montre ";

  if (croissance > 50) message += "une forte croissance du capital, ";
  else if (croissance > 20) message += "une croissance solide, ";
  else if (croissance > 0) message += "une légère croissance du capital, ";
  else if (croissance > -10) message += "une stabilité relative, ";
  else message += "une baisse notable du capital, ";

  if (cagr > 0.10) message += `avec un CAGR très élevé (${(cagr * 100).toFixed(1)}%). `;
  else if (cagr > 0.05) message += `avec un CAGR modéré (${(cagr * 100).toFixed(1)}%). `;
  else if (cagr > 0) message += `avec un CAGR faible (${(cagr * 100).toFixed(1)}%). `;
  else message += `et un CAGR négatif (${(cagr * 100).toFixed(1)}%). `;

  if (volatilite < 0.10) message += "La volatilité est faible, indiquant un risque limité.";
  else if (volatilite < 0.20) message += "La volatilité est modérée, ce qui montre une prise de risque contrôlée.";
  else message += "La volatilité est élevée, ce qui indique un portefeuille sensible aux variations de marché.";

  return message;
}

function interpretHistogram(rendements) {
  if (!rendements || rendements.length < 2) return "Données insuffisantes.";

  const values = rendements.map((r) => r.rendement);
  const positives = values.filter((v) => v > 0).length;
  const negatives = values.length - positives;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  let msg = "";

  if (positives / values.length > 0.7)
    msg += "La majorité des périodes sont positives, ce qui traduit un comportement globalement haussier. ";
  else if (positives / values.length > 0.5)
    msg += "Plus de la moitié des rendements sont positifs, indiquant une tendance globalement favorable. ";
  else
    msg += "La majorité des rendements sont négatifs, ce qui traduit une période difficile pour ce portefeuille. ";

  if (avg > 2) msg += `La moyenne des rendements est élevée (${avg.toFixed(2)}%). `;
  else if (avg > 0) msg += `La moyenne est légèrement positive (${avg.toFixed(2)}%). `;
  else msg += `La moyenne des rendements est négative (${avg.toFixed(2)}%). `;

  if (min < -8) msg += `On observe une chute marquée de ${min.toFixed(2)}%, ce qui signale un risque important. `;
  else if (min < -4) msg += `Une baisse notable de ${min.toFixed(2)}% apparaît dans la période analysée. `;
  else msg += "Aucun événement extrême négatif significatif n’est détecté. ";

  if (max > 8) msg += `Un pic exceptionnel de ${max.toFixed(2)}% a également été enregistré.`;

  return msg.trim();
}


export default function SimulationForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    montant_initial: "",
    contribution: "",
    frequence: "mensuelle",
    actif: "",
    ticker: "",
    date_debut: "",
    date_fin: "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  /* --- Préremplissage après retour --- */
  useEffect(() => {
    if (location.state?.portefeuille) {
      const p = location.state.portefeuille.inputs || {};
      setResult(location.state.portefeuille);
      setFormData({
        montant_initial: p.montant_initial ?? "",
        contribution: p.contribution ?? "",
        frequence: p.frequence ?? "mensuelle",
        actif: p.actif ?? "",
        ticker: p.ticker ?? "",
        date_debut: p.date_debut ?? "",
        date_fin: p.date_fin ?? "",
      });
    }
  }, [location.state]);

  /* --- Auto-ajustement du ticker quand catégorie change --- */
  useEffect(() => {
    if (formData.actif) {
      const currentMap = UNIVERSE[formData.actif];
      if (currentMap && !Object.keys(currentMap).includes(formData.ticker)) {
        const defaultTicker = Object.keys(currentMap)[0];
        setFormData((s) => ({ ...s, ticker: defaultTicker }));
      }
    }
  }, [formData.actif]);

  /* --- Gestion des champs du formulaire --- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  /* --- Soumission du formulaire --- */
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

    const payload = {
      montant_initial: parseFloat(formData.montant_initial),
      contribution: parseFloat(formData.contribution),
      frequence: formData.frequence,
      duree,
      actif: formData.actif,
      ticker: formData.ticker,
      date_debut: dateDebut,
      date_fin: dateFin,
    };

    try {
      const res = await fetch(`${API_URL}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
  let best = [];
  let worst = [];

  if (result?.resultats?.rendements?.length > 0) {
    const sorted = [...result.resultats.rendements]
      .map((r) => ({ ...r }))
      .sort((a, b) => b.rendement - a.rendement);

    best = sorted.slice(0, 3);
    worst = sorted.slice(-3).reverse();
  }

  function formatDateFR(dateString) {
    const d = new Date(dateString + "-01");
    return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long" });
}

  return (
    <div className="simulate-page">
      <h1 className="page-title">Simulation de Portefeuille</h1>

      {/* --- SECTION PRINCIPALE --- */}
      <div className="main-section">
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
            Année de fin :
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

          {/* --- Catégorie --- */}
          <label>
            Catégorie d’actif :
            <select
              name="actif"
              value={formData.actif}
              onChange={handleChange}
              required
            >
              <option value="">— Sélectionnez une catégorie —</option>
              <option value="actions">Actions</option>
              <option value="obligations">Obligations</option>
              <option value="etf">ETF</option>
            </select>
          </label>

          {/* --- Titre affiché uniquement après choix catégorie --- */}
          {formData.actif && (
            <label>
              Sélection du titre ({formData.actif}) :
              <select
                name="ticker"
                value={formData.ticker}
                onChange={handleChange}
                required
              >
                <option value="">— Choisissez un titre —</option>
                {Object.entries(UNIVERSE[formData.actif]).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

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
                onClick={() => {
                                if (!result) {
                                  alert("Veuillez d'abord lancer une simulation.");
                                  return;
                                }
                                navigate("/compare", { state: { portefeuille: result } });
                              }}
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
            <p>{interpretPortfolioCurve(result.resultats.historique, result.resultats.cagr, result.resultats.volatilite)}</p>
          </div>
        </div>

        <div className="chart-row">
          <div className="chart-box">
            <h3>Histogramme des rendements périodiques</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={result.resultats.rendements}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="date"
                  stroke="#aaa"
                  angle={-40}
                  textAnchor="end"
                  height={60}
                  tick={{ fill: "#aaa", fontSize: 11 }}
                  label={{
                    value:
                      result.inputs.frequence === "mensuelle"
                        ? "Mois"
                        : result.inputs.frequence === "trimestrielle"
                        ? "Trimestre"
                        : "Période",
                    position: "insideBottom",
                    offset: -5,
                    fill: "#aaa",
                  }}
                />
                <YAxis
                  stroke="#aaa"
                  domain={["dataMin - 5", "dataMax + 5"]}
                  allowDataOverflow={true}
                  tickFormatter={(v) => `${v < 0 ? "−" + Math.abs(v).toFixed(2) : v.toFixed(2)}%`}
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
                <Bar dataKey="rendement" name="Rendement (%)">
                  {result.resultats.rendements.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.rendement >= 0 ? "#3ee38f" : "#ff6b6b"}
                    />
                  ))}
                </Bar>
                <ReferenceLine y={0} stroke="#ff6b6b" strokeWidth={1.5} />
              </BarChart>
            </ResponsiveContainer>
              <div className="best-worst-section">

                <div className="best-section">
                  <h4>Meilleures périodes</h4>
                  <div className="bw-list">
                    {best.map((b, i) => (
                      <div key={i} className="bw-item">
                        <span>{formatDateFR(b.date)}</span>
                        <strong>{b.rendement.toFixed(2)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="worst-section">
                  <h4>Pires périodes</h4>
                  <div className="bw-list">
                    {worst.map((w, i) => (
                      <div key={i} className="bw-item">
                        <span>{formatDateFR(w.date)}</span>
                        <strong>{w.rendement.toFixed(2)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
                      <div className="chart-interpretation">
                        <h4>📊 Interprétation</h4>
                        <p>{interpretHistogram(result.resultats.rendements)}</p>
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
