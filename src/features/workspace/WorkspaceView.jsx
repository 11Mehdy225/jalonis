import { useEffect, useState } from 'react'
import { BellRing, Building2, Clock3, Mail, MessageCircle, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'

const ROLES = ['Administrateur', 'Chef de projet', 'Scrum Master', 'Product Owner', 'Membre', 'Observateur', 'Fournisseur externe']
const PREFERENCE_DEFAULTS = { notify_in_app: true, notify_email: true, notify_whatsapp: false, notify_assignments: true, notify_status_changes: true, notify_comments: true, daily_digest: true, quiet_start: '20:00', quiet_end: '07:00' }

export default function WorkspaceView({ data, canManage=false, canInvite=false, onRename, onInvite, onRemove, onUpdateRole, onUpdatePreferences }) {
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

function NotificationPreferences({ user, onSave }) {
  const [form, setForm] = useState(PREFERENCE_DEFAULTS)
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (user) setForm(Object.fromEntries(Object.entries(PREFERENCE_DEFAULTS).map(([key,value]) => [key,user[key] ?? value]))) }, [user])
  const toggle = event => setForm({ ...form, [event.target.name]: event.target.checked })
  const submit = async event => { event.preventDefault(); await onSave(form); setSaved(true); setTimeout(() => setSaved(false), 1600) }
  const choices = [
    ['notify_in_app','Dans Jalonis','Cloche, compteur et centre de notifications.'],
    ['notify_assignments','Affectations','Quand une tâche ou une story m’est attribuée.'],
    ['notify_status_changes','Changements de statut','Passage en cours, en revue, terminé ou bloqué.'],
    ['notify_comments','Messages et mentions','Nouveaux commentaires et mentions avec @.'],
    ['daily_digest','Résumé quotidien','Priorités, retards, réunions et risques du jour.'],
    ['notify_email','E-mail','Prêt à être activé avec le service d’envoi.'],
    ['notify_whatsapp','WhatsApp','Prêt à être activé après consentement.'],
  ]
  return <form className="card preference-card" onSubmit={submit}><div className="preference-head"><div className="workspace-mark"><BellRing size={22}/></div><div><h3>Mes notifications</h3><p>Choisissez les événements qui doivent attirer votre attention.</p></div><button className="btn primary">{saved?'Enregistré':'Enregistrer'}</button></div><div className="preference-grid">{choices.map(([key,title,description])=><label key={key}><input type="checkbox" name={key} checked={Boolean(Number(form[key]))} onChange={toggle}/><span><b>{title}</b><small>{description}</small></span></label>)}</div><div className="quiet-hours"><Clock3 size={17}/><div><b>Heures silencieuses</b><small>Aucun rappel externe pendant cette période.</small></div><label>De<input type="time" value={form.quiet_start||'20:00'} onChange={event=>setForm({...form,quiet_start:event.target.value})}/></label><label>À<input type="time" value={form.quiet_end||'07:00'} onChange={event=>setForm({...form,quiet_end:event.target.value})}/></label></div></form>
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

const initials = name => String(name || '?').split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase()
