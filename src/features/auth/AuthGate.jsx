import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Cloud, HardDrive, LockKeyhole, Sparkles, ShieldCheck } from 'lucide-react'
import { cloudAuth, isCloudConfigured } from '../../services/supabase'
import '../../styles/auth.css'

const journey = [
  { step: '01', title: 'Cadrer' },
  { step: '02', title: 'Planifier' },
  { step: '03', title: 'Collaborer' },
  { step: '04', title: 'Piloter' },
  { step: '05', title: 'Livraison' },
]
const supportEmail=import.meta.env.VITE_SUPPORT_EMAIL||'contact@ronnagroup.net'
const siteUrl=(import.meta.env.VITE_SITE_URL||'https://jalonis.ronnagroup.net').replace(/\/$/,'')

export default function AuthGate({ children }) {
  const desktop = Boolean(window.jalonis)
  const desktopMode=desktop?localStorage.getItem('jalonis-desktop-mode'):null
  const localDesktop=desktop&&desktopMode==='local'
  const cloudDesktop=desktop&&desktopMode==='cloud'
  const [session, setSession] = useState(localDesktop ? { desktop: true } : null)
  const [checking, setChecking] = useState(!localDesktop && isCloudConfigured)
  const preview = new URLSearchParams(window.location.search).get('preview') === '1'
  const [authOpen, setAuthOpen] = useState(cloudDesktop)
  const [inviteSetup,setInviteSetup]=useState(()=>new URLSearchParams(window.location.search).get('invited')==='1')
  const [resetSetup,setResetSetup]=useState(()=>new URLSearchParams(window.location.search).get('reset')==='1')
  const [publicPage,setPublicPage]=useState(()=>new URLSearchParams(window.location.search).get('page')||'')
  const openPublicPage=page=>{const url=new URL(window.location.href);url.searchParams.set('page',page);window.history.pushState({},'',url);setPublicPage(page)}
  const closePublicPage=()=>{const url=new URL(window.location.href);url.searchParams.delete('page');window.history.pushState({},'',url);setPublicPage('')}
  const openPreview = () => {
    if(desktop){localStorage.setItem('jalonis-desktop-mode','local');window.location.reload();return}
    const url=new URL(window.location.href)
    url.searchParams.set('preview','1')
    window.location.assign(url.toString())
  }

  useEffect(() => {
    if (localDesktop || !isCloudConfigured) return undefined
    cloudAuth.session().then(value => { setSession(value); setChecking(false) })
    const { data } = cloudAuth.onChange((value,event) => { setSession(value);if(event==='PASSWORD_RECOVERY')setResetSetup(true);setChecking(false) })
    return () => data.subscription.unsubscribe()
  }, [localDesktop])

  if(desktop&&!desktopMode)return <DesktopModeScreen/>
  if(session&&inviteSetup)return <InvitationPasswordScreen onComplete={()=>{const url=new URL(window.location.href);url.searchParams.delete('invited');window.history.replaceState({},'',url);setInviteSetup(false)}}/>
  if(session&&resetSetup)return <ResetPasswordScreen onComplete={()=>{const url=new URL(window.location.href);url.searchParams.delete('reset');window.history.replaceState({},'',url);setResetSetup(false)}}/>
  if (localDesktop || session || preview) return children
  if (checking) return <div className="auth-loading"><Sparkles size={30}/><b>Ouverture de votre espace Jalonis…</b></div>
  if(publicPage)return <PublicPage page={publicPage} supportEmail={supportEmail} onBack={closePublicPage} onConnect={()=>{closePublicPage();setAuthOpen(true)}} onNavigate={openPublicPage}/>
  if (authOpen) return <AuthScreen cloudReady={isCloudConfigured} onBack={()=>{if(cloudDesktop){localStorage.removeItem('jalonis-desktop-mode');window.location.reload()}else setAuthOpen(false)}} onPreview={openPreview} desktop={cloudDesktop} onPublicPage={openPublicPage}/>
  return <WelcomeScreen onConnect={() => setAuthOpen(true)} onPreview={openPreview} onPublicPage={openPublicPage}/>
}

