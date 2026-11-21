import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Clock3, History, ImagePlus, Link2, ListChecks, MessageSquareText, Plus, Save, Trash2 } from 'lucide-react'
import EntityDiscussion from '../collaboration/EntityDiscussion'
import '../../styles/work-item-details.css'

const TASK_STATUSES=['À faire','En cours','Bloqué','Terminé']
const STORY_STATUSES=['Backlog','À faire','En cours','En revue','Terminé']
const PRIORITIES=['Basse','Moyenne','Haute','Critique']
const stamp=value=>value?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—'

export default function WorkItemDetails({item,type,tasks=[],items=[],sprints=[],members=[],attachments=[],comments=[],activities=[],checklist=[],currentUser,onUpdate,onAttach,onComment,onAddChecklist,onUpdateChecklist,onDeleteChecklist}){
  const isTask=type==='tasks'
  const [form,setForm]=useState(item)
  const [newCheck,setNewCheck]=useState('')
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>setForm(item),[item])
  const files=attachments.filter(file=>file.entity_type===type&&file.entity_id===item.id)
  const checks=checklist.filter(row=>row.entity_type===type&&row.entity_id===item.id)
  const history=activities.filter(row=>row.entity_type===type&&row.entity_id===item.id)
  const completion=checks.length?Math.round(checks.filter(row=>Boolean(Number(row.is_done))).length/checks.length*100):0
  const people=useMemo(()=>members.map(member=>({id:member.id,name:member.full_name||member.name,role:member.role})),[members])
  const change=event=>setForm({...form,[event.target.name]:event.target.type==='number'?Number(event.target.value):event.target.value})
  const save=async event=>{event.preventDefault();if(!isTask&&form.status==='Terminé'&&form.item_type!=='Epic'&&(!form.acceptance_criteria||!form.definition_done)){setError('Renseignez les critères d’acceptation et la Definition of Done avant de terminer cet élément.');return}setError('');const {id,project_id,created_at,updated_at,...editable}=form;const person=people.find(row=>row.id===form.assignee_id);await onUpdate(item.id,{...editable,assignee:person?.name||form.assignee||null});setSaved(true);setTimeout(()=>setSaved(false),1600)}
  const addCheck=async event=>{event.preventDefault();const title=newCheck.trim();if(!title)return;await onAddChecklist({entity_type:type,entity_id:item.id,title,is_done:false,rank:checks.length+1});setNewCheck('')}
  return <div className="work-item-detail">
    <div className="work-item-summary"><div><span className={`story-type ${String(form.item_type||'tâche').toLowerCase().replace(' ','-')}`}>{isTask?'Activité':form.item_type||'Élément'}</span><h3>{form.title}</h3><p>{isTask?`WBS ${form.wbs_code||'—'}`:`${form.story_points||0} points · ${form.estimate_hours||0} h`}</p></div><div className="work-item-completion"><b>{completion}%</b><span>check-list</span></div></div>
    {error&&<div className="work-item-error"><AlertTriangle size={16}/>{error}</div>}
    <form onSubmit={save} className="work-item-form">
      <section><div className="detail-section-head"><div><Link2 size={16}/><span><b>Détails et liaisons</b><small>Informations, responsable, calendrier et dépendances.</small></span></div><button className="btn primary"><Save size={15}/>{saved?'Enregistré':'Enregistrer'}</button></div>
        <div className="form-grid"><label className="span-2">Titre<input required name="title" value={form.title||''} onChange={change}/></label>
          {!isTask&&<label>Type<select name="item_type" value={form.item_type||'User Story'} onChange={change}>{['Epic','User Story','Bug','Tâche'].map(value=><option key={value}>{value}</option>)}</select></label>}
          <label>Statut<select name="status" value={form.status||''} onChange={change}>{(isTask?TASK_STATUSES:STORY_STATUSES).map(value=><option key={value}>{value}</option>)}</select></label>
          <label>Priorité<select name="priority" value={form.priority||'Moyenne'} onChange={change}>{PRIORITIES.map(value=><option key={value}>{value}</option>)}</select></label>
          <label>Responsable<select name="assignee_id" value={form.assignee_id||''} onChange={change}><option value="">Non assigné</option>{people.map(person=><option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select></label>
          <label>Début prévu<input type="date" name="start_date" value={form.start_date||''} onChange={change}/></label><label>Échéance<input type="date" name="due_date" value={form.due_date||''} onChange={change}/></label>
          {isTask?<><label>Avancement (%)<input type="number" min="0" max="100" name="progress" value={form.progress||0} onChange={change}/></label><label>Travail estimé (h)<input type="number" min="0" name="work_hours" value={form.work_hours||0} onChange={change}/></label><label>Prédécesseur<select name="predecessor_id" value={form.predecessor_id||''} onChange={change}><option value="">Aucun</option>{tasks.filter(row=>row.id!==item.id).map(row=><option key={row.id} value={row.id}>{row.wbs_code||'—'} · {row.title}</option>)}</select></label><label>Type de liaison<select name="dependency_type" value={form.dependency_type||'FS'} onChange={change}>{['FS','SS','FF','SF'].map(value=><option key={value}>{value}</option>)}</select></label><label className="span-2">Notes<textarea name="notes" value={form.notes||''} onChange={change}/></label></>
          :<><label>Story Points<input type="number" min="0" name="story_points" value={form.story_points||0} onChange={change}/></label><label>Estimation (h)<input type="number" min="0" name="estimate_hours" value={form.estimate_hours||0} onChange={change}/></label><label>Sprint<select name="sprint_id" value={form.sprint_id||''} onChange={change}><option value="">Product Backlog</option>{sprints.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Epic parent<select name="parent_epic_id" value={form.parent_epic_id||''} onChange={change}><option value="">Aucun Epic</option>{items.filter(row=>row.item_type==='Epic'&&row.id!==item.id).map(row=><option key={row.id} value={row.id}>{row.title}</option>)}</select></label><label>Activité PMP liée<select name="linked_task_id" value={form.linked_task_id||''} onChange={change}><option value="">Aucune</option>{tasks.map(row=><option key={row.id} value={row.id}>{row.wbs_code||'—'} · {row.title}</option>)}</select></label><label className="span-2">Description<textarea name="description" value={form.description||''} onChange={change}/></label><label className="span-2">Critères d’acceptation<textarea name="acceptance_criteria" value={form.acceptance_criteria||''} onChange={change}/></label><label className="span-2">Definition of Done<textarea name="definition_done" value={form.definition_done||''} onChange={change}/></label></>}
        </div>
      </section>
    </form>
    <div className="work-item-columns">
      <section><div className="detail-section-head"><div><ListChecks size={16}/><span><b>Check-list</b><small>{checks.filter(row=>Boolean(Number(row.is_done))).length}/{checks.length} éléments terminés</small></span></div></div><div className="checklist-progress"><i><span style={{width:`${completion}%`}}/></i><b>{completion}%</b></div><div className="checklist-list">{checks.map(row=><div key={row.id}><button onClick={()=>onUpdateChecklist(row.id,{is_done:!Boolean(Number(row.is_done))})}>{Boolean(Number(row.is_done))?<CheckCircle2 size={18}/>:<Circle size={18}/>}</button><span className={Boolean(Number(row.is_done))?'done':''}>{row.title}</span><button className="row-delete" onClick={()=>onDeleteChecklist(row.id)}><Trash2 size={14}/></button></div>)}</div><form className="checklist-add" onSubmit={addCheck}><input value={newCheck} onChange={event=>setNewCheck(event.target.value)} placeholder="Ajouter un élément à vérifier…"/><button disabled={!newCheck.trim()}><Plus size={15}/>Ajouter</button></form></section>
      <section><div className="detail-section-head"><div><ImagePlus size={16}/><span><b>Images et rendus</b><small>{files.length} fichier{files.length>1?'s':''}</small></span></div><button className="btn ghost" type="button" onClick={onAttach}><ImagePlus size={14}/>Ajouter</button></div><div className="detail-visuals">{files.map(file=><figure key={file.id}><img src={file.url} alt={file.file_name}/><figcaption>{file.file_name}</figcaption></figure>)}{!files.length&&<button onClick={onAttach}><ImagePlus size={22}/><span>Ajouter un rendu visuel</span></button>}</div></section>
    </div>
    <section><div className="detail-section-head"><div><MessageSquareText size={16}/><span><b>Discussion liée</b><small>Les décisions restent attachées à cet élément.</small></span></div></div><EntityDiscussion entity={item} entityType={type} comments={comments} currentUser={currentUser} onComment={onComment}/></section>
    <section><div className="detail-section-head"><div><History size={16}/><span><b>Historique</b><small>Créations, affectations et changements de statut.</small></span></div></div><div className="detail-history">{history.length?history.map(row=><article key={row.id}><span><Clock3 size={13}/></span><div><b>{row.title}</b><p>{row.description}</p><small>{row.actor_name} · {stamp(row.created_at)}</small></div></article>):<p className="detail-empty">Aucune modification enregistrée pour le moment.</p>}</div></section>
  </div>
}
