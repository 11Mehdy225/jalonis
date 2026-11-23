import { useEffect, useState } from 'react'
import { BadgeCheck, BellRing, Building2, CalendarClock, Check, CircleCheck, Clock3, Gauge, Landmark, Mail, MessageCircle, ReceiptText, ShieldCheck, Trash2, UserPlus, Users, XCircle } from 'lucide-react'

const ROLES = ['Administrateur', 'Chef de projet', 'Scrum Master', 'Product Owner', 'Membre', 'Observateur', 'Fournisseur externe']
const PREFERENCE_DEFAULTS = { phone: '', notify_in_app: true, notify_email: true, notify_whatsapp: false, notify_assignments: true, notify_status_changes: true, notify_comments: true, daily_digest: true, quiet_start: '20:00', quiet_end: '07:00' }

export default function WorkspaceView({ data, canManage=false, canInvite=false, onRename, onInvite, onRemove, onUpdateRole, onUpdatePreferences, onCheckout, onManualPayment, onReviewPayment }) {
  const [name, setName] = useState(data?.workspace?.name || '')
  const [accountType, setAccountType] = useState(data?.workspace?.account_type || 'Personnel')
  const [saved, setSaved] = useState(false)
  useEffect(() => setName(data?.workspace?.name || ''), [data?.workspace?.name])
  useEffect(() => setAccountType(data?.workspace?.account_type || 'Personnel'), [data?.workspace?.account_type])
  if (!data) return <div className="card workspace-loading">Chargement de l’espace…</div>
  const active = data.members.filter(member => member.membership_status === 'Actif').length
  const pending = data.members.length - active
  const saveName = async event => {
    event.preventDefault(); await onRename({ name, account_type: accountType }); setSaved(true); setTimeout(() => setSaved(false), 1600)
  }
  return <div className="workspace-page">
    <section className="workspace-summary card">
      <div className="workspace-mark"><Building2 size={24}/></div>
      <form onSubmit={saveName}>
        <label>Nom de l’espace de travail</label>
        <div><input disabled={!canManage} value={name} onChange={event => setName(event.target.value)} required/><select disabled={!canManage} value={accountType} onChange={event => setAccountType(event.target.value)}><option>Personnel</option><option>Organisation</option></select>{canManage&&<button className="btn primary">Enregistrer</button>}</div>
        <small>{saved ? 'Nom enregistré' : 'Cet espace regroupe les projets et les membres de votre organisation.'}</small>
      </form>
      <div className="workspace-kpis"><span><b>{data.members.length}</b>Membres</span><span><b>{active}</b>Actifs</span><span><b>{pending}</b>Invitations</span><span><b>{data.workspace.subscription_plan || 'Découverte'}</b>{data.workspace.subscription_status || 'Local'}</span></div>
    </section>
    <SubscriptionOverview data={data} canManage={canManage} onCheckout={onCheckout} onManualPayment={onManualPayment}/>
    {data.is_platform_admin&&<ManualPaymentAdmin rows={data.platform_payment_requests||[]} onReview={onReviewPayment}/>}
    <section className="card members-card">
      <div className="members-head"><div><h3>Membres et accès</h3><p>Invitez les personnes qui pourront participer aux projets de cet espace.</p></div>{canInvite&&<button className="btn primary" onClick={onInvite}><UserPlus size={16}/>Inviter un membre</button>}</div>
      <div className="members-table">
        <div className="members-row header"><span>Membre</span><span>Rôle</span><span>Notifications</span><span>Accès</span><span></span></div>
        {data.members.map((member, index) => <div className="members-row" key={member.membership_id}>
          <span className="member-identity"><i className={`person-avatar c${index % 4}`}>{initials(member.full_name)}</i><span><b>{member.full_name}</b><small>{member.email}</small></span></span>
          <span>{canManage&&member.role!=='Propriétaire'?<select className="member-role-select" value={member.role} onChange={event=>onUpdateRole(member.membership_id,event.target.value)}>{ROLES.map(role=><option key={role}>{role}</option>)}</select>:<b>{member.role}</b>}<small>{member.job_title || 'Fonction non renseignée'}</small></span>
          <span className="notification-icons"><i className={member.notify_email ? 'enabled' : ''} title="E-mail"><Mail size={15}/></i><i className={member.notify_whatsapp ? 'enabled whatsapp' : ''} title="WhatsApp"><MessageCircle size={15}/></i></span>
          <span><em className={`access-status ${member.membership_status === 'Actif' ? 'active' : ''}`}>{member.membership_status}</em></span>
          <span>{canManage&&member.role !== 'Propriétaire' && <button className="row-delete" title="Retirer de l’espace" onClick={() => onRemove(member.membership_id)}><Trash2 size={16}/></button>}</span>
        </div>)}
      </div>
    </section>
    <NotificationPreferences user={data.current_user} onSave={onUpdatePreferences}/>
    <section className="workspace-note"><ShieldCheck size={18}/><div><b>Accès contrôlés par rôle</b><p>Chaque membre dispose uniquement des actions autorisées par son rôle. Les observateurs et fournisseurs externes restent en lecture seule.</p></div></section>
  </div>
}