function DesktopModeScreen(){
  const choose=mode=>{localStorage.setItem('jalonis-desktop-mode',mode);window.location.reload()}
  return <main className="desktop-mode-page"><section className="desktop-mode-card"><img src="./assets/jalonis-logo.png" alt="Logo Jalonis"/><span>APPLICATION DESKTOP</span><h1>Comment souhaitez-vous travailler ?</h1><p>Vous pourrez changer de mode plus tard depuis les paramètres.</p><div className="desktop-mode-options"><button onClick={()=>choose('cloud')}><i><Cloud/></i><b>Jalonis Cloud</b><small>Retrouver les comptes, projets et équipes du site web sur Mac ou Windows.</small><em>Recommandé pour le travail en équipe</em></button><button onClick={()=>choose('local')}><i><HardDrive/></i><b>Stockage local</b><small>Conserver des projets uniquement sur cet ordinateur, sans compte ni connexion.</small><em>Disponible hors ligne</em></button></div></section></main>
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

function WelcomeScreen({ onConnect, onPreview, onPublicPage }) {
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
      <p className="welcome-publisher">Jalonis est conçu et édité par Ronna Group.</p>
      <nav className="welcome-footer-links"><button onClick={()=>onPublicPage('pricing')}>Tarifs</button><button onClick={()=>onPublicPage('terms')}>Conditions d’utilisation</button><button onClick={()=>onPublicPage('privacy')}>Confidentialité</button><button onClick={()=>onPublicPage('licenses')}>Droits & licences</button><button onClick={()=>onPublicPage('support')}>Support</button></nav>
    </section>
  </main>
}

function AuthScreen({ cloudReady, onBack, onPreview, desktop=false, onPublicPage }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ accountType: 'Personnel',termsAccepted:false })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const change = event => setForm({ ...form, [event.target.name]: event.target.type==='checkbox'?event.target.checked:event.target.value })
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
      <form onSubmit={submit}>{mode==='signup'&&<><label>Nom complet<input required name="fullName" value={form.fullName||''} onChange={change}/></label><label>Type de compte<select name="accountType" value={form.accountType} onChange={change}><option>Personnel</option><option>Organisation</option></select></label>{form.accountType==='Organisation'&&<label>Nom de l’organisation<input required name="workspaceName" value={form.workspaceName||''} onChange={change}/></label>}</>}<label>Adresse e-mail<input required type="email" name="email" value={form.email||''} onChange={change}/></label>{mode!=='forgot'&&<label>Mot de passe<input required minLength="8" type="password" name="password" value={form.password||''} onChange={change}/></label>}{mode==='signup'&&<label className="auth-terms"><input required type="checkbox" name="termsAccepted" checked={form.termsAccepted} onChange={change}/><span>J’accepte les <button type="button" onClick={()=>onPublicPage('terms')}>conditions d’utilisation</button> et la <button type="button" onClick={()=>onPublicPage('privacy')}>politique de confidentialité</button>.</span></label>}{mode==='login'&&<button type="button" className="forgot-password" onClick={()=>{setMode('forgot');setError('');setMessage('')}}>Mot de passe oublié ?</button>}{error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-success">{message}</p>}<button className="auth-submit"><LockKeyhole size={16}/>{mode==='login'?'Se connecter':mode==='forgot'?'Envoyer le lien':'Créer mon espace'}</button></form>
      <div className="auth-preview-divider"><span>ou</span></div><button type="button" className="auth-preview-button" onClick={onPreview}>{desktop?'Utiliser le stockage local sur cet ordinateur':'Continuer sans compte en mode aperçu'}</button>
    </div></section>
  </main>
}

