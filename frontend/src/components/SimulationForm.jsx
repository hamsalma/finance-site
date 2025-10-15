import React, { useState } from "react";

const API_URL = "http://127.0.0.1:5000";

export default function SimulationForm() {
  const [formData, setFormData] = useState({
    montant_initial: "",
    contribution: "",
    frequence: "mensuelle",
    actif: "actions",
    anneeDebut: "",
    anneeFin: "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const duree = parseInt(formData.anneeFin) - parseInt(formData.anneeDebut);
    if (duree <= 0) {
      alert("L'année de fin doit être supérieure à l'année de début !");
      setLoading(false);
      return;
    }

    const dataToSend = {
      montant_initial: formData.montant_initial,
      contribution: formData.contribution,
      frequence: formData.frequence,
      duree: duree,
      actif: formData.actif,
    };

    try {
      const response = await fetch(`${API_URL}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la simulation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "2em auto",
        padding: "1.5em",
        backgroundColor: "var(--background-color, #1a1a1a)",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <form onSubmit={handleSubmit} className="simulation-form">
        <label>
          Montant initial :
          <input
            type="number"
            name="montant_initial"
            placeholder="ex: 1000"
            value={formData.montant_initial}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Contribution périodique :
          <input
            type="number"
            name="contribution"
            placeholder="ex: 100"
            value={formData.contribution}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Fréquence :
          <select name="frequence" value={formData.frequence} onChange={handleChange}>
            <option value="mensuelle">Mensuelle</option>
            <option value="trimestrielle">Trimestrielle</option>
            <option value="semistrielle">Semistrielle</option>
            <option value="annuelle">Annuelle</option>
          </select>
        </label>

        <label>
          Année de début :
          <input
            type="number"
            name="anneeDebut"
            placeholder="ex: 2025"
            value={formData.anneeDebut}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Année de fin :
          <input
            type="number"
            name="anneeFin"
            placeholder="ex: 2030"
            value={formData.anneeFin}
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Type de bien :
          <select name="actif" value={formData.actif} onChange={handleChange}>
            <option value="actions">Actions</option>
            <option value="obligations">Obligations</option>
            <option value="etf">ETF</option>
          </select>
        </label>

        <button type="submit">{loading ? "Calcul en cours..." : "Simuler"}</button>
      </form>

      {result && (() => {
  const freqMultiplicator =
    result.frequence === "mensuelle" ? 12 :
    result.frequence === "trimestrielle" ? 4 :
    result.frequence === "semestrielle" ? 2 :
    1; 

  const totalInvesti =
    parseFloat(result.montant_initial) +
    parseFloat(result.contribution) * freqMultiplicator * parseFloat(result.duree);

  return (
    <div className="result">
      <h3>Résultat de la simulation</h3>
      <p><strong>Montant initial :</strong> {result.montant_initial} €</p>
      <p><strong>Montant total investi :</strong> {totalInvesti.toFixed(2)} €</p>
      <p><strong>Durée :</strong> {result.duree} années</p>
      <p><strong>Frais de gestion :</strong> {(result.frais_gestion).toFixed(2)}%</p>
      <p><strong>Type de bien :</strong> {result.actif}</p>
      <p><strong>Portefeuille final estimé :</strong> {result.portefeuille_final_estime} €</p>
    </div>
  );
})()}

    </div>
  );
}