function SubscriptionOverview({ data, canManage, onCheckout, onManualPayment }) {
  const [annual,setAnnual]=useState(false)
  const [loading,setLoading]=useState('')
  const [manualPlan,setManualPlan]=useState(null)
  const [paymentMethod,setPaymentMethod]=useState(data.billing_provider?.payment_method||'wave')
  const subscription=data.subscription||{}
  const currentCode=subscription.plan_code||'discovery'
  const currentPlan=data.plans?.find(plan=>plan.code===currentCode)
  const projectLimit=Number(currentPlan?.features?.projects ?? (currentCode==='discovery'?2:-1))
  const projects=Number(data.usage?.projects||0)
  const billable=data.members.filter(member=>member.membership_status==='Actif'&&!['Observateur','Fournisseur externe'].includes(member.role)).length
  const seatLimit=Number(subscription.seats||data.workspace.seat_limit||1)
  const [seats,setSeats]=useState(seatLimit)
  const trialEnd=subscription.current_period_end||data.workspace.trial_ends_at
  const trialDays=trialEnd?Math.max(0,Math.ceil((new Date(trialEnd)-new Date())/86400000)):null
  const plans=(data.plans||[]).filter(plan=>plan.account_type===data.workspace.account_type||plan.code==='discovery')
  const checkout=async plan=>{if(!data.automatic_billing_available){setManualPlan(plan);return}setLoading(plan.code);try{await onCheckout({plan_code:plan.code,billing_cycle:annual?'annual':'monthly',seats:Math.max(seats,Number(plan.min_seats)||1),provider:data.billing_provider?.provider,payment_method:paymentMethod})}finally{setLoading('')}}
  const hasManualPrice=plan=>(data.manual_payment_methods||[]).some(method=>(data.manual_plan_prices||[]).some(price=>price.plan_code===plan.code&&price.billing_cycle===(annual?'annual':'monthly')&&price.currency===method.currency))
  const onlinePrice=plan=>(data.provider_plan_prices||[]).find(price=>price.plan_code===plan.code&&price.billing_cycle===(annual?'annual':'monthly')&&price.currency===data.billing_provider?.currency)
  const manualPrice=plan=>(data.manual_plan_prices||[]).find(price=>price.plan_code===plan.code&&price.billing_cycle===(annual?'annual':'monthly')&&price.currency==='XOF')
  return <section className="card subscription-card">
    <header className="subscription-head"><div><span className="subscription-icon"><BadgeCheck size={21}/></span><div><small>ABONNEMENT</small><h3>{currentPlan?.name||data.workspace.subscription_plan||'Découverte'}</h3><p>{subscription.status==='trialing'&&trialDays!==null?`Essai gratuit · ${trialDays} jour${trialDays>1?'s':''} restant${trialDays>1?'s':''}`:data.workspace.subscription_status||'Mode local'}</p></div></div><div className="billing-controls">{data.workspace.account_type==='Organisation'&&<label>Sièges<input type="number" min="1" value={seats} onChange={event=>setSeats(Math.max(1,Number(event.target.value)||1))}/></label>}{data.automatic_billing_available&&data.billing_provider?.provider==='jeko'&&<label>Moyen de paiement<select value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value)}><option value="wave">Wave</option><option value="orange">Orange Money</option><option value="mtn">MTN MoMo</option><option value="moov">Moov Money</option><option value="djamo">Djamo</option></select></label>}<div className="billing-toggle"><button className={!annual?'active':''} onClick={()=>setAnnual(false)}>Mensuel</button><button className={annual?'active':''} onClick={()=>setAnnual(true)}>Annuel <em>2 mois offerts</em></button></div></div></header>
    <div className="usage-grid"><UsageMeter icon={Users} label="Sièges actifs" value={billable} limit={seatLimit}/><UsageMeter icon={Gauge} label="Projets" value={projects} limit={projectLimit}/><div className="trial-meter"><CalendarClock size={18}/><span><small>Prochaine échéance</small><b>{trialEnd?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(trialEnd)):'Aucune'}</b></span></div></div>
    <div className="plan-grid">{plans.map(plan=>{const providerPrice=onlinePrice(plan),localPrice=manualPrice(plan);const price=Number(providerPrice?.unit_amount??localPrice?.unit_amount??(annual?plan.annual_price_xof:plan.monthly_price_xof)??0);const currency=providerPrice?.currency||localPrice?.currency||(plan.monthly_price_xof!==undefined?'XOF':'EUR');const selected=plan.code===currentCode;const payable=!selected&&!['discovery','enterprise'].includes(plan.code);const minimum=Math.max(seats,Number(plan.min_seats)||1);const automaticAvailable=data.automatic_billing_available&&Boolean(providerPrice);const available=automaticAvailable||hasManualPrice(plan);return <article key={plan.code} className={selected?'current':''}><div><span>{selected?'OFFRE ACTUELLE':plan.account_type.toUpperCase()}</span><h4>{plan.name}</h4><p>{price===0?'Gratuit':<><b>{formatMoney(annual?price/12:price,currency)}</b><small> / mois{plan.min_seats>1?' / membre':''}</small></>}</p>{annual&&price>0?<em className="plan-saving">2 mois offerts · facturation annuelle</em>:null}{payable&&minimum>1?<em className="plan-total">Total : {formatMoney(price*minimum,currency)} {annual?'par an':'par mois'}</em>:null}</div><ul><li><Check size={13}/>{Number(plan.features?.projects)<0?'Projets illimités':`${plan.features?.projects||2} projets`}</li><li><Check size={13}/>{formatStorage(plan.features?.storage_mb)}</li><li><Check size={13}/>{plan.features?.collaboration?'Collaboration en temps réel':'Pilotage individuel'}</li></ul><button disabled={!payable||!canManage||!available||Boolean(loading)} onClick={()=>checkout(plan)}>{selected?'Plan actif':loading===plan.code?'Préparation…':plan.code==='enterprise'?'Nous contacter':available?(automaticAvailable?`Payer avec ${data.billing_provider?.display_name||'le paiement sécurisé'}`:'Payer par dépôt'):'Tarif bientôt disponible'}</button></article>})}</div>
    {manualPlan&&<ManualPaymentForm plan={manualPlan} annual={annual} seats={Math.max(seats,Number(manualPlan.min_seats)||1)} methods={data.manual_payment_methods||[]} prices={data.manual_plan_prices||[]} onCancel={()=>setManualPlan(null)} onSubmit={async form=>{setLoading(manualPlan.code);try{await onManualPayment({...form,plan_code:manualPlan.code,billing_cycle:annual?'annual':'monthly',seats:Math.max(seats,Number(manualPlan.min_seats)||1)});setManualPlan(null)}finally{setLoading('')}}}/>}
    {(data.manual_payment_requests||[]).length>0&&<ManualPaymentHistory rows={data.manual_payment_requests}/>}
    {data.billing_transactions?.length>0&&<div className="billing-history"><div><ReceiptText size={17}/><span><b>Historique de facturation</b><small>Dernières tentatives et confirmations de paiement.</small></span></div><div>{data.billing_transactions.map(row=><article key={row.id}><span><b>{row.plan_code}</b><small>{new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(row.created_at))}</small></span><strong>{Number(row.amount).toFixed(2)} {row.currency}</strong><em className={`billing-status ${row.status}`}>{billingStatus(row.status)}</em></article>)}</div></div>}
    <footer><ShieldCheck size={15}/><span>Le changement d’offre sera activé uniquement après confirmation sécurisée du paiement. Aucune carte bancaire n’est stockée par Jalonis.</span></footer>
  </section>
}

