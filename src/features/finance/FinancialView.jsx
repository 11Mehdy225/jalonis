import { useMemo, useState } from 'react'
import { CircleDollarSign, Landmark, Plus, ReceiptText, TrendingDown, TrendingUp, Trash2, WalletCards } from 'lucide-react'
import '../../styles/finance.css'

const categories = ['Ressources humaines','Prestations','Matériel','Logiciels','Déplacements','Formation','Communication','Imprévus','Autre']
const statuses = ['Prévu','Engagé','Payé','Annulé']
const emptyForm = { description:'', category:'Prestations', cost_type:'Ponctuel', planned_amount:'', committed_amount:'', actual_amount:'', entry_date:'', status:'Prévu', supplier_id:'', task_id:'', notes:'' }
const amount = value => Number(value) || 0

export default function FinancialView({project,costs,team,tasks,timeEntries,suppliers,onCreate,onDelete,onUpdateProject}){
  const [form,setForm]=useState(emptyForm)
  const [editingBudget,setEditingBudget]=useState(false)
  const [budget,setBudget]=useState(project.budget||'')
  const [currency,setCurrency]=useState(project.currency||'XOF')
  const format=value=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:project.currency||'XOF',maximumFractionDigits:0}).format(amount(value))
  const metrics=useMemo(()=>{
    const memberMap=new Map(team.map(member=>[member.id,member]))
    const laborPlanned=tasks.reduce((sum,task)=>sum+amount(task.work_hours)*amount(memberMap.get(task.assignee_id)?.hourly_cost),0)
    const laborActual=timeEntries.filter(entry=>entry.status!=='Rejeté').reduce((sum,entry)=>sum+amount(entry.hours)*amount(memberMap.get(entry.member_id)?.hourly_cost),0)
    const externalPlanned=costs.reduce((sum,row)=>sum+amount(row.planned_amount),0)
    const externalCommitted=costs.reduce((sum,row)=>sum+amount(row.committed_amount),0)
    const externalActual=costs.reduce((sum,row)=>sum+amount(row.actual_amount),0)
    const planned=laborPlanned+externalPlanned
    const committed=laborActual+externalCommitted
    const actual=laborActual+externalActual
    const reference=amount(project.budget)
    const remaining=Math.max(0,planned-actual)
    const forecast=Math.max(actual+remaining,committed)
    const variance=reference-forecast
    const earned=reference*(tasks.length?tasks.reduce((sum,row)=>sum+amount(row.progress),0)/(tasks.length*100):0)
    return {laborPlanned,laborActual,planned,committed,actual,reference,forecast,variance,earned,cpi:actual?earned/actual:null,consumption:reference?Math.min(999,actual/reference*100):0}
  },[project.budget,costs,team,tasks,timeEntries])
  const months=useMemo(()=>{
    const grouped={}
    costs.forEach(row=>{if(!row.entry_date)return;const key=row.entry_date.slice(0,7);grouped[key]=(grouped[key]||0)+amount(row.actual_amount)})
    return Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).slice(-8)
  },[costs])
  const maxMonth=Math.max(1,...months.map(([,value])=>value))
  const submit=async event=>{event.preventDefault();await onCreate(form);setForm(emptyForm)}
  const saveBudget=async event=>{event.preventDefault();await onUpdateProject({budget:amount(budget),currency});setEditingBudget(false)}
  return <div className="finance-view">
    <div className="finance-kpis">
      <FinanceKpi icon={Landmark} label="Budget de référence" value={format(metrics.reference)} note={`${project.currency||'XOF'} · base approuvée`} tone="indigo"/>
      <FinanceKpi icon={WalletCards} label="Coût réel" value={format(metrics.actual)} note={`${metrics.consumption.toFixed(1)} % du budget consommé`} tone="teal"/>
      <FinanceKpi icon={ReceiptText} label="Engagé" value={format(metrics.committed)} note={`Dont ${format(metrics.laborActual)} de temps interne`} tone="blue"/>
      <FinanceKpi icon={metrics.variance>=0?TrendingUp:TrendingDown} label="Écart à terminaison" value={format(metrics.variance)} note={`Prévision finale : ${format(metrics.forecast)}`} tone={metrics.variance>=0?'green':'orange'}/>
    </div>

    <div className="finance-grid">
      <section className="card finance-summary">
        <div className="finance-title"><div><h3>Trajectoire budgétaire</h3><p>Prévu, engagé, réalisé et estimation finale du projet.</p></div><button className="btn ghost" onClick={()=>setEditingBudget(value=>!value)}>Ajuster le budget</button></div>
        {editingBudget&&<form className="budget-editor" onSubmit={saveBudget}><label>Budget<input type="number" min="0" value={budget} onChange={event=>setBudget(event.target.value)}/></label><label>Devise<select value={currency} onChange={event=>setCurrency(event.target.value)}><option value="XOF">FCFA (XOF)</option><option value="EUR">Euro</option><option value="USD">Dollar</option><option value="GBP">Livre sterling</option></select></label><button className="btn primary">Enregistrer</button></form>}
        <div className="budget-bars">
          <BudgetBar label="Budget" value={metrics.reference} max={Math.max(metrics.reference,metrics.forecast,1)} text={format(metrics.reference)}/>
          <BudgetBar label="Prévu" value={metrics.planned} max={Math.max(metrics.reference,metrics.forecast,1)} text={format(metrics.planned)}/>
          <BudgetBar label="Engagé" value={metrics.committed} max={Math.max(metrics.reference,metrics.forecast,1)} text={format(metrics.committed)}/>
          <BudgetBar label="Réel" value={metrics.actual} max={Math.max(metrics.reference,metrics.forecast,1)} text={format(metrics.actual)}/>
          <BudgetBar label="À terminaison" value={metrics.forecast} max={Math.max(metrics.reference,metrics.forecast,1)} text={format(metrics.forecast)} alert={metrics.forecast>metrics.reference}/>
        </div>
        <div className={`finance-alert ${metrics.variance<0?'danger':'healthy'}`}><CircleDollarSign size={19}/><div><b>{metrics.variance<0?'Dépassement prévisionnel':'Budget sous contrôle'}</b><span>{metrics.variance<0?`${format(Math.abs(metrics.variance))} au-dessus de la référence.`:`Marge prévisionnelle de ${format(metrics.variance)}.`}</span></div></div>
      </section>
      <section className="card finance-performance">
        <h3>Performance acquise</h3><p>Lecture simplifiée de la valeur acquise à partir de l’avancement.</p>
        <div className="performance-value"><b>{format(metrics.earned)}</b><span>Valeur acquise</span></div>
        <div className="performance-ring" style={{'--value':`${Math.min(100,Math.max(0,(metrics.cpi||0)*100)) * 3.6}deg`}}><span><b>{metrics.cpi?metrics.cpi.toFixed(2):'—'}</b><small>Indice CPI</small></span></div>
        <small>{metrics.cpi===null?'Saisissez des coûts réels pour calculer l’indice.':metrics.cpi>=1?'Chaque franc dépensé produit la valeur attendue.':'Le rendement des dépenses est sous la cible.'}</small>
      </section>
    </div>

    <div className="finance-grid lower">
      <section className="card cost-form-card">
        <div className="finance-title"><div><h3>Ajouter un coût</h3><p>Reliez une dépense à une tâche ou à un fournisseur.</p></div><Plus size={20}/></div>
        <form onSubmit={submit} className="cost-form">
          <label className="span-2">Libellé<input required autoFocus value={form.description} onChange={event=>setForm({...form,description:event.target.value})} placeholder="Ex. Hébergement de production"/></label>
          <label>Catégorie<select value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{categories.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Type<select value={form.cost_type} onChange={event=>setForm({...form,cost_type:event.target.value})}><option>Ponctuel</option><option>Récurrent</option><option>Provision</option></select></label>
          <label>Montant prévu<input type="number" min="0" value={form.planned_amount} onChange={event=>setForm({...form,planned_amount:event.target.value})}/></label>
          <label>Montant engagé<input type="number" min="0" value={form.committed_amount} onChange={event=>setForm({...form,committed_amount:event.target.value})}/></label>
          <label>Montant réel<input type="number" min="0" value={form.actual_amount} onChange={event=>setForm({...form,actual_amount:event.target.value})}/></label>
          <label>Date<input type="date" value={form.entry_date} onChange={event=>setForm({...form,entry_date:event.target.value})}/></label>
          <label>Statut<select value={form.status} onChange={event=>setForm({...form,status:event.target.value})}>{statuses.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Fournisseur<select value={form.supplier_id} onChange={event=>setForm({...form,supplier_id:event.target.value})}><option value="">Aucun</option>{suppliers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="span-2">Tâche liée<select value={form.task_id} onChange={event=>setForm({...form,task_id:event.target.value})}><option value="">Aucune</option>{tasks.map(item=><option key={item.id} value={item.id}>{item.wbs_code?`${item.wbs_code} · `:''}{item.title}</option>)}</select></label>
          <label className="span-2">Notes<textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></label>
          <button className="btn primary span-2"><Plus size={16}/>Ajouter le coût</button>
        </form>
      </section>
      <section className="card cashflow-card"><h3>Décaissements mensuels</h3><p>Montants réellement payés selon la date des lignes de coûts.</p>{months.length?<div className="cashflow-chart">{months.map(([month,value])=><div key={month}><span title={format(value)} style={{height:`${Math.max(5,value/maxMonth*100)}%`}}/><b>{new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(new Date(`${month}-02`))}</b><small>{format(value)}</small></div>)}</div>:<div className="finance-empty">Les décaissements apparaîtront ici après la première saisie.</div>}</section>
    </div>

    <section className="card cost-table-card">
      <div className="finance-title"><div><h3>Registre des coûts</h3><p>{costs.length} ligne(s) suivie(s) pour ce projet.</p></div></div>
      <div className="cost-table-wrap"><table><thead><tr><th>Libellé</th><th>Catégorie</th><th>Échéance</th><th>Prévu</th><th>Engagé</th><th>Réel</th><th>Statut</th><th></th></tr></thead><tbody>{costs.map(row=><tr key={row.id}><td><b>{row.description}</b><small>{suppliers.find(item=>item.id===row.supplier_id)?.name||tasks.find(item=>item.id===row.task_id)?.title||row.cost_type}</small></td><td>{row.category||'—'}</td><td>{row.entry_date?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(row.entry_date)):'—'}</td><td>{format(row.planned_amount)}</td><td>{format(row.committed_amount)}</td><td><strong>{format(row.actual_amount)}</strong></td><td><span className={`cost-status ${String(row.status).toLowerCase()}`}>{row.status}</span></td><td><button className="row-delete" title="Supprimer" onClick={()=>onDelete(row.id)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
      {!costs.length&&<div className="finance-empty">Aucun coût saisi. Le budget de référence reste disponible pour démarrer.</div>}
    </section>
  </div>
}

function FinanceKpi({icon:Icon,label,value,note,tone}){return <div className="card finance-kpi"><span className={`finance-kpi-icon ${tone}`}><Icon size={20}/></span><div><small>{label}</small><b>{value}</b><span>{note}</span></div></div>}
function BudgetBar({label,value,max,text,alert}) {return <div className="budget-bar"><span>{label}</span><i><em className={alert?'alert':''} style={{width:`${Math.min(100,amount(value)/max*100)}%`}}/></i><b>{text}</b></div>}
