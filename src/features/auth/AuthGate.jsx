import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Sparkles } from 'lucide-react'
import { cloudAuth, isCloudConfigured } from '../../services/supabase'
import '../../styles/auth.css'

const journey = [
  { step: '01', title: 'Cadrer' },
  { step: '02', title: 'Planifier' },
  { step: '03', title: 'Collaborer' },
  { step: '04', title: 'Piloter' },
  { step: '05', title: 'Livraison' },
]

export default function AuthGate({ children }) {
  const desktop = Boolean(window.jalonis)
  const [session, setSession] = useState(desktop ? { desktop: true } : null)
  const [checking, setChecking] = useState(!desktop && isCloudConfigured)
  const preview = new URLSearchParams(window.location.search).get('preview') === '1'
  const [authOpen, setAuthOpen] = useState(false)
  const [inviteSetup,setInviteSetup]=useState(()=>new URLSearchParams(window.location.search).get('invited')==='1')
  const [resetSetup,setResetSetup]=useState(()=>new URLSearchParams(window.location.search).get('reset')==='1')
  const openPreview = () => {
    const url=new URL(window.location.href)
    url.searchParams.set('preview','1')
    window.location.assign(url.toString())
  }

  useEffect(() => {
    if (desktop || !isCloudConfigured) return undefined
    cloudAuth.session().then(value => { setSession(value); setChecking(false) })
    const { data } = cloudAuth.onChange((value,event) => { setSession(value);if(event==='PASSWORD_RECOVERY')setResetSetup(true);setChecking(false) })
    return () => data.subscription.unsubscribe()
  }, [desktop])

  if(session&&inviteSetup)return <InvitationPasswordScreen onComplete={()=>{const url=new URL(window.location.href);url.searchParams.delete('invited');window.history.replaceState({},'',url);setInviteSetup(false)}}/>
  if(session&&resetSetup)return <ResetPasswordScreen onComplete={()=>{const url=new URL(window.location.href);url.searchParams.delete('reset');window.history.replaceState({},'',url);setResetSetup(false)}}/>
  if (desktop || session || preview) return children
  if (checking) return <div className="auth-loading"><Sparkles size={30}/><b>Ouverture de votre espace Jalonis…</b></div>
  if (authOpen) return <AuthScreen cloudReady={isCloudConfigured} onBack={() => setAuthOpen(false)} onPreview={openPreview}/>
  return <WelcomeScreen onConnect={() => setAuthOpen(true)} onPreview={openPreview}/>
}

function InvitationPasswordScreen({onComplete}){
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const submit=async event=>{event.preventDefault();setError('');if(password.length<8)return setError('Le mot de passe doit contenir au moins 8 caractères.');if(password!==confirmation)return setError('Les deux mots de passe ne correspondent pas.');try{setSaving(true);await cloudAuth.acceptInvitations();await cloudAuth.updatePassword(password);onComplete()}catch(reason){setError(reason.message||'Impossible de finaliser cette invitation.')}finally{setSaving(false)}}
  return <main className="invite-password-page"><section className="invite-password-card"><img src="./assets/jalonis-logo.png" alt="Logo Jalonis"/><span>INVITATION ACCEPTÉE</span><h1>Bienvenue dans votre équipe</h1><p>Choisissez votre mot de passe pour sécuriser votre compte et ouvrir l’espace auquel vous avez été invité.</p><form onSubmit={submit}><label>Nouveau mot de passe<input autoFocus required minLength="8" type="password" value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmer le mot de passe<input required minLength="8" type="password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>{error&&<p className="auth-error">{error}</p>}<button className="auth-submit" disabled={saving}><LockKeyhole size={16}/>{saving?'Sécurisation…':'Ouvrir mon espace'}</button></form></section></main>
}

function ResetPasswordScreen({onComplete}){
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const submit=async event=>{event.preventDefault();setError('');if(password.length<8)return setError('Le mot de passe doit contenir au moins 8 caractères.');if(password!==confirmation)return setError('Les deux mots de passe ne correspondent pas.');try{setSaving(true);await cloudAuth.updatePassword(password);onComplete()}catch(reason){setError(reason.message||'Impossible de modifier le mot de passe.')}finally{setSaving(false)}}
  return <main className="invite-password-page"><section className="invite-password-card"><img src="./assets/jalonis-logo.png" alt="Logo Jalonis"/><span>COMPTE SÉCURISÉ</span><h1>Nouveau mot de passe</h1><p>Choisissez un nouveau mot de passe pour retrouver vos espaces Jalonis.</p><form onSubmit={submit}><label>Nouveau mot de passe<input autoFocus required minLength="8" type="password" value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmer le mot de passe<input required minLength="8" type="password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>{error&&<p className="auth-error">{error}</p>}<button className="auth-submit" disabled={saving}><LockKeyhole size={16}/>{saving?'Enregistrement…':'Enregistrer le mot de passe'}</button></form></section></main>
}