function UsageMeter({icon:Icon,label,value,limit}){
  const unlimited=limit<0
  const ratio=unlimited?0:Math.min(100,value/Math.max(1,limit)*100)
  return <div className="usage-meter"><Icon size={18}/><span><small>{label}</small><b>{value} / {unlimited?'∞':limit}</b><i><em style={{width:`${ratio}%`}}/></i></span></div>
}

function formatStorage(megabytes){const value=Number(megabytes||250);return value>=1024?`${Math.round(value/1024)} Go de stockage`:`${value} Mo de stockage`}
function billingStatus(status){return {pending:'En attente',successful:'Payé',failed:'Échoué',cancelled:'Annulé',refunded:'Remboursé'}[status]||status}

function ManualPaymentForm({plan,annual,seats,methods,prices,onCancel,onSubmit}){
  const cycle=annual?'annual':'monthly'
  const eligible=methods.filter(method=>prices.some(price=>price.plan_code===plan.code&&price.billing_cycle===cycle&&price.currency===method.currency))
  const [methodId,setMethodId]=useState(eligible[0]?.id||'')
  const [form,setForm]=useState({payer_name:'',payment_reference:''})
  const [saving,setSaving]=useState(false)
  const method=eligible.find(item=>item.id===methodId)||eligible[0]
  const price=prices.find(item=>item.plan_code===plan.code&&item.billing_cycle===cycle&&item.currency===method?.currency)
  const total=Number(price?.unit_amount||0)*seats
  const submit=async event=>{event.preventDefault();setSaving(true);try{await onSubmit({...form,payment_method_id:method.id})}finally{setSaving(false)}}
  return <form className="manual-payment-form" onSubmit={submit}><header><Landmark size={20}/><div><b>Paiement par dépôt · {plan.name}</b><small>Effectuez le dépôt puis renseignez sa référence. L’activation intervient après vérification.</small></div></header><div className="manual-payment-grid"><label>Moyen de paiement<select value={methodId} onChange={event=>setMethodId(event.target.value)}>{eligible.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="deposit-details"><span><small>Compte / numéro</small><b>{method?.account_reference}</b></span><span><small>Titulaire</small><b>{method?.account_name}</b></span><span><small>Montant exact</small><b>{formatMoney(total,method?.currency)}</b></span>{method?.instructions&&<p>{method.instructions}</p>}</div><label>Nom du payeur<input required maxLength="120" value={form.payer_name} onChange={event=>setForm({...form,payer_name:event.target.value})}/></label><label>Référence de la transaction<input required minLength="3" maxLength="120" value={form.payment_reference} onChange={event=>setForm({...form,payment_reference:event.target.value})} placeholder="Ex. identifiant Mobile Money"/></label></div><footer><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary" disabled={saving}>{saving?'Transmission…':'J’ai effectué le paiement'}</button></footer></form>
}

function ManualPaymentHistory({rows}){return <div className="manual-payment-history"><div><ReceiptText size={17}/><span><b>Demandes de paiement</b><small>Suivi des dépôts soumis à validation.</small></span></div>{rows.map(row=><article key={row.id}><span><b>{row.plan_catalog?.name||row.plan_code}</b><small>{row.manual_payment_methods?.name||'Dépôt'} · {row.payment_reference}</small></span><strong>{formatMoney(row.amount,row.currency)}</strong><em className={`billing-status ${row.status}`}>{manualStatus(row.status)}</em></article>)}</div>}

function ManualPaymentAdmin({rows,onReview}){const [notes,setNotes]=useState({}),[busy,setBusy]=useState('');const review=async(row,decision)=>{setBusy(row.id);try{await onReview({request_id:row.id,decision,note:notes[row.id]||''})}finally{setBusy('')}};return <section className="card manual-admin-card"><header><ShieldCheck size={20}/><div><h3>Validation des paiements</h3><p>{rows.length?`${rows.length} dépôt(s) attendent une vérification.`:'Aucun paiement en attente.'}</p></div></header>{rows.map(row=><article key={row.id}><div><b>{row.workspaces?.name||'Espace'} · {row.plan_catalog?.name||row.plan_code}</b><small>{row.payer_name} · {row.manual_payment_methods?.name} · référence {row.payment_reference}</small></div><strong>{formatMoney(row.amount,row.currency)}</strong><input placeholder="Note de contrôle" value={notes[row.id]||''} onChange={event=>setNotes({...notes,[row.id]:event.target.value})}/><button className="reject" disabled={busy===row.id} onClick={()=>review(row,'rejected')}><XCircle size={15}/>Refuser</button><button className="approve" disabled={busy===row.id} onClick={()=>review(row,'approved')}><CircleCheck size={15}/>Confirmer</button></article>)}</section>}

function manualStatus(status){return {pending:'À vérifier',approved:'Activé',rejected:'Refusé',cancelled:'Annulé'}[status]||status}
function formatMoney(amount,currency='XOF'){return new Intl.NumberFormat('fr-FR',{style:'currency',currency,maximumFractionDigits:currency==='XOF'?0:2}).format(Number(amount||0))}

function NotificationPreferences({ user, onSave }) {
  const [form, setForm] = useState(PREFERENCE_DEFAULTS)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (user) setForm(Object.fromEntries(Object.entries(PREFERENCE_DEFAULTS).map(([key,value]) => [key,user[key] ?? value]))) }, [user])
  const toggle = event => setForm({ ...form, [event.target.name]: event.target.checked })
  const submit = async event => { event.preventDefault(); try { await onSave(form); setSaved(true); setTimeout(() => setSaved(false), 1600) } catch {} }
  const choices = [
    ['notify_in_app','Dans Jalonis','Cloche, compteur et centre de notifications.'],
    ['notify_assignments','Affectations','Quand une tâche ou une story m’est attribuée.'],
    ['notify_status_changes','Changements de statut','Passage en cours, en revue, terminé ou bloqué.'],
    ['notify_comments','Messages et mentions','Nouveaux commentaires et mentions avec @.'],
    ['daily_digest','Résumé quotidien','Priorités, retards, réunions et risques du jour.'],
    ['notify_email','E-mail','Affectations, changements, mentions et résumé quotidien.'],
    ['notify_whatsapp','WhatsApp','Rappels de projet après consentement explicite.'],
  ]
  return <form className="card preference-card" onSubmit={submit}><div className="preference-head"><div className="workspace-mark"><BellRing size={22}/></div><div><h3>Mes notifications</h3><p>Choisissez les événements qui doivent attirer votre attention.</p></div><button className="btn primary">{saved?'Enregistré':'Enregistrer'}</button></div><div className="preference-grid">{choices.map(([key,title,description])=><label key={key}><input type="checkbox" name={key} checked={Boolean(Number(form[key]))} onChange={toggle}/><span><b>{title}</b><small>{description}</small></span></label>)}</div><div className={`whatsapp-consent${form.notify_whatsapp?' active':''}`}><MessageCircle size={18}/><div><b>Numéro WhatsApp</b><small>Format international, par exemple +225 07 00 00 00 00.</small></div><input type="tel" value={form.phone||''} onChange={event=>setForm({...form,phone:event.target.value})} placeholder="+225…" required={Boolean(form.notify_whatsapp)} pattern="[+0-9 ()-]{8,24}"/><p>{form.notify_whatsapp?'En enregistrant, vous acceptez de recevoir les rappels Jalonis sur ce numéro. Vous pourrez retirer ce consentement à tout moment.':'Activez WhatsApp ci-dessus pour donner votre consentement.'}</p></div><div className="quiet-hours"><Clock3 size={17}/><div><b>Heures silencieuses</b><small>Aucun rappel externe pendant cette période.</small></div><label>De<input type="time" value={form.quiet_start||'20:00'} onChange={event=>setForm({...form,quiet_start:event.target.value})}/></label><label>À<input type="time" value={form.quiet_end||'07:00'} onChange={event=>setForm({...form,quiet_end:event.target.value})}/></label></div></form>
}