function PublicPage({page,supportEmail,onBack,onConnect,onNavigate}){
  const pricing=[
    {name:'Découverte',price:'Gratuit',annual:'Sans limite de durée',details:'2 projets · 1 utilisateur · 250 Mo · Pilotage individuel'},
    {name:'Personnel Pro',price:'5 000 FCFA / mois',annual:'50 000 FCFA par an',details:'Projets illimités · Rappels e-mail · Exports · 2 Go'},
    {name:'Équipe',price:'6 000 FCFA / membre / mois',annual:'60 000 FCFA par membre et par an',details:'3 membres minimum · Collaboration temps réel · Audit · 10 Go'},
    {name:'Business',price:'9 000 FCFA / membre / mois',annual:'90 000 FCFA par membre et par an',details:'10 membres minimum · Automatisation · Assistant · 50 Go · Support prioritaire'},
    {name:'Entreprise',price:'Sur devis',annual:'Contrat et accompagnement personnalisés',details:'Hébergement dédié · SSO · Capacité et support sur mesure'},
  ]
  const title={pricing:'Tarifs Jalonis',terms:"Conditions générales d’utilisation",privacy:'Politique de confidentialité',licenses:'Droits et licences',support:'Support Jalonis'}[page]||'Jalonis'
  useEffect(()=>{
    const descriptions={pricing:'Découvrez les offres Jalonis en francs CFA pour piloter vos projets seul ou en équipe.',terms:"Conditions d’utilisation du logiciel de gestion de projets Jalonis.",privacy:'Politique de confidentialité et protection des données Jalonis.',licenses:'Droits, licences et propriété intellectuelle de Jalonis.',support:'Contactez le support Jalonis pour vos comptes, projets, paiements et équipes.'}
    const canonical=`${siteUrl}/?page=${encodeURIComponent(page)}`
    document.title=`${title} — Ronna Group`
    document.querySelector('meta[name="description"]')?.setAttribute('content',descriptions[page]||'Jalonis — plateforme de pilotage de projets.')
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',title)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content',canonical)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href',canonical)
    return ()=>{document.title='Jalonis — Pilotage de projets';document.querySelector('link[rel="canonical"]')?.setAttribute('href',`${siteUrl}/`)}
  },[page,title])
  return <main className="public-page"><header><button onClick={onBack}><ArrowLeft size={16}/>Accueil</button><div><img src="./assets/jalonis-logo.png" alt="Logo Jalonis"/><b>Jalonis</b></div><button className="public-connect" onClick={onConnect}>Se connecter</button></header><article><span>JALONIS · RONNA GROUP</span><h1>{title}</h1>{page==='pricing'?<><p className="public-lead">Commencez gratuitement, puis choisissez l’offre adaptée à votre équipe. Les offres annuelles comprennent deux mois gratuits. Les prix sont affichés en francs CFA.</p><div className="public-pricing">{pricing.map((offer,index)=><section key={offer.name} className={index===2?'featured':''}><i><ShieldCheck/></i>{index===2&&<em className="pricing-badge">RECOMMANDÉ</em>}<h2>{offer.name}</h2><strong>{offer.price}</strong><small>{offer.annual}</small><p>{offer.details}</p><button onClick={onConnect}>{index===0?'Commencer gratuitement':index===4?'Nous contacter':'Choisir cette offre'}</button></section>)}</div><p className="pricing-note">Les membres Observateur et Fournisseur externe ne consomment pas de siège payant. L’offre annuelle est réglée en une fois.</p></>:page==='terms'?<LegalTerms supportEmail={supportEmail}/>:page==='privacy'?<Privacy supportEmail={supportEmail}/>:page==='licenses'?<Licenses supportEmail={supportEmail}/>:<Support supportEmail={supportEmail}/>}</article><footer><strong>Jalonis est conçu et édité par Ronna Group.</strong><nav><button onClick={()=>onNavigate('terms')}>Conditions</button><button onClick={()=>onNavigate('privacy')}>Confidentialité</button><button onClick={()=>onNavigate('licenses')}>Droits & licences</button><button onClick={()=>window.location.href=`mailto:${supportEmail}`}>{supportEmail}</button></nav><small>© 2026 Ronna Group · Tous droits réservés.</small></footer></main>
}