function WelcomeScreen({ onConnect, onPreview }) {
  return <main className="welcome-page">
    <div className="welcome-aurora welcome-aurora-one"/>
    <div className="welcome-aurora welcome-aurora-two"/>
    <header className="welcome-header">
      <div className="welcome-brand"><img src="./assets/jalonis-logo.png" alt="Logo Jalonis"/><b>Jalonis</b></div>
      <button className="welcome-login-top" onClick={onConnect}>Se connecter <ArrowRight size={15}/></button>
    </header>

    <section className="welcome-hero">
      <div className="welcome-kicker"><span/><Sparkles size={14}/> Le projet, de l’idée à l’impact</div>
      <h1>Chaque étape avance.<br/><em>Tout reste lié.</em></h1>
      <p>Le poste de pilotage conçu pour réunir stratégie, exécution et collaboration — sans perdre le fil de votre projet.</p>
    </section>

    <section className="chain-stage" aria-label="Réaction en chaîne du cycle de projet">
      <img className="office-fresco" src="./assets/jalonis-office-fresco.png" alt=""/>
      <div className="chain-floor"/>
      {journey.map(({ step, title }, index) => <div className={`chain-box chain-box-${index + 1}`} key={title} style={{ '--relay': index }}>
        <span>{step}</span><b>{title}</b><i/>
      </div>)}
      <div className="chain-finish"><i/><span>Projet livré</span></div>
    </section>

    <section className="welcome-actions">
      <button className="welcome-primary" onClick={onConnect}>Se connecter à Jalonis <ArrowRight size={17}/></button>
      <button className="welcome-secondary" onClick={onPreview}>Parcourir l’interface en mode aperçu</button>
      <small>Le mode aperçu vous permet de découvrir Jalonis sans créer de compte.</small>
    </section>
  </main>
}

function AuthScreen({ cloudReady, onBack, onPreview }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ accountType: 'Personnel' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const change = event => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = async event => {
    event.preventDefault(); setError(''); setMessage('')
    if (!cloudReady) {
      setError('La connexion sécurisée est en cours d’activation. Utilisez le mode aperçu pour le moment.')
      return
    }
    try {
      if(mode==='forgot'){await cloudAuth.resetPassword(form.email);setMessage('Un lien sécurisé vient d’être envoyé à cette adresse.');return}
      if (mode === 'login') await cloudAuth.signIn(form.email, form.password)
      else {
        const result = await cloudAuth.signUp(form)
        if (!result.session) setMessage('Compte créé. Consultez votre e-mail pour confirmer votre inscription.')
      }
    } catch (reason) { setError(reason.message || 'Connexion impossible') }
  }
  const heading=mode==='login'?'Retrouvez votre espace':mode==='forgot'?'Réinitialiser votre accès':'Commencez avec Jalonis'
  const description=mode==='login'?'Connectez-vous pour reprendre vos projets.':mode==='forgot'?'Nous vous enverrons un lien sécurisé par e-mail.':'Créez votre espace de travail sécurisé.'
  return <main className="auth-page">
    <section className="auth-presentation"><img className="auth-conductor-fresco" src="./assets/jalonis-team-conductor.png" alt=""/><button className="auth-back" onClick={onBack}><ArrowLeft size={16}/> Accueil</button><img className="auth-logo" src="./assets/jalonis-logo.png" alt="Logo Jalonis"/><span>JALONIS CLOUD</span><h1>Une vision.<br/>Toute l’équipe en mouvement.</h1><p>Coordonnez les expertises, gardez le rythme et conduisez chaque projet jusqu’à sa livraison.</p><ul><li><CheckCircle2/>PMP, Scrum et fournisseurs</li><li><CheckCircle2/>Application web et Desktop</li><li><CheckCircle2/>Données isolées par organisation</li></ul></section>
    <section className="auth-panel"><div className="auth-card"><div className="auth-card-heading"><span>BIENVENUE</span><h2>{heading}</h2><p>{description}</p></div>{!cloudReady&&<div className="cloud-pending"><Sparkles size={16}/><span><b>Connexion bientôt disponible</b>La base sécurisée est en cours de configuration.</span></div>}
      {mode==='forgot'?<button className="auth-mode-back" onClick={()=>{setMode('login');setMessage('');setError('')}}><ArrowLeft size={14}/>Retour à la connexion</button>:<div className="auth-switch"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Connexion</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Créer un compte</button></div>}
      <form onSubmit={submit}>{mode==='signup'&&<><label>Nom complet<input required name="fullName" value={form.fullName||''} onChange={change}/></label><label>Type de compte<select name="accountType" value={form.accountType} onChange={change}><option>Personnel</option><option>Organisation</option></select></label>{form.accountType==='Organisation'&&<label>Nom de l’organisation<input required name="workspaceName" value={form.workspaceName||''} onChange={change}/></label>}</>}<label>Adresse e-mail<input required type="email" name="email" value={form.email||''} onChange={change}/></label>{mode!=='forgot'&&<label>Mot de passe<input required minLength="8" type="password" name="password" value={form.password||''} onChange={change}/></label>}{mode==='login'&&<button type="button" className="forgot-password" onClick={()=>{setMode('forgot');setError('');setMessage('')}}>Mot de passe oublié ?</button>}{error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-success">{message}</p>}<button className="auth-submit"><LockKeyhole size={16}/>{mode==='login'?'Se connecter':mode==='forgot'?'Envoyer le lien':'Créer mon espace'}</button></form>
      <div className="auth-preview-divider"><span>ou</span></div><button type="button" className="auth-preview-button" onClick={onPreview}>Continuer sans compte en mode aperçu</button>
    </div></section>
  </main>
}