export function InviteMemberForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ role: 'Membre', timezone: 'Africa/Abidjan', notify_email: true, notify_whatsapp: false })
  const change = event => setForm({ ...form, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })
  return <form onSubmit={event => { event.preventDefault(); onSubmit(form) }}>
    <div className="form-grid">
      <label className="span-2">Nom complet<input autoFocus required name="full_name" value={form.full_name || ''} onChange={change}/></label>
      <label>Adresse e-mail<input required type="email" name="email" value={form.email || ''} onChange={change}/></label>
      <label>Téléphone / WhatsApp<input type="tel" name="phone" value={form.phone || ''} onChange={change}/></label>
      <label>Rôle dans l’espace<select name="role" value={form.role} onChange={change}>{ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
      <label>Fonction<input name="job_title" value={form.job_title || ''} onChange={change} placeholder="Ex. Développeur, Analyste…"/></label>
      <label>Fuseau horaire<select name="timezone" value={form.timezone} onChange={change}><option>Africa/Abidjan</option><option>Europe/Paris</option><option>Africa/Dakar</option><option>Africa/Casablanca</option><option>America/Montreal</option></select></label>
      <label className="notification-choice"><input type="checkbox" name="notify_email" checked={form.notify_email} onChange={change}/><span><b>Rappels par e-mail</b><small>Préparer les notifications quotidiennes.</small></span></label>
      <label className="notification-choice"><input type="checkbox" name="notify_whatsapp" checked={form.notify_whatsapp} onChange={change}/><span><b>Rappels WhatsApp</b><small>Nécessitera le consentement du membre.</small></span></label>
    </div>
    <div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary"><Users size={16}/>Créer l’invitation</button></div>
  </form>
}

