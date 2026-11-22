import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Bot, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, LockKeyhole, Send, ShieldAlert, Sparkles, UserRoundX } from 'lucide-react'
import '../../styles/assistant.css'
import '../../styles/assistant-theme.css'

const dayKey=value=>value?String(value).slice(0,10):''
const todayKey=()=>{const value=new Date();return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`}
const money=(value,currency='XOF')=>new Intl.NumberFormat('fr-FR',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value)||0)

export default function ProjectAssistant({project,entities,onNavigate,onAnalyze,advancedAvailable=false}){
  const [question,setQuestion]=useState('Quels sont les trois points à traiter en priorité cette semaine ?')
  const [analysis,setAnalysis]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const report=useMemo(()=>buildReport(project,entities),[project,entities])
  const ask=async event=>{
    event.preventDefault()
    if(!advancedAvailable||!question.trim())return
    setLoading(true);setError('')
    try{const result=await onAnalyze(question.trim());setAnalysis(result?.analysis||'Analyse indisponible.')}
    catch(reason){setError(reason?.message||'Impossible de produire l’analyse approfondie.')}
    finally{setLoading(false)}
  }
  return <div className="assistant-page">
    <section className="assistant-hero card">
      <div className="assistant-orb"><Sparkles size={24}/></div>
      <div><small>ASSISTANT DE PILOTAGE</small><h2>{report.headline}</h2><p>{report.summary}</p></div>
      <div className={`assistant-score ${report.score<55?'critical':report.score<75?'warning':''}`}><span>{report.score}</span><small>indice de maîtrise</small></div>
    </section>
    <section className="assistant-metrics">
      <Metric icon={Clock3} label="Retards" value={report.counts.overdue} tone={report.counts.overdue?'danger':'good'}/>
      <Metric icon={AlertTriangle} label="Blocages" value={report.counts.blocked} tone={report.counts.blocked?'warning':'good'}/>
      <Metric icon={ShieldAlert} label="Risques critiques" value={report.counts.critical} tone={report.counts.critical?'danger':'good'}/>
      <Metric icon={CircleDollarSign} label="Coûts engagés" value={money(report.costs,project.currency)} note={`${report.budgetUse}% du budget`} tone={report.budgetUse>90?'danger':'neutral'}/>
    </section>
    <div className="assistant-layout">
      <section className="card assistant-priorities">
        <header><div><small>RECOMMANDATIONS EXPLICABLES</small><h3>Ordre d’action suggéré</h3></div><span>{report.priorities.length} signal{report.priorities.length>1?'s':''}</span></header>
        <div>{report.priorities.map((item,index)=><article key={item.id} className={item.tone}><i>{index+1}</i><span className="priority-icon"><item.icon size={17}/></span><div><b>{item.title}</b><p>{item.reason}</p><small>{item.evidence}</small></div><button onClick={()=>onNavigate(item.target)}>Voir<ArrowRight size={14}/></button></article>)}</div>
        {!report.priorities.length&&<div className="assistant-clear"><CheckCircle2 size={30}/><b>Aucune alerte majeure détectée</b><p>Continuez à mettre à jour les dates, responsables, coûts et risques pour conserver cette visibilité.</p></div>}
      </section>
      <section className="card assistant-analysis">
        <header><span><Bot size={19}/></span><div><small>ANALYSE APPROFONDIE</small><h3>Interroger le projet</h3></div>{!advancedAvailable&&<em><LockKeyhole size={12}/>Business</em>}</header>
        {advancedAvailable?<form onSubmit={ask}><div className="assistant-prompts">{['Prépare une synthèse pour le sponsor','Analyse les risques de délai','Que faut-il arbitrer cette semaine ?'].map(prompt=><button type="button" key={prompt} onClick={()=>setQuestion(prompt)}>{prompt}</button>)}</div><textarea value={question} onChange={event=>setQuestion(event.target.value)} maxLength={600}/><small className="assistant-disclosure">Une synthèse structurée du projet sera transmise au fournisseur d’analyse. Les commentaires, coordonnées et pièces jointes sont exclus.</small><button className="btn primary" disabled={loading||!question.trim()}>{loading?'Analyse en cours…':<><Send size={15}/>Analyser</>}</button></form>:<div className="assistant-locked"><LockKeyhole size={27}/><b>Analyse générative non activée</b><p>Les recommandations locales ci-contre fonctionnent déjà. L’analyse rédigée sera disponible avec l’offre Business et la clé serveur configurée.</p></div>}
        {error&&<p className="assistant-error">{error}</p>}
        {analysis&&<div className="assistant-answer"><small>RÉPONSE DE L’ASSISTANT</small><p>{analysis}</p><em>Vérifiez les recommandations importantes avant toute décision.</em></div>}
      </section>
    </div>
    <section className="assistant-method card"><CalendarClock size={18}/><div><b>Comment cet indice est calculé</b><p>Jalonis pénalise les activités en retard ou bloquées, les risques critiques, les éléments sans responsable et un budget presque consommé. Chaque recommandation cite la donnée qui l’a déclenchée.</p></div></section>
  </div>
}

function Metric({icon:Icon,label,value,note,tone}){return <article className={`card assistant-metric ${tone}`}><Icon size={18}/><div><small>{label}</small><b>{value}</b>{note&&<span>{note}</span>}</div></article>}

function buildReport(project,entities){
  const today=todayKey(),isScrum=project.methodology==='Scrum'
  const items=(isScrum?entities.backlog_items.filter(item=>item.item_type!=='Epic'):entities.tasks).filter(item=>item.status!=='Terminé')
  const overdue=items.filter(item=>item.due_date&&dayKey(item.due_date)<today)
  const blocked=items.filter(item=>['Bloqué','En attente'].includes(item.status))
  const unassigned=items.filter(item=>!item.assignee&&!item.assignee_id)
  const critical=entities.risks.filter(item=>item.status!=='Fermé'&&Number(item.probability)*Number(item.impact)>=15)
  const unresolvedIssues=entities.issues.filter(item=>!['Résolu','Fermé'].includes(item.status))
  const costs=entities.cost_entries.reduce((sum,item)=>sum+Number(item.actual_amount||item.committed_amount||0),0)
  const budget=Number(project.budget)||0,budgetUse=budget?Math.round(costs/budget*100):0
  const priorities=[]
  if(overdue.length)priorities.push({id:'overdue',tone:'danger',icon:Clock3,target:isScrum?'scrum':'tasks',title:`Replanifier ${overdue.length} élément${overdue.length>1?'s':''} en retard`,reason:'Une échéance dépassée réduit la fiabilité des prévisions et peut déplacer la date de livraison.',evidence:`Plus ancien retard : ${overdue.sort((a,b)=>dayKey(a.due_date).localeCompare(dayKey(b.due_date)))[0]?.title}.`})
  if(blocked.length)priorities.push({id:'blocked',tone:'warning',icon:AlertTriangle,target:isScrum?'scrum':'tasks',title:`Lever ${blocked.length} blocage${blocked.length>1?'s':''}`,reason:'Un élément bloqué immobilise le flux et peut entraîner des dépendances en cascade.',evidence:`À examiner : ${blocked.slice(0,2).map(item=>item.title).join(' · ')}.`})
  if(critical.length)priorities.push({id:'risks',tone:'danger',icon:ShieldAlert,target:'risks',title:`Traiter ${critical.length} risque${critical.length>1?'s critiques':' critique'}`,reason:'Le score probabilité × impact atteint le seuil critique de 15.',evidence:`Priorité : ${critical.sort((a,b)=>Number(b.probability)*Number(b.impact)-Number(a.probability)*Number(a.impact))[0]?.title}.`})
  if(budgetUse>=90)priorities.push({id:'budget',tone:budgetUse>100?'danger':'warning',icon:CircleDollarSign,target:'finance',title:budgetUse>100?'Arbitrer le dépassement budgétaire':'Sécuriser le budget restant',reason:`${budgetUse}% du budget de référence est déjà engagé.`,evidence:`${money(costs,project.currency)} engagés sur ${money(budget,project.currency)}.`})
  if(unassigned.length)priorities.push({id:'unassigned',tone:'neutral',icon:UserRoundX,target:isScrum?'scrum':'tasks',title:`Attribuer ${unassigned.length} élément${unassigned.length>1?'s':''}`,reason:'Sans responsable explicite, le suivi et l’escalade deviennent ambigus.',evidence:`Exemple : ${unassigned[0]?.title}.`})
  if(unresolvedIssues.length)priorities.push({id:'issues',tone:'warning',icon:AlertTriangle,target:'governance',title:`Décider sur ${unresolvedIssues.length} problème${unresolvedIssues.length>1?'s ouverts':' ouvert'}`,reason:'Les problèmes non arbitrés peuvent se transformer en retard, coût ou conflit.',evidence:`À examiner : ${unresolvedIssues[0]?.title}.`})
  const penalty=Math.min(75,overdue.length*7+blocked.length*9+critical.length*10+unassigned.length*2+(budgetUse>=90?12:0)+(budgetUse>100?8:0)+unresolvedIssues.length*3)
  const score=Math.max(25,100-penalty)
  const headline=score>=85?'Le projet est maîtrisé.':score>=70?'Quelques arbitrages protégeront la trajectoire.':score>=55?'La trajectoire demande une intervention rapide.':'Le projet nécessite un plan de redressement.'
  const summary=priorities.length?`${priorities.length} action${priorities.length>1?'s':''} prioritaire${priorities.length>1?'s':''} ressortent des données actuelles. Commencez par « ${priorities[0].title} ».`:'Aucun signal majeur ne ressort des données actuelles. Continuez le suivi régulier.'
  return {score,headline,summary,priorities:priorities.slice(0,6),counts:{overdue:overdue.length,blocked:blocked.length,critical:critical.length},costs,budgetUse}
}
