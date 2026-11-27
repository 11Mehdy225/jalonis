import { useState } from 'react'
import { AlertOctagon, CheckCircle2, ClipboardCheck, FileDiff, Gavel, Plus, Trash2 } from 'lucide-react'
import { stateSelectClass } from '../../shared/stateTone'
import '../../styles/governance.css'

const tabs=[['overview','Synthèse'],['change_requests','Changements'],['issues','Problèmes'],['decisions','Décisions']]
const today=()=>new Date().toISOString().slice(0,10)
const defaults={
  change_requests:{title:'',description:'',reason:'',impact_scope:'',impact_schedule_days:'',impact_cost:'',priority:'Moyenne',requested_by:'',owner:'',status:'Soumise',decision:'',decision_date:'',linked_task_id:'',linked_risk_id:''},
  issues:{title:'',description:'',severity:'Moyenne',owner:'',due_date:'',status:'Ouvert',resolution:'',linked_task_id:'',linked_risk_id:''},
  decisions:{title:'',decision_date:today(),context:'',decision:'',rationale:'',owner:'',status:'Décidée',linked_meeting_id:'',linked_task_id:'',linked_change_id:''},
}

export default function GovernanceView({changes,issues,decisions,tasks,risks,meetings,project,onCreate,onUpdate,onDelete}){
  const [tab,setTab]=useState('overview'),[creating,setCreating]=useState(null),[form,setForm]=useState({})
  const money=value=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:project.currency||'XOF',maximumFractionDigits:0}).format(Number(value)||0)
  const openChanges=changes.filter(row=>!['Approuvée','Rejetée','Annulée'].includes(row.status))
  const openIssues=issues.filter(row=>!['Résolu','Clos'].includes(row.status))
  const pendingDecisions=decisions.filter(row=>row.status==='À appliquer')
  const impact=changes.filter(row=>row.status==='Approuvée').reduce((sum,row)=>sum+Number(row.impact_cost||0),0)
  const startCreate=type=>{setCreating(type);setForm({...defaults[type]})}
  const submit=async event=>{event.preventDefault();await onCreate(creating,form);setCreating(null);setForm({})}
  const field=(name,label,type='text',options=null,className='')=><label className={className}>{label}{options?<select value={form[name]||''} onChange={event=>setForm({...form,[name]:event.target.value})}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select>:type==='textarea'?<textarea required={name==='title'} value={form[name]||''} onChange={event=>setForm({...form,[name]:event.target.value})}/>:<input required={name==='title'} type={type} min={type==='number'?0:undefined} value={form[name]||''} onChange={event=>setForm({...form,[name]:event.target.value})}/>}</label>
  return <div className="governance-view">
    <nav className="governance-tabs">{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}<span>{id==='change_requests'?changes.length:id==='issues'?issues.length:id==='decisions'?decisions.length:''}</span></button>)}</nav>
    {tab==='overview'&&<>
      <div className="governance-kpis">
        <GovKpi icon={FileDiff} label="Changements à instruire" value={openChanges.length} tone="purple"/>
        <GovKpi icon={AlertOctagon} label="Problèmes ouverts" value={openIssues.length} tone="orange"/>
        <GovKpi icon={Gavel} label="Décisions à appliquer" value={pendingDecisions.length} tone="blue"/>
        <GovKpi icon={ClipboardCheck} label="Impact approuvé" value={money(impact)} tone="green"/>
      </div>
      <div className="governance-overview">
        <section className="card"><GovHead title="Demandes récentes" action="Nouvelle demande" onClick={()=>startCreate('change_requests')}/><div className="governance-feed">{changes.slice(0,5).map(row=><Feed key={row.id} icon={FileDiff} title={row.title} meta={`${row.status} · ${row.owner||'Sans responsable'}`} status={row.priority}/>)}{!changes.length&&<Empty text="Aucune demande de changement."/>}</div></section>
        <section className="card"><GovHead title="Points à résoudre" action="Nouveau problème" onClick={()=>startCreate('issues')}/><div className="governance-feed">{openIssues.slice(0,5).map(row=><Feed key={row.id} icon={AlertOctagon} title={row.title} meta={`${row.status} · échéance ${formatDate(row.due_date)}`} status={row.severity}/>)}{!openIssues.length&&<Empty text="Aucun problème ouvert."/>}</div></section>
      </div>
      <section className="card decision-strip"><GovHead title="Dernières décisions" action="Consigner une décision" onClick={()=>startCreate('decisions')}/><div>{decisions.slice(0,4).map(row=><article key={row.id}><span><Gavel size={15}/></span><div><b>{row.title}</b><small>{formatDate(row.decision_date)} · {row.owner||'Responsable non précisé'}</small></div><em>{row.status}</em></article>)}{!decisions.length&&<Empty text="Le registre des décisions est vide."/>}</div></section>
    </>}
    {tab==='change_requests'&&<Register title="Registre des changements" subtitle="Analysez les impacts avant approbation." button="Nouvelle demande" onCreate={()=>startCreate('change_requests')} rows={changes} onDelete={id=>onDelete('change_requests',id)} columns={[
      ['title','Demande'],['priority','Priorité'],['impact_scope','Périmètre'],['impact_schedule_days','Délai',v=>`${Number(v)||0} j`],['impact_cost','Coût',money],['owner','Responsable'],['status','Statut',(_,row)=><StatusSelect value={row.status} options={['Soumise','En analyse','Approuvée','Rejetée','Annulée']} onChange={status=>onUpdate('change_requests',row.id,{status,decision_date:['Approuvée','Rejetée'].includes(status)?today():row.decision_date})}/>]
    ]}/>}
    {tab==='issues'&&<Register title="Registre des problèmes" subtitle="Suivez les obstacles jusqu’à leur résolution." button="Nouveau problème" onCreate={()=>startCreate('issues')} rows={issues} onDelete={id=>onDelete('issues',id)} columns={[
      ['title','Problème'],['severity','Sévérité'],['owner','Responsable'],['due_date','Échéance',formatDate],['linked_task_id','Tâche',v=>tasks.find(row=>row.id===v)?.title||'—'],['status','Statut',(_,row)=><StatusSelect value={row.status} options={['Ouvert','En cours','Escaladé','Résolu','Clos']} onChange={status=>onUpdate('issues',row.id,{status})}/>]
    ]}/>}
    {tab==='decisions'&&<Register title="Registre des décisions" subtitle="Conservez le contexte, l’arbitrage et sa mise en œuvre." button="Nouvelle décision" onCreate={()=>startCreate('decisions')} rows={decisions} onDelete={id=>onDelete('decisions',id)} columns={[
      ['title','Décision'],['decision_date','Date',formatDate],['decision','Arbitrage'],['owner','Responsable'],['linked_meeting_id','Réunion',v=>meetings.find(row=>row.id===v)?.title||'—'],['status','Statut',(_,row)=><StatusSelect value={row.status} options={['Proposée','Décidée','À appliquer','Appliquée','Annulée']} onChange={status=>onUpdate('decisions',row.id,{status})}/>]
    ]}/>}

    {creating&&<div className="governance-drawer-backdrop" onMouseDown={()=>setCreating(null)}><aside className="governance-drawer" onMouseDown={event=>event.stopPropagation()}><div className="drawer-head"><div><span>GOUVERNANCE</span><h2>{creating==='change_requests'?'Nouvelle demande de changement':creating==='issues'?'Nouveau problème':'Nouvelle décision'}</h2></div><button onClick={()=>setCreating(null)}>×</button></div><form onSubmit={submit} className="governance-form">
      {field('title','Intitulé')}
      {creating==='change_requests'&&<>{field('description','Description','textarea',null,'span-2')}{field('reason','Justification','textarea',null,'span-2')}{field('impact_scope','Impact sur le périmètre')}{field('impact_schedule_days','Impact délai (jours)','number')}{field('impact_cost',`Impact coût (${project.currency||'XOF'})`,'number')}{field('priority','Priorité','select',[['Basse','Basse'],['Moyenne','Moyenne'],['Haute','Haute'],['Critique','Critique']])}{field('requested_by','Demandeur')}{field('owner','Responsable')}{LinkedSelect({name:'linked_task_id',label:'Tâche liée',rows:tasks,form,setForm})}{LinkedSelect({name:'linked_risk_id',label:'Risque lié',rows:risks,form,setForm})}</>}
      {creating==='issues'&&<>{field('description','Description','textarea',null,'span-2')}{field('severity','Sévérité','select',[['Basse','Basse'],['Moyenne','Moyenne'],['Haute','Haute'],['Critique','Critique']])}{field('owner','Responsable')}{field('due_date','Échéance','date')}{LinkedSelect({name:'linked_task_id',label:'Tâche liée',rows:tasks,form,setForm})}{LinkedSelect({name:'linked_risk_id',label:'Risque lié',rows:risks,form,setForm})}{field('resolution','Plan de résolution','textarea',null,'span-2')}</>}
      {creating==='decisions'&&<>{field('decision_date','Date de décision','date')}{field('owner','Responsable')}{field('context','Contexte','textarea',null,'span-2')}{field('decision','Décision prise','textarea',null,'span-2')}{field('rationale','Justification','textarea',null,'span-2')}{LinkedSelect({name:'linked_meeting_id',label:'Réunion liée',rows:meetings,form,setForm})}{LinkedSelect({name:'linked_task_id',label:'Tâche liée',rows:tasks,form,setForm})}{LinkedSelect({name:'linked_change_id',label:'Changement lié',rows:changes,form,setForm})}</>}
      <div className="drawer-actions span-2"><button type="button" className="btn ghost" onClick={()=>setCreating(null)}>Annuler</button><button className="btn primary"><Plus size={16}/>Enregistrer</button></div>
    </form></aside></div>}
  </div>
}