export function WorkspaceSwitcher({ items=[], currentId, onSelect, onCreate }) {
  return <div className="workspace-switcher-list">
    <div>{items.map(item=><button key={item.id} className={item.id===currentId?'active':''} onClick={()=>onSelect(item.id)}><span className="workspace-switcher-avatar">{item.name?.[0]?.toUpperCase()||'E'}</span><span><b>{item.name}</b><small>{item.account_type} · {item.role||'Membre'} · {item.project_count||0} projet{Number(item.project_count)!==1?'s':''}</small></span>{item.id===currentId&&<Check size={16}/>}</button>)}</div>
    {onCreate&&<button className="workspace-create-button" onClick={onCreate}><Building2 size={17}/><span><b>Créer une organisation</b><small>Un espace séparé avec ses membres, projets et abonnement.</small></span></button>}
  </div>
}

export function CreateWorkspaceForm({ onSubmit, onCancel, allowPersonal=false }) {
  const [form,setForm]=useState({name:'',account_type:'Organisation'})
  return <form onSubmit={event=>{event.preventDefault();onSubmit(form)}}><div className="form-grid"><label className="span-2">Nom de l’espace<input autoFocus required minLength="2" maxLength="80" value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Ex. GboroApp, Direction des projets…"/></label><label className="span-2">Type de compte<select value={form.account_type} onChange={event=>setForm({...form,account_type:event.target.value})}><option>Organisation</option>{allowPersonal&&<option>Personnel</option>}</select></label><div className="workspace-creation-note span-2"><ShieldCheck size={17}/><span><b>Données isolées</b><small>Les projets, membres, fichiers et la facturation de ce nouvel espace resteront séparés.</small></span></div></div><div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary"><Building2 size={16}/>Créer l’espace</button></div></form>
}

const initials = name => String(name || '?').split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase()
