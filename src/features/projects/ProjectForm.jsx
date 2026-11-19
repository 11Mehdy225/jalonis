import { useState } from 'react'

export default function ProjectForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', code: '', manager: '', methodology: 'Hybride', start_date: '', end_date: '', budget: '', description: '' })
  const change = e => setForm({ ...form, [e.target.name]: e.target.value })
  return <form onSubmit={e => { e.preventDefault(); onSubmit(form) }}>
    <div className="form-grid">
      <label className="span-2">Nom du projet<input required autoFocus name="name" value={form.name} onChange={change} placeholder="Ex. Transformation digitale" /></label>
      <label>Code<input name="code" value={form.code} onChange={change} placeholder="TR-2026" /></label>
      <label>Chef de projet<input name="manager" value={form.manager} onChange={change} /></label>
      <label>Mode de pilotage<select name="methodology" value={form.methodology} onChange={change}><option>Hybride</option><option>Scrum</option><option>Prédictif</option></select></label>
      <label>Date de début<input type="date" name="start_date" value={form.start_date} onChange={change} /></label>
      <label>Date de fin cible<input type="date" name="end_date" value={form.end_date} onChange={change} /></label>
      <label className="span-2">Budget prévisionnel<input type="number" name="budget" value={form.budget} onChange={change} placeholder="0" /></label>
      <label className="span-2">Description<textarea name="description" value={form.description} onChange={change} placeholder="Pourquoi ce projet existe-t-il ?" /></label>
    </div>
    <div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary">Créer le projet</button></div>
  </form>
}
