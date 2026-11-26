import { useState } from 'react'
import { PROJECT_TEMPLATES } from '../../data/projectTemplates'

export default function ProjectForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', code: '', manager: '', template_id: 'blank', methodology: 'Hybride', access_mode: 'restricted', theme_color: '#4f46e5', start_date: '', end_date: '', budget: '', currency: 'XOF', description: '' })
  const change = e => {const next={ ...form, [e.target.name]: e.target.value };if(e.target.name==='template_id'){const template=PROJECT_TEMPLATES.find(item=>item.id===e.target.value);if(template)next.methodology=template.methodology}setForm(next)}
  return <form onSubmit={e => { e.preventDefault(); onSubmit(form) }}>
    <div className="form-grid">
      <label className="span-2">Nom du projet<input required autoFocus name="name" value={form.name} onChange={change} placeholder="Ex. Transformation digitale" /></label>
      <label className="span-2">Modèle de démarrage<select name="template_id" value={form.template_id} onChange={change}>{PROJECT_TEMPLATES.map(template=><option key={template.id} value={template.id}>{template.name} — {template.description}</option>)}</select></label>
      <label>Code<input name="code" value={form.code} onChange={change} placeholder="TR-2026" /></label>
      <label>Chef de projet<input name="manager" value={form.manager} onChange={change} /></label>
      <label>Mode de pilotage<select name="methodology" value={form.methodology} onChange={change}><option>Hybride</option><option>Scrum</option><option>Prédictif</option></select></label>
      <label>Confidentialité<select name="access_mode" value={form.access_mode} onChange={change}><option value="restricted">Accès restreint — sur invitation</option><option value="workspace">Tous les membres de l’espace</option></select></label>
      <label>Couleur du projet<span className="color-field"><input type="color" name="theme_color" value={form.theme_color} onChange={change}/><b>{form.theme_color}</b></span></label>
      <label>Date de début<input type="date" name="start_date" value={form.start_date} onChange={change} /></label>
      <label>Date de fin cible<input type="date" name="end_date" value={form.end_date} onChange={change} /></label>
      <label>Budget prévisionnel<input type="number" min="0" name="budget" value={form.budget} onChange={change} placeholder="0" /></label>
      <label>Devise<select name="currency" value={form.currency} onChange={change}><option value="XOF">FCFA (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar (USD)</option><option value="GBP">Livre sterling (GBP)</option></select></label>
      <label className="span-2">Description<textarea name="description" value={form.description} onChange={change} placeholder="Pourquoi ce projet existe-t-il ?" /></label>
    </div>
    <div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary">Créer le projet</button></div>
  </form>
}
