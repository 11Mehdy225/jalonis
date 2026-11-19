import { useState } from 'react'

const configs = {
  tasks: { title: 'Nouvelle activité', fields: [
    ['title','Intitulé','text'],['wbs_code','Code WBS','text'],['status','Statut','select',['À faire','En cours','Bloqué','Terminé']],['priority','Priorité','select',['Basse','Moyenne','Haute','Critique']],['assignee_id','Responsable','member-select'],['work_hours','Travail estimé (heures)','number'],['start_date','Début prévu','date'],['due_date','Fin prévue','date'],['predecessor_id','Prédécesseur','task-select'],['dependency_type','Type de liaison','select',['FS','SS','FF','SF']],['lag_days','Décalage (jours)','number'],['progress','Avancement (%)','number'],['is_milestone','Jalon','checkbox'],['actual_start','Début réel','date'],['actual_end','Fin réelle','date'],['notes','Notes','textarea'] ] },
  risks: { title: 'Nouveau risque', fields: [
    ['title','Risque','text'],['linked_task_id','Activité concernée','task-select'],['category','Catégorie','select',['Technique','Coût','Délai','Humain','Qualité','Externe']],['probability','Probabilité (1–5)','number'],['impact','Impact (1–5)','number'],['owner','Propriétaire','text'],['status','Statut','select',['Ouvert','Surveillé','Fermé']],['response','Réponse planifiée','textarea'] ] },
  team: { title: 'Nouveau membre', fields: [
    ['name','Nom complet','text'],['role','Rôle','text'],['email','E-mail','email'],['availability','Disponibilité (%)','number'],['skills','Compétences','text'] ] },
  meetings: { title: 'Nouvelle réunion', fields: [
    ['title','Objet','text'],['meeting_date','Date et heure','datetime-local'],['linked_task_id','Activité concernée','task-select'],['participants','Participants','text'],['agenda','Ordre du jour','textarea'],['decisions','Décisions','textarea'],['actions','Actions','textarea'] ] },
}

export default function EntityForm({ type, onSubmit, onCancel, tasks=[], members=[] }) {
  const cfg = configs[type]; const [form, setForm] = useState({})
  const submit = event => {
    event.preventDefault()
    const member = members.find(item => item.id === form.assignee_id)
    onSubmit(member ? { ...form, assignee: member.full_name } : form)
  }
  return <form onSubmit={submit}>
    <div className="form-grid">
      {cfg.fields.map(([name,label,kind,options],i) => <label key={name} className={(kind==='textarea'||i===0)?'span-2':''}>{label}
        {kind === 'select' ? <select name={name} value={form[name]||''} onChange={e=>setForm({...form,[name]:e.target.value})}><option value="">Sélectionner</option>{options.map(o=><option key={o}>{o}</option>)}</select>
        : kind === 'task-select' ? <select name={name} value={form[name]||''} onChange={e=>setForm({...form,[name]:e.target.value})}><option value="">Aucun prédécesseur</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.wbs_code||'—'} · {task.title}</option>)}</select>
        : kind === 'member-select' ? <select name={name} value={form[name]||''} onChange={e=>setForm({...form,[name]:e.target.value})}><option value="">Non assigné</option>{members.map(member=><option key={member.id} value={member.id}>{member.full_name} · {member.role}</option>)}</select>
        : kind === 'checkbox' ? <span className="checkbox-field"><input type="checkbox" name={name} checked={Boolean(form[name])} onChange={e=>setForm({...form,[name]:e.target.checked?1:0})}/>Cette activité marque un point de contrôle sans durée.</span>
        : kind === 'textarea' ? <textarea name={name} value={form[name]||''} onChange={e=>setForm({...form,[name]:e.target.value})}/>
        : <input required={i===0} autoFocus={i===0} type={kind} min={kind==='number'?0:undefined} max={name==='probability'||name==='impact'?5:name==='progress'||name==='availability'?100:undefined} name={name} value={form[name]||''} onChange={e=>setForm({...form,[name]:e.target.value})}/>}</label>)}
    </div>
    <div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary">Enregistrer</button></div>
  </form>
}

export { configs }
