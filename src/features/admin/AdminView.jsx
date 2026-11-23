import { useEffect, useMemo, useState } from 'react'
import { BellRing, Building2, CalendarPlus, CircleDollarSign, Mail, PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Users } from 'lucide-react'

const money=(amount,currency='XOF')=>new Intl.NumberFormat('fr-FR',{style:'currency',currency,maximumFractionDigits:currency==='XOF'?0:2}).format(Number(amount||0))
const shortDate=value=>value?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'—'

export default function AdminView({plans=[],onLoad,onManage,onUpdateChannel}){
  const [data,setData]=useState(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const load=async()=>{setBusy('load');setError('');try{setData(await onLoad())}catch(reason){setError(reason.message||'Impossible de charger la console.')}finally{setBusy('')}}
  useEffect(()=>{load()},[])
  const workspaces=useMemo(()=>{const needle=query.trim().toLowerCase();return (data?.workspaces||[]).filter(row=>!needle||[row.name,row.owner_name,row.owner_email,row.subscription_plan].some(value=>String(value||'').toLowerCase().includes(needle)))},[data,query])
  const action=async(workspaceId,adminAction,extra={})=>{setBusy(`${workspaceId}:${adminAction}`);setError('');try{await onManage({target_workspace_id:workspaceId,admin_action:adminAction,...extra});await load()}catch(reason){setError(reason.message||'Action impossible.');setBusy('')}}
  const channel=async(row)=>{setBusy(`channel:${row.channel}`);setError('');try{await onUpdateChannel(row.channel,{enabled:!row.enabled});await load()}catch(reason){setError(reason.message||'Mise à jour impossible.');setBusy('')}}
  if(!data)return <section className="card admin-loading"><RefreshCw className={busy?'spin':''}/><b>Chargement de la console Jalonis…</b>{error&&<p>{error}</p>}</section>
  const metrics=data.metrics||{}
  return <div className="admin-page">
    {error&&<div className="app-error">{error}<button onClick={()=>setError('')}>×</button></div>}
    <section className="admin-metrics">
      <Metric icon={Users} label="Comptes" value={metrics.accounts}/><Metric icon={Building2} label="Espaces" value={metrics.workspaces}/><Metric icon={ShieldCheck} label="Abonnements actifs" value={metrics.active_subscriptions}/><Metric icon={CircleDollarSign} label="Paiements à vérifier" value={metrics.pending_payments}/>
    </section>
    <section className="card admin-channels"><header><div><BellRing size={19}/><span><h3>Canaux de notification</h3><p>État opérationnel des rappels externes.</p></span></div><button className="btn ghost" onClick={load} disabled={Boolean(busy)}><RefreshCw size={15}/>Actualiser</button></header><div>{(data.channels||[]).map(row=><article key={row.channel}><i>{row.channel==='email'?<Mail/>:<BellRing/>}</i><span><b>{row.channel==='email'?'E-mail':'WhatsApp'} · {row.provider}</b><small>{row.configured?'Configuration serveur renseignée':'Clés du fournisseur à renseigner dans Supabase'} · {row.schedule_label||'Planification non définie'}</small></span><em className={row.configured?'ready':'waiting'}>{row.configured?'Configuré':'À configurer'}</em><button disabled={!row.configured||busy===`channel:${row.channel}`} onClick={()=>channel(row)}>{row.enabled?'Désactiver':'Activer'}</button></article>)}</div><footer><span>{metrics.pending_emails||0} e-mail(s) en attente · {metrics.failed_emails||0} en échec</span><span>{metrics.pending_whatsapp||0} WhatsApp en attente · {metrics.failed_whatsapp||0} en échec</span></footer></section>
    <section className="card admin-workspaces"><header><div><Building2 size={19}/><span><h3>Comptes et abonnements</h3><p>Activation, suspension et prolongation centralisées.</p></span></div><input type="search" placeholder="Rechercher un espace, un client…" value={query} onChange={event=>setQuery(event.target.value)}/></header><div className="admin-workspace-list">{workspaces.map(row=><WorkspaceRow key={row.id} row={row} plans={plans} busy={busy} onAction={action}/>)}</div></section>
    {(data.recent_failures||[]).length>0&&<section className="card admin-failures"><h3>Paiements échoués récents</h3>{data.recent_failures.map(row=><div key={row.id}><span><b>{row.plan_code}</b><small>{row.provider} · {shortDate(row.created_at)}</small></span><strong>{money(row.amount,row.currency)}</strong><em>Échec</em></div>)}</section>}
  </div>
}

function Metric({icon:Icon,label,value}){return <article className="card"><i><Icon size={19}/></i><span><small>{label}</small><b>{Number(value||0)}</b></span></article>}

function WorkspaceRow({row,plans,busy,onAction}){
  const [plan,setPlan]=useState(row.plan_code||'discovery'),[seats,setSeats]=useState(Number(row.seats||row.seat_limit||1)),[days,setDays]=useState(30)
  const pending=String(busy).startsWith(`${row.id}:`)
  const suspended=row.subscription_status_code==='past_due'
  return <article><div className="admin-customer"><span>{row.name?.[0]||'J'}</span><div><b>{row.name}</b><small>{row.owner_name||'Propriétaire'} · {row.owner_email||'Adresse non renseignée'}</small><em>{row.account_type} · {row.member_count} membre(s) · {row.project_count} projet(s)</em></div></div><div className="admin-plan-fields"><label>Offre<select value={plan} onChange={event=>setPlan(event.target.value)}>{plans.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>Sièges<input type="number" min="1" value={seats} onChange={event=>setSeats(Math.max(1,Number(event.target.value)||1))}/></label><label>Jours<input type="number" min="1" max="730" value={days} onChange={event=>setDays(Math.max(1,Number(event.target.value)||1))}/></label></div><div className="admin-subscription-state"><b className={suspended?'suspended':'active'}>{suspended?'Suspendu':row.subscription_status||row.subscription_status_code||'Essai'}</b><small>Échéance {shortDate(row.current_period_end||row.trial_ends_at)}</small></div><div className="admin-row-actions"><button disabled={pending} title="Activer l’offre choisie" onClick={()=>onAction(row.id,'activate',{target_plan_code:plan,target_seats:seats,extension_days:days})}><PlayCircle size={15}/>Activer</button><button disabled={pending} title="Prolonger l’échéance" onClick={()=>onAction(row.id,'extend',{extension_days:days})}><CalendarPlus size={15}/>Prolonger</button><button disabled={pending} className={suspended?'resume':'suspend'} onClick={()=>onAction(row.id,suspended?'reactivate':'suspend')}><PauseCircle size={15}/>{suspended?'Réactiver':'Suspendre'}</button></div></article>
}
