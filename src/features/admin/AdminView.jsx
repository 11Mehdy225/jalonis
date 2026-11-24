import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BellRing, Building2, CalendarPlus, CircleDollarSign, FolderKanban, Mail, PauseCircle, PlayCircle, RefreshCw, ShieldCheck, TicketPercent, TrendingUp, Users } from 'lucide-react'
import MonitoringCenter from './MonitoringCenter'
import PrivacyRequestsPanel from './PrivacyRequestsPanel'
import '../../styles/privacy-admin.css'

const money=(amount,currency='XOF')=>new Intl.NumberFormat('fr-FR',{style:'currency',currency,maximumFractionDigits:currency==='XOF'?0:2}).format(Number(amount||0))
const shortDate=value=>value?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'—'

export default function AdminView({plans=[],onLoad,onReadiness,onMonitoring,onManageIncident,onPrivacyRequests,onManagePrivacyRequest,onManage,onCreatePromotion,onSetPromotionActive,onUpdateChannel}){
  const [data,setData]=useState(null),[readiness,setReadiness]=useState(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const load=async()=>{setBusy('load');setError('');try{const [dashboard,health]=await Promise.all([onLoad(),onReadiness?.()]);setData(dashboard);setReadiness(health||null)}catch(reason){setError(reason.message||'Impossible de charger la console.')}finally{setBusy('')}}
  useEffect(()=>{load()},[])
  const workspaces=useMemo(()=>{const needle=query.trim().toLowerCase();return (data?.workspaces||[]).filter(row=>!needle||[row.name,row.owner_name,row.owner_email,row.subscription_plan].some(value=>String(value||'').toLowerCase().includes(needle)))},[data,query])
  const action=async(workspaceId,adminAction,extra={})=>{setBusy(`${workspaceId}:${adminAction}`);setError('');try{await onManage({target_workspace_id:workspaceId,admin_action:adminAction,...extra});await load()}catch(reason){setError(reason.message||'Action impossible.');setBusy('')}}
  const channel=async(row)=>{setBusy(`channel:${row.channel}`);setError('');try{await onUpdateChannel(row.channel,{enabled:!row.enabled});await load()}catch(reason){setError(reason.message||'Mise à jour impossible.');setBusy('')}}
  const createPromotion=async values=>{setBusy('promotion:create');setError('');try{await onCreatePromotion(values);await load()}catch(reason){setError(reason.message||'Impossible de créer ce code.');setBusy('');throw reason}}
  const togglePromotion=async row=>{setBusy(`promotion:${row.id}`);setError('');try{await onSetPromotionActive({p_code_id:row.id,p_active:!row.active});await load()}catch(reason){setError(reason.message||'Impossible de modifier ce code.');setBusy('')}}
  if(!data)return <section className="card admin-loading"><RefreshCw className={busy?'spin':''}/><b>Chargement de la console Jalonis…</b>{error&&<p>{error}</p>}</section>
  const metrics=data.metrics||{}
  return <div className="admin-page">
    {error&&<div className="app-error">{error}<button onClick={()=>setError('')}>×</button></div>}
    <section className="admin-metrics">
      <Metric icon={CircleDollarSign} label="MRR estimé" value={money(metrics.mrr_xof)} note="revenu mensuel récurrent"/>
      <Metric icon={TrendingUp} label="Revenus sur 30 jours" value={money(metrics.revenue_30d_xof)} note={`${money(metrics.revenue_total_xof)} encaissés au total`}/>
      <Metric icon={ShieldCheck} label="Abonnements payants" value={metrics.paid_subscriptions} note={`${metrics.conversion_rate||0}% de conversion`}/>
      <Metric icon={AlertTriangle} label="À surveiller" value={Number(metrics.past_due||0)+Number(metrics.expiring_7d||0)} note={`${metrics.past_due||0} impayé(s) · ${metrics.expiring_7d||0} échéance(s)`}/>
      <Metric icon={Users} label="Comptes" value={metrics.accounts} note={`+${metrics.new_accounts_30d||0} sur 30 jours`}/>
      <Metric icon={Building2} label="Espaces" value={metrics.workspaces} note={`${metrics.active_members||0} membres actifs`}/>
      <Metric icon={FolderKanban} label="Projets" value={metrics.projects} note="tous espaces confondus"/>
      <Metric icon={TicketPercent} label="Promotions utilisées" value={metrics.promotion_redemptions} note={`${metrics.active_promotions||0} code(s) actif(s)`}/>
    </section>
    {readiness&&<ReadinessPanel
      data={readiness}
    />}
    <MonitoringCenter onLoad={onMonitoring} onManageIncident={onManageIncident}/>
    <PrivacyRequestsPanel onLoad={onPrivacyRequests} onManage={onManagePrivacyRequest}/>
    <PromotionManager plans={plans} rows={data.promotion_codes||[]} busy={busy} onCreate={createPromotion} onToggle={togglePromotion}/>
    <section className="card admin-channels"><header><div><BellRing size={19}/><span><h3>Canaux de notification</h3><p>État opérationnel des rappels externes.</p></span></div><button className="btn ghost" onClick={load} disabled={Boolean(busy)}><RefreshCw size={15}/>Actualiser</button></header><div>{(data.channels||[]).map(row=><article key={row.channel}><i>{row.channel==='email'?<Mail/>:<BellRing/>}</i><span><b>{row.channel==='email'?'E-mail':'WhatsApp'} · {row.provider}</b><small>{row.configured?'Configuration serveur renseignée':'Clés du fournisseur à renseigner dans Supabase'} · {row.schedule_label||'Planification non définie'}</small></span><em className={row.configured?'ready':'waiting'}>{row.configured?'Configuré':'À configurer'}</em><button disabled={!row.configured||busy===`channel:${row.channel}`} onClick={()=>channel(row)}>{row.enabled?'Désactiver':'Activer'}</button></article>)}</div><footer><span>{metrics.pending_emails||0} e-mail(s) en attente · {metrics.failed_emails||0} en échec</span><span>{metrics.pending_whatsapp||0} WhatsApp en attente · {metrics.failed_whatsapp||0} en échec</span></footer></section>
    <section className="card admin-workspaces"><header><div><Building2 size={19}/><span><h3>Comptes et abonnements</h3><p>Activation, suspension et prolongation centralisées.</p></span></div><input type="search" placeholder="Rechercher un espace, un client…" value={query} onChange={event=>setQuery(event.target.value)}/></header><div className="admin-workspace-list">{workspaces.map(row=><WorkspaceRow key={row.id} row={row} plans={plans} busy={busy} onAction={action}/>)}</div></section>
    {(data.recent_failures||[]).length>0&&<section className="card admin-failures"><h3>Paiements échoués récents</h3>{data.recent_failures.map(row=><div key={row.id}><span><b>{row.plan_code}</b><small>{row.provider} · {shortDate(row.created_at)}</small></span><strong>{money(row.amount,row.currency)}</strong><em>Échec</em></div>)}</section>}
  </div>
}

function ReadinessPanel({data}){
  const summary=data.summary||{},requiredComplete=summary.required_ready===summary.required_total
  return <section className="card admin-readiness"><header><div><ShieldCheck size={19}/><span><h3>Préparation de la production</h3><p>Diagnostic serveur sans exposition des clés ni des secrets.</p></span></div><em className={requiredComplete?'ready':'waiting'}>{summary.required_ready||0}/{summary.required_total||0} indispensables</em></header><div>{(data.checks||[]).map(row=><article key={row.id}><i className={row.ready?'ready':row.optional?'optional':'waiting'}>{row.ready?<ShieldCheck/>:<AlertTriangle/>}</i><span><small>{row.group}{row.optional?' · facultatif':''}</small><b>{row.label}</b><p>{row.detail}</p></span><em className={row.ready?'ready':row.optional?'optional':'waiting'}>{row.ready?'Prêt':row.optional?'Optionnel':'À terminer'}</em></article>)}</div></section>
}

function Metric({icon:Icon,label,value,note}){return <article className="card"><i><Icon size={19}/></i><span><small>{label}</small><b>{typeof value==='string'?value:Number(value||0)}</b>{note&&<em>{note}</em>}</span></article>}

function PromotionManager({plans,rows,busy,onCreate,onToggle}){
  const eligible=plans.filter(plan=>plan.code!=='discovery'&&plan.code!=='enterprise')
  const [form,setForm]=useState({p_code:'',p_label:'',p_plan_code:eligible[0]?.code||'personal_pro',p_duration_days:30,p_max_redemptions:'',p_valid_until:''})
  const [saved,setSaved]=useState(false)
  const submit=async event=>{event.preventDefault();await onCreate({...form,p_duration_days:Number(form.p_duration_days),p_max_redemptions:form.p_max_redemptions?Number(form.p_max_redemptions):null,p_valid_until:form.p_valid_until?new Date(`${form.p_valid_until}T23:59:59`).toISOString():null});setForm(current=>({...current,p_code:'',p_label:''}));setSaved(true);setTimeout(()=>setSaved(false),1800)}
  return <section className="card admin-promotions">
    <header><div><TicketPercent size={19}/><span><h3>Codes promotionnels</h3><p>La durée commence au moment où un espace valide le code.</p></span></div><em>{rows.filter(row=>row.active).length} actif(s)</em></header>
    <form onSubmit={submit}>
      <label>Code<input required minLength="4" maxLength="32" value={form.p_code} onChange={event=>setForm({...form,p_code:event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,'')})} placeholder="LANCEMENT30"/></label>
      <label>Libellé<input value={form.p_label} onChange={event=>setForm({...form,p_label:event.target.value})} placeholder="Campagne de lancement"/></label>
      <label>Offre<select value={form.p_plan_code} onChange={event=>setForm({...form,p_plan_code:event.target.value})}>{eligible.map(plan=><option key={plan.code} value={plan.code}>{plan.name}</option>)}</select></label>
      <label>Durée (jours)<input required type="number" min="1" max="730" value={form.p_duration_days} onChange={event=>setForm({...form,p_duration_days:event.target.value})}/></label>
      <label>Utilisations max<input type="number" min="1" value={form.p_max_redemptions} onChange={event=>setForm({...form,p_max_redemptions:event.target.value})} placeholder="Illimité"/></label>
      <label>Code valable jusqu’au<input type="date" value={form.p_valid_until} onChange={event=>setForm({...form,p_valid_until:event.target.value})}/></label>
      <button className="btn primary" disabled={busy==='promotion:create'}>{busy==='promotion:create'?'Création…':saved?'Code créé':'Créer le code'}</button>
    </form>
    <div className="promotion-list">{rows.length?rows.map(row=><article key={row.id}><span><b>{row.code}</b><small>{row.label||row.plan_code} · {row.duration_days} jours à partir de l’activation</small></span><span><strong>{row.redemption_count||0}{row.max_redemptions?` / ${row.max_redemptions}`:''}</strong><small>utilisation(s)</small></span><span><strong>{row.valid_until?shortDate(row.valid_until):'Sans date limite'}</strong><small>validité du code</small></span><button className={row.active?'deactivate':'activate'} disabled={busy===`promotion:${row.id}`} onClick={()=>onToggle(row)}>{row.active?'Désactiver':'Réactiver'}</button></article>):<p className="promotion-empty">Aucun code créé pour le moment.</p>}</div>
  </section>
}