function LinkedSelect({name,label,rows,form,setForm}){return <label>{label}<select value={form[name]||''} onChange={event=>setForm({...form,[name]:event.target.value})}><option value="">Aucun</option>{rows.map(row=><option key={row.id} value={row.id}>{row.wbs_code?`${row.wbs_code} · `:''}{row.title}</option>)}</select></label>}
function GovKpi({icon:Icon,label,value,tone}){return <div className="card gov-kpi"><span className={tone}><Icon size={20}/></span><div><small>{label}</small><b>{value}</b></div></div>}
function GovHead({title,action,onClick}){return <header className="gov-head"><h3>{title}</h3><button onClick={onClick}><Plus size={14}/>{action}</button></header>}
function Feed({icon:Icon,title,meta,status}){return <article><span><Icon size={15}/></span><div><b>{title}</b><small>{meta}</small></div><em>{status}</em></article>}
function Empty({text}){return <div className="gov-empty"><CheckCircle2 size={20}/><span>{text}</span></div>}
function Register({title,subtitle,button,onCreate,rows,columns,onDelete}){return <section className="card governance-register"><div className="register-head"><div><h3>{title}</h3><p>{subtitle}</p></div><button className="btn primary" onClick={onCreate}><Plus size={16}/>{button}</button></div><div className="register-table"><table><thead><tr>{columns.map(([,label])=><th key={label}>{label}</th>)}<th></th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>{columns.map(([key,label,render])=><td key={label}>{render?render(row[key],row):row[key]||'—'}</td>)}<td><button className="row-delete" title="Supprimer" onClick={()=>onDelete(row.id)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="Aucun élément dans ce registre."/>}</section>}
function StatusSelect({value,options,onChange}){return <select className={stateSelectClass(value,'gov-status-select')} value={value||options[0]} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option}>{option}</option>)}</select>}
function formatDate(value){return value?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'—'}
