import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Cloud, HardDrive, LockKeyhole, Sparkles, ShieldCheck } from 'lucide-react'
import { cloudAuth, isCloudConfigured } from '../../services/supabase'
import { LEGAL_VERSION, LegalNotice, LegalTerms, Licenses, Privacy, SalesTerms, Support } from './legalContent'
import '../../styles/auth.css'

const journey = [
  { step: '01', title: 'Cadrer' },
  { step: '02', title: 'Planifier' },
  { step: '03', title: 'Collaborer' },
  { step: '04', title: 'Piloter' },
  { step: '05', title: 'Livraison' },
]
const supportEmail=import.meta.env.VITE_SUPPORT_EMAIL||'contact@ronnagroup.net'
const siteUrl=(import.meta.env.VITE_SITE_URL||'https://kavelyo.ronnagroup.net').replace(/\/$/,'')
const defaultSeo={
  title:'Kavelyo | Logiciel de gestion de projet hybride, Agile et PMP',
  description:'Kavelyo est le logiciel SaaS de gestion de projet hybride pour planifier, collaborer et piloter équipes, sprints, budgets, risques et fournisseurs.',
}
const setMeta=(selector,value)=>document.querySelector(selector)?.setAttribute('content',value)

export default function AuthGate({ children }) {
  const desktop = Boolean(window.kavelyo)
  const desktopMode=desktop?(localStorage.getItem('kavelyo-desktop-mode')||localStorage.getItem('jalonis-desktop-mode')):null
  if(desktopMode&&!localStorage.getItem('kavelyo-desktop-mode'))localStorage.setItem('kavelyo-desktop-mode',desktopMode)
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
    if(desktop){localStorage.setItem('kavelyo-desktop-mode','local');window.location.reload();return}
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

  useEffect(()=>{
    const parameters=new URLSearchParams(window.location.search)
    const technical=['preview','reset','invited'].some(name=>parameters.has(name))
    setMeta('meta[name="robots"]',technical?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')
  },[preview,inviteSetup,resetSetup])

  if(desktop&&!desktopMode)return <DesktopModeScreen/>
  if(session&&inviteSetup)return <InvitationPasswordScreen onComplete={()=>{const url=new URL(window.location.href);url.searchParams.delete('invited');window.history.replaceState({},'',url);setInviteSetup(false)}}/>
  if(session&&resetSetup)return <ResetPasswordScreen onComplete={()=>{const url=new URL(window.location.href);url.searchParams.delete('reset');window.history.replaceState({},'',url);setResetSetup(false)}}/>
  if (localDesktop || session || preview) return children
  if (checking) return <div className="auth-loading"><Sparkles size={30}/><b>Ouverture de votre espace Kavelyo…</b></div>
  if(publicPage)return <PublicPage page={publicPage} supportEmail={supportEmail} onBack={closePublicPage} onConnect={()=>{closePublicPage();setAuthOpen(true)}} onNavigate={openPublicPage}/>
  if (authOpen) return <AuthScreen cloudReady={isCloudConfigured} onBack={()=>{if(cloudDesktop){localStorage.removeItem('kavelyo-desktop-mode');window.location.reload()}else setAuthOpen(false)}} onPreview={openPreview} desktop={cloudDesktop} onPublicPage={openPublicPage}/>
  return <WelcomeScreen onConnect={() => setAuthOpen(true)} onPreview={openPreview} onPublicPage={openPublicPage}/>
}

function DesktopModeScreen(){
  const choose=mode=>{localStorage.setItem('kavelyo-desktop-mode',mode);window.location.reload()}
  return <main className="desktop-mode-page"><section className="desktop-mode-card"><img src="./assets/kavelyo-logo.png" alt="Logo Kavelyo"/><span>APPLICATION DESKTOP</span><h1>Comment souhaitez-vous travailler ?</h1><p>Vous pourrez changer de mode plus tard depuis les paramètres.</p><div className="desktop-mode-options"><button onClick={()=>choose('cloud')}><i><Cloud/></i><b>Kavelyo Cloud</b><small>Retrouver les comptes, projets et équipes du site web sur Mac ou Windows.</small><em>Recommandé pour le travail en équipe</em></button><button onClick={()=>choose('local')}><i><HardDrive/></i><b>Stockage local</b><small>Conserver des projets uniquement sur cet ordinateur, sans compte ni connexion.</small><em>Disponible hors ligne</em></button></div></section></main>
}

function InvitationPasswordScreen({onComplete}){
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[legalAccepted,setLegalAccepted]=useState(false),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const submit=async event=>{event.preventDefault();setError('');if(password.length<8)return setError('Le mot de passe doit contenir au moins 8 caractères.');if(password!==confirmation)return setError('Les deux mots de passe ne correspondent pas.');if(!legalAccepted)return setError('Vous devez accepter les conditions et la politique de confidentialité.');try{setSaving(true);await cloudAuth.acceptLegalDocuments(LEGAL_VERSION);await cloudAuth.acceptInvitations();await cloudAuth.updatePassword(password);onComplete()}catch(reason){setError(reason.message||'Impossible de finaliser cette invitation.')}finally{setSaving(false)}}
  return <main className="invite-password-page"><section className="invite-password-card"><img src="./assets/kavelyo-logo.png" alt="Logo Kavelyo"/><span>INVITATION ACCEPTÉE</span><h1>Bienvenue dans votre équipe</h1><p>Choisissez votre mot de passe pour sécuriser votre compte et ouvrir l’espace auquel vous avez été invité.</p><form onSubmit={submit}><label>Nouveau mot de passe<input autoFocus required minLength="8" type="password" value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmer le mot de passe<input required minLength="8" type="password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label><label className="auth-terms"><input required type="checkbox" checked={legalAccepted} onChange={event=>setLegalAccepted(event.target.checked)}/><span>J’accepte les conditions d’utilisation, les conditions de vente et la politique de confidentialité de Kavelyo.</span></label>{error&&<p className="auth-error">{error}</p>}<button className="auth-submit" disabled={saving}><LockKeyhole size={16}/>{saving?'Sécurisation…':'Ouvrir mon espace'}</button></form></section></main>
}

function ResetPasswordScreen({onComplete}){
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const submit=async event=>{event.preventDefault();setError('');if(password.length<8)return setError('Le mot de passe doit contenir au moins 8 caractères.');if(password!==confirmation)return setError('Les deux mots de passe ne correspondent pas.');try{setSaving(true);await cloudAuth.updatePassword(password);onComplete()}catch(reason){setError(reason.message||'Impossible de modifier le mot de passe.')}finally{setSaving(false)}}
  return <main className="invite-password-page"><section className="invite-password-card"><img src="./assets/kavelyo-logo.png" alt="Logo Kavelyo"/><span>COMPTE SÉCURISÉ</span><h1>Nouveau mot de passe</h1><p>Choisissez un nouveau mot de passe pour retrouver vos espaces Kavelyo.</p><form onSubmit={submit}><label>Nouveau mot de passe<input autoFocus required minLength="8" type="password" value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmer le mot de passe<input required minLength="8" type="password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>{error&&<p className="auth-error">{error}</p>}<button className="auth-submit" disabled={saving}><LockKeyhole size={16}/>{saving?'Enregistrement…':'Enregistrer le mot de passe'}</button></form></section></main>
}

function WelcomeScreen({ onConnect, onPreview, onPublicPage }) {
  return <main className="welcome-page">
    <div className="welcome-intro">
      <div className="welcome-aurora welcome-aurora-one"/>
      <div className="welcome-aurora welcome-aurora-two"/>
      <header className="welcome-header">
        <div className="welcome-brand"><img src="./assets/kavelyo-logo.png" alt="Logo Kavelyo"/><b>Kavelyo</b></div>
        <nav className="welcome-main-nav" aria-label="Navigation principale"><a href="#fonctionnalites">Fonctionnalités</a><details className="welcome-market-menu"><summary>Marchés</summary><div><a href="/fr/afrique/">Afrique francophone</a><a href="/fr/europe/">Europe francophone</a><a href="/en/" lang="en">International · English</a></div></details><button onClick={()=>onPublicPage('pricing')}>Tarifs</button></nav>
        <button className="welcome-login-top" onClick={onConnect}>Se connecter <ArrowRight size={15}/></button>
      </header>

      <section className="welcome-hero">
        <div className="welcome-kicker"><span/><Sparkles size={14}/> Du plan à l’impact</div>
        <h1>Le logiciel de gestion de projet<br/><em>qui relie chaque étape.</em></h1>
        <p>Planifiez, collaborez et pilotez vos projets prédictifs, Agile et Scrum. Conçu en Côte d’Ivoire par Ronna Group, Kavelyo réunit équipes, tâches, sprints, budgets, risques, fournisseurs et décisions dans un espace sécurisé.</p>
      </section>

      <section className="chain-stage" aria-label="Réaction en chaîne du cycle de projet">
        <img className="office-fresco" src="./assets/kavelyo-office-fresco.png" alt=""/>
        <div className="chain-floor"/>
        {journey.map(({ step, title }, index) => <div className={`chain-box chain-box-${index + 1}`} key={title} style={{ '--relay': index }}>
          <span>{step}</span><b>{title}</b><i/>
        </div>)}
        <div className="chain-finish"><i/><span>Projet livré</span></div>
      </section>

      <section className="welcome-actions">
        <button className="welcome-primary" onClick={onConnect}>Commencer avec Kavelyo <ArrowRight size={17}/></button>
        <button className="welcome-secondary" onClick={onPreview}>Parcourir l’interface en mode aperçu</button>
        <small>Découvrez Kavelyo sans créer de compte.</small>
        <nav className="welcome-mobile-markets" aria-label="Marchés Kavelyo"><a href="/fr/afrique/">Afrique</a><a href="/fr/europe/">Europe</a><a href="/en/" lang="en">English</a></nav>
      </section>
    </div>

    <section className="welcome-seo" id="fonctionnalites">
      <div className="welcome-seo-heading"><span>LOGICIEL DE GESTION DE PROJET À ABIDJAN</span><h2>Pilotez les projets simples comme les plus exigeants</h2><p>Kavelyo est une solution de gestion de projet conçue en Côte d’Ivoire pour les équipes d’Abidjan, du pays et de toute l’Afrique francophone. Elle associe la souplesse d’un outil collaboratif à la rigueur des méthodes professionnelles.</p></div>
      <div className="welcome-feature-grid">
        <article><b>Planification et exécution</b><p>Structurez les jalons, tâches, dépendances, calendriers, charges et livrables. Suivez l’avancement dans des vues adaptées au travail quotidien.</p></article>
        <article><b>Agile, Scrum et Kanban</b><p>Gérez le backlog produit, les sprints, les user stories, le Daily Scrum, le refinement, la Sprint Review et la rétrospective.</p></article>
        <article><b>Budget, risques et décisions</b><p>Contrôlez les coûts, engagements, risques, arbitrages et indicateurs pour décider avec une vision consolidée du projet.</p></article>
        <article><b>Équipes et collaboration</b><p>Invitez chaque membre avec son propre compte, attribuez des rôles et limitez l’accès aux projets autorisés sans partager les mots de passe.</p></article>
        <article><b>Fournisseurs et achats</b><p>Reliez consultations, contrats, paiements, évaluations et livrables fournisseurs à la trajectoire réelle du projet.</p></article>
        <article><b>Chaîne d’impact Kavelyo</b><p>Reliez planning, équipe, coûts, risques et fournisseurs afin d’identifier les conséquences d’un retard avant qu’il ne devienne critique.</p></article>
      </div>
      <div className="welcome-methods"><div><span>HYBRIDE PAR CONCEPTION</span><h2>Prédictif, Agile ou mixte : la méthode s’adapte au projet</h2><p>Utilisez une approche PMP classique, un cadre Scrum, un tableau Kanban ou combinez-les dans le même portefeuille. Kavelyo convient aux consultants, PME, équipes internes et organisations qui pilotent plusieurs projets en parallèle.</p></div><button className="welcome-primary" onClick={onPreview}>Voir l’application en aperçu <ArrowRight size={17}/></button></div>
      <div className="welcome-faq"><h2>Questions fréquentes</h2><details><summary>À quoi sert un logiciel de gestion de projet ?</summary><p>Il centralise la planification, les responsabilités, les échéances, les documents, les budgets, les risques et les échanges afin que l’équipe travaille avec une information commune et à jour.</p></details><details><summary>Kavelyo permet-il de travailler en équipe ?</summary><p>Oui. Chaque collaborateur possède son propre compte et ses propres droits. Le responsable peut donner accès à un ou plusieurs projets sans communiquer son mot de passe.</p></details><details><summary>Peut-on gérer des projets Agile et Scrum ?</summary><p>Oui. Kavelyo prend en charge le backlog, les sprints, les user stories, le Kanban et les événements Scrum, tout en permettant de les combiner avec une planification prédictive.</p></details><details><summary>Kavelyo convient-il aux entreprises en Côte d’Ivoire et en Afrique francophone ?</summary><p>Oui. La plateforme est en français, ses offres sont en francs CFA et elle est conçue par Ronna Group pour servir aussi bien les professionnels indépendants que les équipes et organisations.</p></details></div>
      <div className="welcome-seo-cta"><span>PRÊT À PILOTER AUTREMENT ?</span><h2>Créez votre espace de gestion de projet</h2><div><button className="welcome-primary" onClick={onConnect}>Commencer maintenant <ArrowRight size={17}/></button><button className="welcome-secondary" onClick={()=>onPublicPage('pricing')}>Consulter les tarifs</button></div></div>
      <footer className="welcome-seo-footer"><p className="welcome-publisher">Kavelyo est conçu et édité par Ronna Group.</p><nav className="welcome-footer-markets" aria-label="Kavelyo dans le monde"><a href="/fr/afrique/">Afrique francophone</a><a href="/fr/europe/">Europe francophone</a><a href="/en/" lang="en">International · English</a></nav><nav className="welcome-footer-links"><button onClick={()=>onPublicPage('pricing')}>Tarifs</button><button onClick={()=>onPublicPage('legal')}>Mentions légales</button><button onClick={()=>onPublicPage('terms')}>Conditions d’utilisation</button><button onClick={()=>onPublicPage('sales')}>Vente & abonnements</button><button onClick={()=>onPublicPage('privacy')}>Confidentialité</button><button onClick={()=>onPublicPage('licenses')}>Droits & licences</button><button onClick={()=>onPublicPage('support')}>Support</button></nav><small>© 2026 Ronna Group · Tous droits réservés.</small></footer>
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
  const heading=mode==='login'?'Retrouvez votre espace':mode==='forgot'?'Réinitialiser votre accès':'Commencez avec Kavelyo'
  const description=mode==='login'?'Connectez-vous pour reprendre vos projets.':mode==='forgot'?'Nous vous enverrons un lien sécurisé par e-mail.':'Créez votre espace de travail sécurisé.'
  return <main className="auth-page">
    <section className="auth-presentation"><img className="auth-conductor-fresco" src="./assets/kavelyo-team-conductor.png" alt=""/><button className="auth-back" onClick={onBack}><ArrowLeft size={16}/> Accueil</button><img className="auth-logo" src="./assets/kavelyo-logo.png" alt="Logo Kavelyo"/><span>KAVELYO CLOUD</span><h1>Une vision.<br/>Toute l’équipe en mouvement.</h1><p>Coordonnez les expertises, gardez le rythme et conduisez chaque projet jusqu’à sa livraison.</p><ul><li><CheckCircle2/>PMP, Scrum et fournisseurs</li><li><CheckCircle2/>Application web et Desktop</li><li><CheckCircle2/>Données isolées par organisation</li></ul></section>
    <section className="auth-panel"><div className="auth-card"><div className="auth-card-heading"><span>BIENVENUE</span><h2>{heading}</h2><p>{description}</p></div>{!cloudReady&&<div className="cloud-pending"><Sparkles size={16}/><span><b>Connexion bientôt disponible</b>La base sécurisée est en cours de configuration.</span></div>}
      {mode==='forgot'?<button className="auth-mode-back" onClick={()=>{setMode('login');setMessage('');setError('')}}><ArrowLeft size={14}/>Retour à la connexion</button>:<div className="auth-switch"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Connexion</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Créer un compte</button></div>}
      <form onSubmit={submit}>{mode==='signup'&&<><label>Nom complet<input required name="fullName" value={form.fullName||''} onChange={change}/></label><label>Type de compte<select name="accountType" value={form.accountType} onChange={change}><option>Personnel</option><option>Organisation</option></select></label>{form.accountType==='Organisation'&&<label>Nom de l’organisation<input required name="workspaceName" value={form.workspaceName||''} onChange={change}/></label>}</>}<label>Adresse e-mail<input required type="email" name="email" value={form.email||''} onChange={change}/></label>{mode!=='forgot'&&<label>Mot de passe<input required minLength="8" type="password" name="password" value={form.password||''} onChange={change}/></label>}{mode==='signup'&&<label className="auth-terms"><input required type="checkbox" name="termsAccepted" checked={form.termsAccepted} onChange={change}/><span>J’accepte les <button type="button" onClick={()=>onPublicPage('terms')}>conditions d’utilisation</button>, les <button type="button" onClick={()=>onPublicPage('sales')}>conditions de vente et d’abonnement</button> et la <button type="button" onClick={()=>onPublicPage('privacy')}>politique de confidentialité</button> (version {LEGAL_VERSION}).</span></label>}{mode==='login'&&<button type="button" className="forgot-password" onClick={()=>{setMode('forgot');setError('');setMessage('')}}>Mot de passe oublié ?</button>}{error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-success">{message}</p>}<button className="auth-submit"><LockKeyhole size={16}/>{mode==='login'?'Se connecter':mode==='forgot'?'Envoyer le lien':'Créer mon espace'}</button></form>
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
  const title={pricing:'Tarifs Kavelyo',legal:'Mentions légales',terms:"Conditions générales d’utilisation",sales:'Conditions de vente et d’abonnement',privacy:'Politique de confidentialité',licenses:'Droits et licences',support:'Support Kavelyo'}[page]||'Kavelyo'
  useEffect(()=>{
    const descriptions={pricing:'Découvrez les offres Kavelyo en francs CFA pour piloter vos projets seul ou en équipe.',legal:'Mentions légales de Kavelyo, logiciel édité par Ronna Group SARLU.',terms:"Conditions d’utilisation du logiciel de gestion de projets Kavelyo.",sales:'Conditions de vente, paiement, renouvellement et résiliation des abonnements Kavelyo.',privacy:'Politique de confidentialité et protection des données Kavelyo.',licenses:'Droits, licences et propriété intellectuelle de Kavelyo.',support:'Contactez le support Kavelyo pour vos comptes, projets, paiements et équipes.'}
    const canonical=`${siteUrl}/?page=${encodeURIComponent(page)}`
    document.title=`${title} — Ronna Group`
    const description=descriptions[page]||defaultSeo.description
    setMeta('meta[name="description"]',description)
    setMeta('meta[property="og:title"]',title)
    setMeta('meta[property="og:description"]',description)
    setMeta('meta[property="og:url"]',canonical)
    setMeta('meta[name="twitter:title"]',title)
    setMeta('meta[name="twitter:description"]',description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href',canonical)
    return ()=>{document.title=defaultSeo.title;setMeta('meta[name="description"]',defaultSeo.description);setMeta('meta[property="og:title"]','Kavelyo | Logiciel de gestion de projet hybride');setMeta('meta[property="og:description"]','Planifiez, collaborez et pilotez vos projets prédictifs, Agile et Scrum dans un espace unique conçu par Ronna Group.');setMeta('meta[property="og:url"]',`${siteUrl}/`);setMeta('meta[name="twitter:title"]','Kavelyo | Logiciel de gestion de projet hybride');setMeta('meta[name="twitter:description"]','Planifiez, collaborez et pilotez projets, équipes, sprints, budgets, risques et fournisseurs avec Kavelyo.');document.querySelector('link[rel="canonical"]')?.setAttribute('href',`${siteUrl}/`)}
  },[page,title])
  return <main className="public-page"><header><button onClick={onBack}><ArrowLeft size={16}/>Accueil</button><div><img src="./assets/kavelyo-logo.png" alt="Logo Kavelyo"/><b>Kavelyo</b></div><button className="public-connect" onClick={onConnect}>Se connecter</button></header><article><span>KAVELYO · RONNA GROUP</span><h1>{title}</h1>{page==='pricing'?<><p className="public-lead">Commencez gratuitement, puis choisissez l’offre adaptée à votre équipe. Les offres annuelles comprennent deux mois gratuits. Les prix sont affichés en francs CFA.</p><div className="public-pricing">{pricing.map((offer,index)=><section key={offer.name} className={index===2?'featured':''}><i><ShieldCheck/></i>{index===2&&<em className="pricing-badge">RECOMMANDÉ</em>}<h2>{offer.name}</h2><strong>{offer.price}</strong><small>{offer.annual}</small><p>{offer.details}</p><button onClick={onConnect}>{index===0?'Commencer gratuitement':index===4?'Nous contacter':'Choisir cette offre'}</button></section>)}</div><p className="pricing-note">Les membres Observateur et Fournisseur externe ne consomment pas de siège payant. L’offre annuelle est réglée en une fois.</p></>:page==='legal'?<LegalNotice supportEmail={supportEmail}/>:page==='terms'?<LegalTerms supportEmail={supportEmail}/>:page==='sales'?<SalesTerms supportEmail={supportEmail}/>:page==='privacy'?<Privacy supportEmail={supportEmail}/>:page==='licenses'?<Licenses supportEmail={supportEmail}/>:<Support supportEmail={supportEmail}/>}</article><footer><strong>Kavelyo est conçu et édité par Ronna Group.</strong><nav><button onClick={()=>onNavigate('legal')}>Mentions légales</button><button onClick={()=>onNavigate('terms')}>Conditions</button><button onClick={()=>onNavigate('sales')}>Vente & abonnements</button><button onClick={()=>onNavigate('privacy')}>Confidentialité</button><button onClick={()=>onNavigate('licenses')}>Droits & licences</button><button onClick={()=>window.location.href=`mailto:${supportEmail}`}>{supportEmail}</button></nav><small>© 2026 Ronna Group · Tous droits réservés.</small></footer></main>
}