function WorkspaceRow({row,plans,busy,onAction}){
  const [plan,setPlan]=useState(row.plan_code||'discovery'),[seats,setSeats]=useState(Number(row.seats||row.seat_limit||1)),[days,setDays]=useState(30)
  const pending=String(busy).startsWith(`${row.id}:`)
  const suspended=row.subscription_status_code==='past_due'
  return <article><div className="admin-customer"><span>{row.name?.[0]||'J'}</span><div><b>{row.name}</b><small>{row.owner_name||'Propriétaire'} · {row.owner_email||'Adresse non renseignée'}</small><em>{row.account_type} · {row.member_count} membre(s) · {row.project_count} projet(s)</em></div></div><div className="admin-plan-fields"><label>Offre<select value={plan} onChange={event=>setPlan(event.target.value)}>{plans.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>Sièges<input type="number" min="1" value={seats} onChange={event=>setSeats(Math.max(1,Number(event.target.value)||1))}/></label><label>Jours<input type="number" min="1" max="730" value={days} onChange={event=>setDays(Math.max(1,Number(event.target.value)||1))}/></label></div><div className="admin-subscription-state"><b className={suspended?'suspended':'active'}>{suspended?'Suspendu':row.subscription_status||row.subscription_status_code||'Essai'}</b><small>Échéance {shortDate(row.current_period_end||row.trial_ends_at)}</small></div><div className="admin-row-actions"><button disabled={pending} title="Activer l’offre choisie" onClick={()=>onAction(row.id,'activate',{target_plan_code:plan,target_seats:seats,extension_days:days})}><PlayCircle size={15}/>Activer</button><button disabled={pending} title="Prolonger l’échéance" onClick={()=>onAction(row.id,'extend',{extension_days:days})}><CalendarPlus size={15}/>Prolonger</button><button disabled={pending} className={suspended?'resume':'suspend'} onClick={()=>onAction(row.id,suspended?'reactivate':'suspend')}><PauseCircle size={15}/>{suspended?'Réactiver':'Suspendre'}</button></div></article>
}
