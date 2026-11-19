import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, Cloud, LockKeyhole, UserRound } from 'lucide-react'
import { cloudAuth, isCloudConfigured } from '../../services/supabase'
import '../../styles/auth.css'

export default function AuthGate({ children }) {
  const desktop = Boolean(window.jalonis)
  const [session, setSession] = useState(desktop ? { desktop: true } : null)
  const [checking, setChecking] = useState(!desktop && isCloudConfigured)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    if (desktop || !isCloudConfigured) return undefined
    cloudAuth.session().then(value => { setSession(value); setChecking(false) })
    const { data } = cloudAuth.onChange(value => { setSession(value); setChecking(false) })
    return () => data.subscription.unsubscribe()
  }, [desktop])
  if (desktop || session || preview) return children
  if (checking) return <div className="auth-loading"><Cloud size={30}/><b>Connexion à Jalonis…</b></div>
  if (!isCloudConfigured) return <SetupScreen onPreview={() => setPreview(true)}/>
  return <AuthScreen/>
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ accountType: 'Personnel' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const change = event => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = async event => {
    event.preventDefault(); setError(''); setMessage('')
    try {
      if (mode === 'login') await cloudAuth.signIn(form.email, form.password)
      else {
        const result = await cloudAuth.signUp(form)
        if (!result.session) setMessage('Compte créé. Consultez votre e-mail pour confirmer votre inscription.')
      }
    } catch (reason) { setError(reason.message || 'Connexion impossible') }
  }
  return <main className="auth-page"><section className="auth-presentation"><img src="./assets/jalonis-logo.png"/><span>JALONIS CLOUD</span><h1>Du pilotage de projet au travail d’équipe.</h1><p>Planifiez, collaborez et sécurisez les données de votre organisation dans un espace unique.</p><ul><li><CheckCircle2/>PMP, Scrum et fournisseurs</li><li><CheckCircle2/>Application web et Desktop</li><li><CheckCircle2/>Données isolées par organisation</li></ul></section><section className="auth-panel"><div className="auth-card"><div className="auth-switch"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Connexion</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Créer un compte</button></div><form onSubmit={submit}>{mode==='signup'&&<><label>Nom complet<input required name="fullName" value={form.fullName||''} onChange={change}/></label><label>Type de compte<select name="accountType" value={form.accountType} onChange={change}><option>Personnel</option><option>Organisation</option></select></label>{form.accountType==='Organisation'&&<label>Nom de l’organisation<input required name="workspaceName" value={form.workspaceName||''} onChange={change}/></label>}</>}<label>Adresse e-mail<input required type="email" name="email" value={form.email||''} onChange={change}/></label><label>Mot de passe<input required minLength="8" type="password" name="password" value={form.password||''} onChange={change}/></label>{error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-success">{message}</p>}<button className="auth-submit"><LockKeyhole size={16}/>{mode==='login'?'Se connecter':'Créer mon espace'}</button></form></div></section></main>
}

function SetupScreen({ onPreview }) {
  return <main className="setup-page"><div className="setup-card"><img src="./assets/jalonis-logo.png"/><h1>Jalonis Web est prêt</h1><p>Reliez votre projet Supabase pour activer les comptes, organisations et données sécurisées.</p><div><span><UserRound/>Authentification</span><span><Building2/>Organisations</span><span><Cloud/>PostgreSQL et fichiers</span></div><button onClick={onPreview}>Parcourir l’interface en mode aperçu</button><small>Le mode aperçu conserve les données uniquement pendant cette session.</small></div></main>
}