function LegalTerms({supportEmail}){return <div className="legal-copy"><p>Les présentes conditions encadrent l’accès à Jalonis, service de gestion de projets conçu et édité par Ronna Group, disponible sur le web et sur ordinateur. La création d’un compte vaut acceptation de ces conditions.</p><h2>Compte et espace de travail</h2><p>L’utilisateur garantit l’exactitude de ses informations, protège ses identifiants et reste responsable des actions réalisées depuis son compte. Les administrateurs d’une organisation contrôlent les membres, rôles et projets de leur espace.</p><h2>Abonnement et paiement</h2><p>Les fonctionnalités et limites dépendent de l’offre choisie. Un abonnement n’est activé qu’après confirmation du paiement. Une période promotionnelle commence lors de la première validation du code par l’espace et prend fin à la date affichée. À son échéance, un abonnement est proposé et les données restent consultables. Jalonis peut suspendre un accès en cas d’impayé, de fraude ou d’usage abusif, sans supprimer immédiatement les données.</p><h2>Utilisation acceptable</h2><p>Il est interdit de contourner les contrôles d’accès, perturber le service, importer un contenu illégal ou porter atteinte aux droits de tiers. Chaque client reste responsable des données et documents qu’il dépose.</p><h2>Disponibilité et responsabilité</h2><p>Ronna Group met en œuvre des moyens raisonnables pour assurer la continuité et la sécurité de Jalonis. Des maintenances ou incidents peuvent toutefois interrompre temporairement l’accès. Pour toute question : {supportEmail}.</p></div>}
function Privacy({supportEmail}){return <div className="legal-copy"><p>Ronna Group édite Jalonis et traite uniquement les données nécessaires à l’authentification, à la gestion des espaces, à la collaboration, au support et à la facturation.</p><h2>Données traitées</h2><p>Identité professionnelle, adresse e-mail, téléphone facultatif, rôles, projets, tâches, messages, fichiers, préférences de notification et historique des opérations. Les mots de passe sont gérés par l’infrastructure d’authentification sécurisée et ne sont jamais lisibles par Jalonis.</p><h2>Finalités et conservation</h2><p>Les données servent à fournir le service, sécuriser les accès, notifier les membres et gérer les abonnements. Elles sont conservées pendant la durée du compte, puis supprimées ou anonymisées selon les obligations applicables et les sauvegardes techniques.</p><h2>Partage et sécurité</h2><p>Les données ne sont pas vendues. Elles peuvent être confiées aux sous-traitants indispensables à l’hébergement, à l’envoi d’e-mails et au paiement. Les espaces sont isolés par des règles d’accès en base de données.</p><h2>Vos droits</h2><p>Vous pouvez demander l’accès, la rectification, l’export ou la suppression de vos données en écrivant à {supportEmail}. Une vérification d’identité peut être demandée.</p></div>}
function Licenses({supportEmail}){return <div className="legal-copy"><p>Jalonis, son code, son identité visuelle, ses interfaces, sa documentation et ses exécutables sont conçus et édités par Ronna Group.</p><h2>Propriété intellectuelle</h2><p>© 2026 Ronna Group. Tous droits réservés. Aucun droit de propriété sur Jalonis n’est transféré lors de la création d’un compte, d’un abonnement ou de la remise d’une version de test.</p><h2>Licence d’utilisation</h2><p>L’utilisateur reçoit un droit personnel, limité, non exclusif et non transférable d’utiliser Jalonis pendant la durée de son accès. Toute copie, modification, extraction, redistribution, revente ou mise à disposition non autorisée est interdite, sous réserve des droits accordés par les licences des composants tiers.</p><h2>Composants tiers</h2><p>Jalonis utilise des bibliothèques et services tiers qui restent soumis à leurs licences et conditions respectives. Ces droits n’accordent aucune licence sur la marque, le logo ou les éléments propriétaires de Jalonis.</p><h2>Autorisation</h2><p>Pour toute demande de reproduction, partenariat ou licence particulière, écrivez à {supportEmail}.</p></div>}
function Support({supportEmail}){return <div className="legal-copy support-copy"><p>Une question sur votre compte, une invitation, une facture ou un projet ? L’équipe Jalonis vous accompagne.</p><h2>Contacter le support</h2><a className="support-email" href={`mailto:${supportEmail}`}>{supportEmail}</a><p>Indiquez le nom de votre espace, le navigateur ou système utilisé et, si possible, une capture d’écran. N’envoyez jamais votre mot de passe ni une clé privée.</p><h2>Priorités</h2><p>Les incidents bloquants et les problèmes d’accès sont traités en priorité. Les demandes fonctionnelles sont analysées dans le cadre de l’évolution du produit.</p></div>}
