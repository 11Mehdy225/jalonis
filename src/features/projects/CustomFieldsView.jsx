import { useState } from 'react'
import { ListFilter, Plus, Trash2 } from 'lucide-react'
import '../../styles/custom-fields.css'

const TARGETS={tasks:'Activités prédictives',backlog_items:'Epics, stories, bugs et tâches Scrum'}
const TYPES={text:'Texte',number:'Nombre',date:'Date',select:'Liste de choix',checkbox:'Case à cocher'}

const readOptions=value=>{if(Array.isArray(value))return value;if(!value)return[];try{return JSON.parse(value)}catch{return String(value).split(',').map(item=>item.trim()).filter(Boolean)}}

export default function CustomFieldsView({fields=[],canEdit,onCreate,onDelete}){
  const [form,setForm]=useState({entity_type:'tasks',field_type:'text',label:'',options:'',is_required:false})
  const [open,setOpen]=useState(false)
  const submit=async event=>{event.preventDefault();const options=form.field_type==='select'?form.options.split(',').map(item=>item.trim()).filter(Boolean):[];await onCreate({...form,options,is_required:Boolean(form.is_required),rank:fields.filter(row=>row.entity_type===form.entity_type).length+1});setForm({entity_type:'tasks',field_type:'text',label:'',options:'',is_required:false});setOpen(false)}
  return <div className="custom-fields-page">
    <section className="card custom-fields-intro"><div className="custom-field-icon"><ListFilter size={21}/></div><div><h3>Champs propres à votre projet</h3><p>Ajoutez les informations métier qui doivent apparaître dans les fiches de travail, sans modifier la structure générale de Jalonis.</p></div>{canEdit&&<button className="btn primary" onClick={()=>setOpen(value=>!value)}><Plus size={15}/>{open?'Fermer':'Nouveau champ'}</button>}</section>
    {open&&<form className="card custom-field-form" onSubmit={submit}><div className="form-grid"><label>Nom du champ<input required autoFocus value={form.label} onChange={event=>setForm({...form,label:event.target.value})} placeholder="Ex. Référence client"/></label><label>Afficher dans<select value={form.entity_type} onChange={event=>setForm({...form,entity_type:event.target.value})}>{Object.entries(TARGETS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Type de valeur<select value={form.field_type} onChange={event=>setForm({...form,field_type:event.target.value})}>{Object.entries(TYPES).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>{form.field_type==='select'&&<label>Choix séparés par des virgules<input required value={form.options} onChange={event=>setForm({...form,options:event.target.value})} placeholder="Interne, Client, Partenaire"/></label>}<label className="custom-required"><input type="checkbox" checked={form.is_required} onChange={event=>setForm({...form,is_required:event.target.checked})}/><span><b>Champ obligatoire</b><small>La fiche devra contenir une valeur avant l’enregistrement.</small></span></label></div><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>setOpen(false)}>Annuler</button><button className="btn primary">Créer le champ</button></div></form>}
    <div className="custom-field-groups">{Object.entries(TARGETS).map(([target,label])=><section className="card" key={target}><header><div><span>{target==='tasks'?'PRÉDICTIF':'SCRUM'}</span><h3>{label}</h3></div><em>{fields.filter(row=>row.entity_type===target).length}</em></header><div>{fields.filter(row=>row.entity_type===target).sort((a,b)=>Number(a.rank)-Number(b.rank)).map(field=><article key={field.id}><span className="custom-field-type">{TYPES[field.field_type]||field.field_type}</span><div><b>{field.label}</b><small>{field.is_required?'Obligatoire':'Facultatif'}{field.field_type==='select'&&readOptions(field.options).length?` · ${readOptions(field.options).join(', ')}`:''}</small></div>{canEdit&&<button className="row-delete" title="Supprimer ce champ" onClick={()=>onDelete(field.id)}><Trash2 size={14}/></button>}</article>)}{!fields.some(row=>row.entity_type===target)&&<div className="custom-fields-empty">Aucun champ personnalisé pour cette catégorie.</div>}</div></section>)}</div>
  </div>
}

export { readOptions }
