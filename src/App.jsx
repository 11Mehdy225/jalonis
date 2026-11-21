import { useEffect, useMemo, useState } from 'react'
import { api } from './services/api'
import Modal from './shared/Modal'
import ProjectForm from './features/projects/ProjectForm'
import EntityForm, { configs } from './features/projects/EntityForm'
import GanttView from './features/planning/GanttView'
import ScrumView from './features/agile/ScrumView'
import SupplierManagement from './features/procurement/SupplierManagement'
import WorkspaceView, { InviteMemberForm } from './features/workspace/WorkspaceView'
import ActivityView from './features/collaboration/ActivityView'
import NotificationCenter from './features/collaboration/NotificationCenter'
import DailyBrief from './features/collaboration/DailyBrief'
import EntityDiscussion from './features/collaboration/EntityDiscussion'
import WorkItemDetails from './features/projects/WorkItemDetails'
import './styles/workspace.css'
import { cloudAuth, isCloudConfigured } from './services/supabase'
import { LayoutDashboard, FolderKanban, FileText, CalendarRange, CalendarDays, List, Columns3, Users, ShieldAlert, MessageSquareText, Settings, Plus, Search, Bell, ChevronRight, ChevronLeft, CircleDollarSign, Clock3, Target, HardDrive, MoreHorizontal, Trash2, ArrowUpRight, Database, CheckCircle2, Truck, Building2, Share2, Moon, Sun, ChartNoAxesGantt, ClipboardList, ImagePlus, Palette } from 'lucide-react'

const money = n => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0)
const date = value => value ? new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) : '—'

const NAV = [
  ['dashboard','Vue d’ensemble',LayoutDashboard],['charter','Charte du projet',FileText],['tasks','Planning',CalendarRange],['scrum','Agile & Sprints',Columns3],
  ['team','Équipe',Users],['suppliers','Fournisseurs & Achats',Truck],['risks','Risques',ShieldAlert],['meetings','Réunions',MessageSquareText],
]

const ENTITY_TYPES=['tasks','risks','team','meetings','sprints','backlog_items','attachments','suppliers','procurements','supplier_quotes','supplier_contracts','supplier_evaluations','supplier_documents','comments','activities','notifications','checklist_items']
const ENTITY_LABELS={tasks:'Tâche',risks:'Risque',team:'Membre',meetings:'Réunion',sprints:'Sprint',backlog_items:'Élément du backlog',suppliers:'Fournisseur',procurements:'Demande fournisseur',supplier_quotes:'Devis',supplier_contracts:'Contrat',comments:'Message'}

export default function App() {
  const [projects,setProjects]=useState([]), [activeId,setActiveId]=useState(null), [view,setView]=useState('dashboard')
  const [entities,setEntities]=useState(Object.fromEntries(ENTITY_TYPES.map(type=>[type,[]]))), [modal,setModal]=useState(null), [query,setQuery]=useState('')
  const [workspace,setWorkspace]=useState(null), [error,setError]=useState('')
  const [agileTab,setAgileTab]=useState('board'), [dark,setDark]=useState(()=>localStorage.getItem('jalonis-theme')==='dark')
  const [notificationOpen,setNotificationOpen]=useState(false)
  const active=projects.find(p=>p.id===activeId)

  async function loadProjects(selectFirst=true){ const rows=await api.projects.list(); setProjects(rows); if(selectFirst&&!activeId&&rows[0]) setActiveId(rows[0].id) }
  async function loadEntities(id){ if(!id)return; const values=await Promise.all(ENTITY_TYPES.map(t=>api.entities.list(t,id))); setEntities(Object.fromEntries(ENTITY_TYPES.map((t,i)=>[t,values[i]]))) }
  async function loadWorkspace(){ setWorkspace(await api.workspace.get()) }
  useEffect(()=>{loadProjects();loadWorkspace()},[])
  useEffect(()=>{loadEntities(activeId)},[activeId])

  const stats=useMemo(()=>{
    const progress=entities.tasks.length?Math.round(entities.tasks.reduce((s,t)=>s+Number(t.progress||0),0)/entities.tasks.length):0
    const critical=entities.risks.filter(r=>Number(r.probability)*Number(r.impact)>=15&&r.status!=='Fermé').length
    return {progress,critical,done:entities.tasks.filter(t=>t.status==='Terminé').length}
  },[entities])

  async function createProject(data){ const item=await api.projects.create(data); setModal(null); await loadProjects(false); setActiveId(item.id); setView('dashboard') }
  async function recordEvent({projectId=activeId,eventType,entityType,entityId,title,description,notify=true}){
    if(!projectId)return
    const actorName=workspace?.current_user?.full_name||'Chef de projet'
    await api.entities.create('activities',{project_id:projectId,event_type:eventType,entity_type:entityType,entity_id:entityId,title,description,actor_name:actorName})
    const preferences=workspace?.current_user||{}
    const preferenceKey=eventType==='assignment.changed'?'notify_assignments':eventType==='comment.created'?'notify_comments':['status.changed','task.completed'].includes(eventType)?'notify_status_changes':null
    const inAppEnabled=preferences.notify_in_app===undefined||Boolean(Number(preferences.notify_in_app))
    const eventEnabled=!preferenceKey||preferences[preferenceKey]===undefined||Boolean(Number(preferences[preferenceKey]))
    if(notify&&inAppEnabled&&eventEnabled)await api.entities.create('notifications',{project_id:projectId,event_type:eventType,entity_type:entityType,entity_id:entityId,title,body:description,is_read:false})
  }
  async function addEntity(type,data){
    const item=await api.entities.create(type,{...data,project_id:activeId})
    if(!['activities','notifications','attachments','checklist_items'].includes(type)){
      const isComment=type==='comments', label=ENTITY_LABELS[type]||'Élément', name=item.title||item.name||item.body?.slice(0,55)||label
      await recordEvent({eventType:isComment?'comment.created':`${type}.created`,entityType:type,entityId:item.id,title:isComment?'Nouveau message dans le projet':`${label} créé`,description:isComment?`${item.author_name||'Un membre'} : ${item.body}`:name,notify:isComment||['tasks','risks','backlog_items'].includes(type)})
    }
    setModal(null); await loadEntities(activeId); await loadProjects(false); return item
  }
  async function removeEntity(type,id){
    const previous=entities[type]?.find(item=>item.id===id)
    await api.entities.remove(type,id)
    if(previous&&!['activities','notifications','comments','attachments','checklist_items'].includes(type))await recordEvent({eventType:`${type}.deleted`,entityType:type,entityId:id,title:`${ENTITY_LABELS[type]||'Élément'} supprimé`,description:previous.title||previous.name||'',notify:false})
    await loadEntities(activeId); await loadProjects(false)
  }
  async function updateEntity(type,id,data){
    const previous=entities[type]?.find(item=>item.id===id)
    const item=await api.entities.update(type,id,data)
    const name=item?.title||item?.name||ENTITY_LABELS[type]||'Élément'
    let recorded=false
    if(previous&&data.status!==undefined&&previous.status!==item.status){await recordEvent({eventType:'status.changed',entityType:type,entityId:id,title:`${name} · ${item.status}`,description:`Statut modifié de « ${previous.status||'Non défini'} » vers « ${item.status} ».`});recorded=true}
    const oldAssignee=previous?.assignee||previous?.assignee_id, nextAssignee=item?.assignee||item?.assignee_id
    if(previous&&(data.assignee!==undefined||data.assignee_id!==undefined)&&oldAssignee!==nextAssignee){await recordEvent({eventType:'assignment.changed',entityType:type,entityId:id,title:`Nouvelle affectation · ${name}`,description:nextAssignee?`Assigné à ${item.assignee||'un membre de l’équipe'}.`:'Affectation retirée.'});recorded=true}
    if(previous&&type==='tasks'&&Number(previous.progress)<100&&Number(item.progress)===100){await recordEvent({eventType:'task.completed',entityType:type,entityId:id,title:`Activité terminée · ${name}`,description:'L’avancement a atteint 100 %.'});recorded=true}
    if(previous&&!recorded&&!['notifications','activities','checklist_items'].includes(type))await recordEvent({eventType:`${type}.updated`,entityType:type,entityId:id,title:`${ENTITY_LABELS[type]||'Élément'} mis à jour`,description:name,notify:false})
    await loadEntities(activeId); await loadProjects(false)
    return item
  }
  async function updateCharter(data){ await api.projects.update(activeId,data); await recordEvent({eventType:'project.updated',entityType:'projects',entityId:activeId,title:'Charte du projet mise à jour',description:data.name||active?.name,notify:false}); await loadEntities(activeId); await loadProjects(false) }
  async function attachMedia(entityType,entityId){await api.media.attach({project_id:activeId,entity_type:entityType,entity_id:entityId});await loadEntities(activeId)}
  async function updateBranding(data){await api.projects.update(activeId,{theme_color:data.theme_color});if(data.upload_logo)await api.projects.uploadLogo(activeId);setModal(null);await loadProjects(false)}
  async function renameWorkspace(data){ setWorkspace(await api.workspace.update(data)) }
  async function updateNotificationPreferences(data){ setWorkspace(await api.workspace.updatePreferences(data)) }
  async function inviteMember(data){
    try { setError(''); setWorkspace(await api.workspace.invite(data)); setModal(null) }
    catch (reason) { setError(reason.message || "Impossible de créer l’invitation") }
  }
  async function removeMember(id){
    try { setError(''); setWorkspace(await api.workspace.removeMember(id)) }
    catch (reason) { setError(reason.message || "Impossible de retirer ce membre") }
  }
  const currentUser=workspace?.current_user
  function toggleTheme(){setDark(value=>{const next=!value;localStorage.setItem('jalonis-theme',next?'dark':'light');return next})}
  function openProjectView(nextView,nextAgileTab){if(nextAgileTab)setAgileTab(nextAgileTab);setView(nextView)}
  async function readNotification(id){await api.entities.update('notifications',id,{is_read:true});await loadEntities(activeId)}
  async function readAllNotifications(){await Promise.all(entities.notifications.filter(item=>!Number(item.is_read)).map(item=>api.entities.update('notifications',item.id,{is_read:true})));await loadEntities(activeId)}
  const unreadNotifications=entities.notifications.filter(item=>!Number(item.is_read)).length

  return <div className={`app-shell${dark?' dark':''}`}>
    <aside className="sidebar">
      <div className="brand"><img src="./assets/jalonis-logo.png"/><div><strong>Jalonis</strong><span>Pilotage de projets</span></div></div>
      <div className="workspace-label">ESPACE DE TRAVAIL</div>
      <button className="project-switcher" onClick={()=>setModal('projects')} style={{'--project-color':active?.theme_color||'#4f46e5'}}>{active?.logo_url?<img className="project-avatar project-logo" src={active.logo_url} alt=""/>:<span className="project-avatar">{active?.name?.[0]||workspace?.workspace?.name?.[0]||'J'}</span>}<span><b>{workspace?.workspace?.name||'Mon espace Jalonis'}</b><small>{active?.name||'Aucun projet sélectionné'}</small></span><ChevronRight size={16}/></button>
      <nav>{NAV.map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)}><Icon size={18}/><span>{label}</span>{id==='risks'&&stats.critical>0?<em>{stats.critical}</em>:null}</button>)}</nav>
      <div className="sidebar-bottom"><button className={view==='workspace'?'active':''} onClick={()=>setView('workspace')}><Building2 size={18}/>Espace & accès</button><button onClick={()=>setModal('projects')}><FolderKanban size={18}/>Tous les projets</button><button onClick={()=>setView('settings')}><Settings size={18}/>Paramètres</button></div>
      <div className="user-chip"><div className="avatar">{(currentUser?.full_name||'CP').split(' ').map(part=>part[0]).slice(0,2).join('')}</div><div><b>{currentUser?.full_name||'Chef de projet'}</b><small>{currentUser?.role||'Administrateur local'}</small></div><MoreHorizontal size={17}/></div>
    </aside>
    <main>
      <header className="app-header"><div className="search"><Search size={17}/><input placeholder="Rechercher dans le projet…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="icon-btn" title={dark?'Mode clair':'Mode sombre'} onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-btn notification-trigger" title="Notifications" onClick={()=>setNotificationOpen(value=>!value)}><Bell size={18}/>{unreadNotifications>0&&<span className="notification-badge">{unreadNotifications>9?'9+':unreadNotifications}</span>}</button><button className="btn primary" onClick={()=>setModal('project')}><Plus size={17}/>Créer</button>{notificationOpen&&<NotificationCenter notifications={entities.notifications} onRead={readNotification} onReadAll={readAllNotifications} onClose={()=>setNotificationOpen(false)}/>}</header>
      <section className={`content${active&&view!=='workspace'&&view!=='settings'?' project-content':''}`} style={active?{'--project-color':active.theme_color||'#4f46e5'}:undefined}>
        {error&&<div className="app-error">{error}<button onClick={()=>setError('')}>×</button></div>}
        {view==='workspace' ? <><div className="page-title"><div><span className="eyebrow">ORGANISATION</span><h1>Espace de travail</h1><p>Gérez les membres, les rôles et les futurs canaux de notification.</p></div></div><WorkspaceView data={workspace} onRename={renameWorkspace} onInvite={()=>setModal('invite-member')} onRemove={removeMember} onUpdatePreferences={updateNotificationPreferences}/></>
        : view==='settings' ? <><div className="page-title"><div><span className="eyebrow">APPLICATION</span><h1>Paramètres</h1><p>Configuration de cette installation de Jalonis.</p></div></div><SettingsView/></>
        : !active ? <Empty onCreate={()=>setModal('project')}/> : <>
          <ProjectHeader active={active} view={view} agileTab={agileTab} members={workspace?.members||[]} onNavigate={openProjectView} onShare={()=>setModal('invite-member')} onBranding={()=>setModal('branding')}/>
          {view!=='scrum'&&<div className="page-title compact-title"><div><span className="eyebrow">{active.code||'PROJET'}</span><h1>{view==='dashboard'?'Vue d’ensemble':view==='activity'?'Activité du projet':NAV.find(n=>n[0]===view)?.[1]||'Paramètres'}</h1><p>{view==='dashboard'?'Les signaux essentiels pour prendre les bonnes décisions.':view==='activity'?'Messages, notifications et historique des changements.':active.name}</p></div>{['tasks','risks','team','meetings'].includes(view)&&<button className="btn primary" onClick={()=>setModal(view)}><Plus size={17}/>Ajouter</button>}</div>}
          {view==='dashboard'&&<Dashboard active={active} entities={entities} stats={stats} setView={setView}/>} 
          {view==='charter'&&<Charter project={active} onSave={updateCharter}/>} 
          {view==='tasks'&&<Tasks rows={entities.tasks} items={entities.backlog_items} sprints={entities.sprints} team={entities.team} members={workspace?.members||[]} attachments={entities.attachments} comments={entities.comments} activities={entities.activities} checklist={entities.checklist_items} currentUser={currentUser} query={query} onAttach={id=>attachMedia('tasks',id)} onComment={data=>addEntity('comments',data)} onAddChecklist={data=>addEntity('checklist_items',data)} onUpdateChecklist={(id,data)=>updateEntity('checklist_items',id,data)} onDeleteChecklist={id=>removeEntity('checklist_items',id)} onDelete={id=>removeEntity('tasks',id)} onUpdate={(id,data)=>updateEntity('tasks',id,data)}/>}
          {view==='scrum'&&<ScrumView project={active} sprints={entities.sprints} items={entities.backlog_items} tasks={entities.tasks} attachments={entities.attachments} comments={entities.comments} activities={entities.activities} checklist={entities.checklist_items} team={entities.team} members={workspace?.members||[]} currentUser={currentUser} activeTab={agileTab} onTabChange={setAgileTab} onAttach={id=>attachMedia('backlog_items',id)} onComment={data=>addEntity('comments',data)} onAddChecklist={data=>addEntity('checklist_items',data)} onUpdateChecklist={(id,data)=>updateEntity('checklist_items',id,data)} onDeleteChecklist={id=>removeEntity('checklist_items',id)} onCreate={addEntity} onUpdate={updateEntity} onDelete={removeEntity} onUpdateProject={updateCharter}/>}
          {view==='suppliers'&&<SupplierManagement projectId={activeId} data={entities} tasks={entities.tasks} risks={entities.risks} onCreate={addEntity} onDelete={removeEntity} onReload={()=>loadEntities(activeId)}/>} 
          {view==='risks'&&<Risks rows={entities.risks} tasks={entities.tasks} query={query} onDelete={id=>removeEntity('risks',id)}/>} 
          {view==='team'&&<Team rows={entities.team} query={query} onDelete={id=>removeEntity('team',id)}/>} 
          {view==='meetings'&&<Meetings rows={entities.meetings} tasks={entities.tasks} query={query} onDelete={id=>removeEntity('meetings',id)}/>} 
          {view==='activity'&&<ActivityView project={active} comments={entities.comments} activities={entities.activities} currentUser={currentUser} onComment={data=>addEntity('comments',data)}/>}
        </>}
      </section>
    </main>
    {modal==='project'&&<Modal title="Créer un projet" onClose={()=>setModal(null)}><ProjectForm onSubmit={createProject} onCancel={()=>setModal(null)}/></Modal>}
    {modal==='projects'&&<Modal title="Portefeuille de projets" onClose={()=>setModal(null)}><div className="project-list">{projects.map(p=><button key={p.id} style={{'--project-color':p.theme_color||'#4f46e5'}} onClick={()=>{setActiveId(p.id);setModal(null);setView('dashboard')}}>{p.logo_url?<img className="portfolio-logo" src={p.logo_url} alt=""/>:<span className="portfolio-color">{p.name?.[0]||'P'}</span>}<span><b>{p.name}</b><small>{p.code||'Sans code'} · {p.status}</small></span><strong>{p.progress||0}%</strong><ChevronRight size={17}/></button>)}</div><div className="form-actions"><button className="btn primary" onClick={()=>setModal('project')}><Plus size={17}/>Nouveau projet</button></div></Modal>}
    {['tasks','risks','team','meetings'].includes(modal)&&<Modal title={configs[modal].title} onClose={()=>setModal(null)}><EntityForm type={modal} tasks={entities.tasks} members={workspace?.members||[]} onSubmit={d=>addEntity(modal,d)} onCancel={()=>setModal(null)}/></Modal>}
    {modal==='invite-member'&&<Modal title="Inviter un membre" onClose={()=>setModal(null)}><InviteMemberForm onSubmit={inviteMember} onCancel={()=>setModal(null)}/></Modal>}
    {modal==='branding'&&<Modal title="Identité du projet" onClose={()=>setModal(null)}><ProjectBrandingForm project={active} onSubmit={updateBranding} onCancel={()=>setModal(null)}/></Modal>}
  </div>
}

const PROJECT_TABS=[
  ['dashboard',null,'Résumé',LayoutDashboard],['tasks',null,'Planning',ChartNoAxesGantt],['scrum','board','Tableau',Columns3],['scrum','backlog','Backlog',ClipboardList],
  ['suppliers',null,'Fournisseurs',Truck],['risks',null,'Risques',ShieldAlert],['team',null,'Équipe',Users],['meetings',null,'Réunions',MessageSquareText],['activity',null,'Activité',Bell],
]

function ProjectHeader({active,view,agileTab,members,onNavigate,onShare,onBranding}){
  return <div className="project-context">
    <div className="project-context-main">
      <div><span className="project-breadcrumb">Projets <ChevronRight size={13}/> {active.code||'Projet actif'}</span><div className="project-heading">{active.logo_url?<img className="project-mark project-logo" src={active.logo_url} alt={`Logo ${active.name}`}/>:<span className="project-mark">{active.name?.[0]||'J'}</span>}<div><h1>{active.name}</h1><p>{active.methodology||'Hybride'} · {active.status||'En cours'}</p></div></div></div>
      <div className="project-actions"><div className="member-stack">{members.slice(0,4).map((member,index)=><span key={member.id||index} title={member.full_name}>{(member.full_name||'M').split(' ').map(part=>part[0]).slice(0,2).join('')}</span>)}{members.length>4&&<em>+{members.length-4}</em>}</div><button className="btn ghost" onClick={onBranding}><Palette size={15}/>Personnaliser</button><button className="btn ghost" onClick={onShare}><Share2 size={15}/>Partager</button></div>
    </div>
    <nav className="project-tabs">{PROJECT_TABS.map(([target,subtab,label,Icon])=>{const selected=view===target&&(!subtab||agileTab===subtab);return <button key={`${target}-${subtab||''}`} className={selected?'active':''} onClick={()=>onNavigate(target,subtab)}><Icon size={15}/>{label}</button>})}<button className="project-tab-more"><MoreHorizontal size={16}/></button></nav>
  </div>
}

function ProjectBrandingForm({project,onSubmit,onCancel}){const [color,setColor]=useState(project.theme_color||'#4f46e5'),[uploadLogo,setUploadLogo]=useState(false);return <form onSubmit={event=>{event.preventDefault();onSubmit({theme_color:color,upload_logo:uploadLogo})}}><div className="branding-preview" style={{'--project-color':color}}>{project.logo_url?<img src={project.logo_url} alt=""/>:<span>{project.name?.[0]||'P'}</span>}<div><h3>{project.name}</h3><p>Aperçu de l’identité du projet</p></div></div><div className="form-grid"><label>Couleur principale<span className="color-field"><input type="color" value={color} onChange={event=>setColor(event.target.value)}/><b>{color}</b></span></label><label className="logo-choice"><input type="checkbox" checked={uploadLogo} onChange={event=>setUploadLogo(event.target.checked)}/><span><b>Choisir un nouveau logo</b><small>PNG, JPG ou WebP au moment d’enregistrer</small></span></label></div><div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary">Enregistrer l’identité</button></div></form>}

function Empty({onCreate}){return <div className="empty"><img src="./assets/jalonis-logo.png"/><h1>Bienvenue dans Jalonis</h1><p>Créez votre premier projet et pilotez son cycle de vie au même endroit.</p><button className="btn primary" onClick={onCreate}><Plus size={17}/>Créer un projet</button></div>}

function Dashboard({active,entities,stats,setView}){
  const upcoming=[...entities.tasks].filter(t=>t.status!=='Terminé').sort((a,b)=>(a.due_date||'').localeCompare(b.due_date||'')).slice(0,4)
  return <>
    <DailyBrief entities={entities} onOpenTasks={()=>setView('tasks')} onOpenRisks={()=>setView('risks')}/>
    <div className="kpi-grid">
      <Kpi icon={Target} label="Avancement global" value={`${stats.progress}%`} note={`${stats.done}/${entities.tasks.length} activités terminées`} color="indigo" progress={stats.progress}/>
      <Kpi icon={Clock3} label="Échéance cible" value={date(active.end_date)} note={active.status} color="blue"/>
      <Kpi icon={CircleDollarSign} label="Budget de référence" value={money(active.budget)} note="Coûts détaillés à venir" color="teal"/>
      <Kpi icon={ShieldAlert} label="Risques critiques" value={stats.critical} note={`${entities.risks.filter(r=>r.status!=='Fermé').length} risques ouverts`} color="orange"/>
    </div>
    <div className="dashboard-grid">
      <section className="card span-2"><CardHead title="Trajectoire du projet" action="Ouvrir le planning" onClick={()=>setView('tasks')}/><div className="trajectory"><div className="donut" style={{'--progress':`${stats.progress*3.6}deg`}}><span><b>{stats.progress}%</b><small>réalisé</small></span></div><div className="phase-list">{['Initialisation','Planification','Exécution','Clôture'].map((p,i)=><div key={p} className={i<2?'complete':i===2?'current':''}><span>{i<2?<CheckCircle2 size={17}/>:i+1}</span><div><b>{p}</b><small>{i<2?'Validée':i===2?'Phase actuelle':'À venir'}</small></div></div>)}</div></div></section>
      <section className="card"><CardHead title="Santé du projet"/><div className="health-panel"><div className={`health-big ${active.health}`}>{active.health==='good'?'Bonne':active.health==='warning'?'À surveiller':'Critique'}</div>{[['Périmètre','good'],['Délais','warning'],['Budget','good'],['Équipe','good']].map(([l,s])=><div className="health-row" key={l}><span>{l}</span><b className={s}>{s==='good'?'Maîtrisé':'Attention'}</b></div>)}</div></section>
      <section className="card span-2"><CardHead title="Prochaines échéances" action="Tout afficher" onClick={()=>setView('tasks')}/>{upcoming.length?<div className="timeline-list">{upcoming.map(t=><div key={t.id}><span className={`priority-dot ${t.priority?.toLowerCase()}`}></span><div><b>{t.title}</b><small>{t.assignee||'Non assigné'}</small></div><strong>{date(t.due_date)}</strong><span className="pill">{t.status}</span></div>)}</div>:<EmptyRow text="Aucune échéance planifiée"/>}</section>
      <section className="card"><CardHead title="Attention requise" action="Risques" onClick={()=>setView('risks')}/><div className="attention">{entities.risks.filter(r=>r.status!=='Fermé').slice(0,3).map(r=><div key={r.id}><span>{Number(r.probability)*Number(r.impact)}</span><div><b>{r.title}</b><small>{r.owner||'Sans responsable'} · {r.category}</small></div></div>)}{!entities.risks.length&&<EmptyRow text="Aucun risque ouvert"/>}</div></section>
    </div>
  </>
}

function Kpi({icon:Icon,label,value,note,color,progress}){return <div className="kpi"><div className={`kpi-icon ${color}`}><Icon size={20}/></div><div className="kpi-top"><span>{label}</span><ArrowUpRight size={16}/></div><strong>{value}</strong><small>{note}</small>{progress!==undefined&&<div className="mini-progress"><i style={{width:`${progress}%`}}/></div>}</div>}
function CardHead({title,action,onClick}){return <div className="card-head"><h3>{title}</h3>{action&&<button onClick={onClick}>{action}<ChevronRight size={15}/></button>}</div>}
function EmptyRow({text}){return <div className="empty-row">{text}</div>}

function Charter({project,onSave}){
  const [form,setForm]=useState(project),[saved,setSaved]=useState(false)
  useEffect(()=>setForm(project),[project])
  const change=e=>setForm({...form,[e.target.name]:e.target.value})
  const save=async e=>{e.preventDefault();await onSave(form);setSaved(true);setTimeout(()=>setSaved(false),1800)}
  return <form className="card charter" onSubmit={save}><div className="section-title"><FileText size={20}/><div><h3>Charte de projet</h3><p>Le mandat qui aligne le sponsor, l’équipe et les parties prenantes.</p></div></div><div className="form-grid"><label>Code<input name="code" value={form.code||''} onChange={change}/></label><label>Statut<select name="status" value={form.status||''} onChange={change}>{['Initialisation','Planification','Exécution','Surveillance','Clôture','Archivé'].map(x=><option key={x}>{x}</option>)}</select></label><label>Mode de pilotage<select name="methodology" value={form.methodology||'Hybride'} onChange={change}><option>Hybride</option><option>Scrum</option><option>Prédictif</option></select></label><label>Sponsor<input name="sponsor" value={form.sponsor||''} onChange={change}/></label><label>Chef de projet<input name="manager" value={form.manager||''} onChange={change}/></label><label className="span-2">Description<textarea name="description" value={form.description||''} onChange={change}/></label><label className="span-2">Objectif principal<textarea name="objective" value={form.objective||''} onChange={change}/></label><label className="span-2">Critères de succès<textarea name="success_criteria" value={form.success_criteria||''} onChange={change}/></label><label>Début<input type="date" name="start_date" value={form.start_date||''} onChange={change}/></label><label>Fin cible<input type="date" name="end_date" value={form.end_date||''} onChange={change}/></label></div><div className="form-actions"><span className={saved?'save-state visible':'save-state'}>Enregistré localement</span><button className="btn primary">Enregistrer la charte</button></div></form>
}

const match=(row,q)=>!q||Object.values(row).some(v=>String(v||'').toLowerCase().includes(q.toLowerCase()))
function Table({columns,rows,query,onDelete,onRowClick,empty}){return <div className="card table-card"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}<th></th></tr></thead><tbody>{rows.filter(r=>match(r,query)).map(row=><tr key={row.id} className={onRowClick?'clickable-row':''} onClick={()=>onRowClick?.(row)}>{columns.map(c=><td key={c.key}>{c.render?c.render(row[c.key],row):row[c.key]||'—'}</td>)}<td><button className="row-delete" title="Supprimer" onClick={event=>{event.stopPropagation();onDelete(row.id)}}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!rows.length&&<EmptyRow text={empty}/>}</div>}
const status=v=><span className={`status ${String(v).toLowerCase().replaceAll(' ','-')}`}>{v||'—'}</span>
function Tasks({rows,items,sprints,team,members,attachments=[],comments=[],activities=[],checklist=[],currentUser,query,onAttach,onComment,onAddChecklist,onUpdateChecklist,onDeleteChecklist,onDelete,onUpdate}){
  const [mode,setMode]=useState('calendar')
  const [discussion,setDiscussion]=useState(null)
  const [selected,setSelected]=useState(null)
  const setBaseline=async()=>{await Promise.all(rows.filter(t=>t.start_date&&t.due_date).map(t=>onUpdate(t.id,{baseline_start:t.start_date,baseline_end:t.due_date}))) }
  return <>
    <div className="planning-toolbar"><div className="view-toggle"><button className={mode==='calendar'?'active':''} onClick={()=>setMode('calendar')}><CalendarDays size={15}/>Calendrier</button><button className={mode==='gantt'?'active':''} onClick={()=>setMode('gantt')}><CalendarRange size={15}/>Gantt</button><button className={mode==='list'?'active':''} onClick={()=>setMode('list')}><List size={15}/>Liste</button></div><span>Calendrier, dépendances et trajectoire critique synchronisés.</span></div>
    {mode === 'calendar'
      ? <MonthCalendar rows={rows.filter(r=>match(r,query))}/>
      : mode === 'gantt'
        ? <GanttView rows={rows.filter(r=>match(r,query))} team={team} onSetBaseline={setBaseline}/>
        : <Table rows={rows} query={query} onDelete={onDelete} onRowClick={setSelected} empty="Ajoutez la première activité du planning." columns={[{key:'wbs_code',label:'WBS'},{key:'title',label:'Activité',render:(v,r)=><b>{r.is_milestone?'◆ ':''}{v}</b>},{key:'visuals',label:'Rendus',render:(_,r)=><VisualCell files={attachments.filter(file=>file.entity_type==='tasks'&&file.entity_id===r.id)} onAttach={()=>onAttach(r.id)}/>},{key:'comments',label:'Messages',render:(_,r)=>{const count=comments.filter(item=>item.entity_type==='tasks'&&item.entity_id===r.id).length;return <button className="comment-link" onClick={event=>{event.stopPropagation();setDiscussion(r)}}><MessageSquareText size={13}/>{count}</button>}},{key:'status',label:'Statut',render:status},{key:'priority',label:'Priorité'},{key:'assignee',label:'Responsable'},{key:'due_date',label:'Échéance',render:date},{key:'progress',label:'Avancement',render:v=><div className="progress-cell"><i><span style={{width:`${v||0}%`}}/></i><b>{v||0}%</b></div>}]}/>
    }
    {discussion&&<Modal title="Discussion de l’activité" onClose={()=>setDiscussion(null)}><EntityDiscussion entity={discussion} entityType="tasks" comments={comments} currentUser={currentUser} onComment={onComment}/></Modal>}
    {selected&&<Modal title="Fiche complète de l’activité" onClose={()=>setSelected(null)}><WorkItemDetails item={rows.find(row=>row.id===selected.id)||selected} type="tasks" tasks={rows} items={items} sprints={sprints} members={members} attachments={attachments} comments={comments} activities={activities} checklist={checklist} currentUser={currentUser} onUpdate={onUpdate} onAttach={()=>onAttach(selected.id)} onComment={onComment} onAddChecklist={onAddChecklist} onUpdateChecklist={onUpdateChecklist} onDeleteChecklist={onDeleteChecklist}/></Modal>}
  </>
}

function VisualCell({files,onAttach}){return <div className="visual-cell">{files.slice(0,2).map(file=><img key={file.id} src={file.url} alt={file.file_name}/>)}<button title="Ajouter des images" onClick={event=>{event.stopPropagation();onAttach()}}><ImagePlus size={14}/>{files.length>2?`+${files.length-2}`:''}</button></div>}

const DAY_MS=86400000
const isoDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const localDay=value=>{const [y,m,d]=String(value).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)}
const shiftDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)

function MonthCalendar({rows}){
  const firstTask=rows.find(r=>r.start_date)?.start_date
  const [cursor,setCursor]=useState(()=>{const d=firstTask?localDay(firstTask):new Date();return new Date(d.getFullYear(),d.getMonth(),1)})
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1)
  const mondayOffset=(first.getDay()+6)%7
  const gridStart=shiftDays(first,-mondayOffset)
  const weeks=Array.from({length:6},(_,week)=>Array.from({length:7},(_,day)=>shiftDays(gridStart,week*7+day)))
  const today=isoDay(new Date())
  const label=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(cursor)
  return <div className="calendar-card card">
    <div className="calendar-head"><div><h3>{label.charAt(0).toUpperCase()+label.slice(1)}</h3><small>{rows.filter(r=>r.start_date&&r.due_date).length} activité(s) planifiée(s)</small></div><div><button onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))}><ChevronLeft size={17}/></button><button className="today-btn" onClick={()=>{const d=new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1))}}>Aujourd’hui</button><button onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))}><ChevronRight size={17}/></button></div></div>
    <div className="weekday-row">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(day=><span key={day}>{day}</span>)}</div>
    <div className="month-grid">{weeks.map((days,index)=><CalendarWeek key={index} days={days} rows={rows} activeMonth={cursor.getMonth()} today={today}/>)}</div>
    {!rows.some(r=>r.start_date&&r.due_date)&&<div className="calendar-empty">Ajoutez une activité avec une date de début et une échéance pour l’afficher ici.</div>}
  </div>
}

function CalendarWeek({days,rows,activeMonth,today}){
  const weekStart=days[0],weekEnd=days[6]
  const segments=rows.filter(task=>task.start_date&&task.due_date).map(task=>{
    let start=localDay(task.start_date),end=localDay(task.due_date)
    if(end<start)[start,end]=[end,start]
    if(end<weekStart||start>weekEnd)return null
    const visibleStart=start<weekStart?weekStart:start,visibleEnd=end>weekEnd?weekEnd:end
    return {...task,startCol:Math.round((visibleStart-weekStart)/DAY_MS),endCol:Math.round((visibleEnd-weekStart)/DAY_MS),continuesBefore:start<weekStart,continuesAfter:end>weekEnd}
  }).filter(Boolean).sort((a,b)=>a.startCol-b.startCol||b.endCol-a.endCol)
  const laneEnds=[]
  segments.forEach(segment=>{let lane=laneEnds.findIndex(end=>segment.startCol>end);if(lane<0)lane=laneEnds.length;laneEnds[lane]=segment.endCol;segment.lane=lane})
  const height=Math.max(102,58+laneEnds.length*24)
  return <div className="calendar-week" style={{height}}>
    <div className="week-days">{days.map(day=>{const key=isoDay(day);return <div key={key} className={`${day.getMonth()!==activeMonth?'outside':''} ${key===today?'today':''}`}><span>{day.getDate()}</span></div>})}</div>
    <div className="event-layer">{segments.map(segment=><div key={segment.id} className={`calendar-event ${segment.continuesBefore?'continues-before':''} ${segment.continuesAfter?'continues-after':''}`} title={`${segment.title} — ${segment.assignee||'Non assigné'}`} style={{left:`calc(${segment.startCol*100/7}% + 3px)`,width:`calc(${(segment.endCol-segment.startCol+1)*100/7}% - 6px)`,top:35+segment.lane*24,backgroundColor:segment.color||'#4f46e5'}}><b>{segment.title}</b>{segment.assignee&&<span>· {segment.assignee}</span>}</div>)}</div>
  </div>
}
function Risks({rows,tasks,query,onDelete}){return <Table rows={rows} query={query} onDelete={onDelete} empty="Aucun risque enregistré." columns={[{key:'title',label:'Risque',render:v=><b>{v}</b>},{key:'linked_task_id',label:'Activité liée',render:v=>v?(tasks.find(t=>t.id===v)?.title||'Activité supprimée'):'—'},{key:'category',label:'Catégorie'},{key:'probability',label:'Probabilité'},{key:'impact',label:'Impact'},{key:'score',label:'Score',render:(_,r)=><strong className={`risk-score ${Number(r.probability)*Number(r.impact)>=15?'high':''}`}>{Number(r.probability)*Number(r.impact)}</strong>},{key:'owner',label:'Propriétaire'},{key:'status',label:'Statut',render:status}]}/>}
function Team({rows,query,onDelete}){return <div className="people-grid">{rows.filter(r=>match(r,query)).map((p,i)=><div className="person card" key={p.id}><button className="row-delete" onClick={()=>onDelete(p.id)}><Trash2 size={15}/></button><div className={`person-avatar c${i%4}`}>{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><h3>{p.name}</h3><p>{p.role||'Membre de l’équipe'}</p><span>{p.email||'—'}</span><div><small>Disponibilité</small><b>{p.availability||0}%</b></div><div><small>Compétences</small><b>{p.skills||'—'}</b></div></div>)}</div>}
function Meetings({rows,tasks,query,onDelete}){return <div className="meeting-list">{rows.filter(r=>match(r,query)).map(m=><article className="card meeting" key={m.id}><div className="meeting-date"><b>{m.meeting_date?new Date(m.meeting_date).getDate():'—'}</b><span>{m.meeting_date?new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(new Date(m.meeting_date)):'Date'}</span></div><div><h3>{m.title}</h3><p>{m.agenda||'Aucun ordre du jour'}</p><small><Users size={14}/>{m.participants||'Participants non précisés'}</small>{m.linked_task_id&&<div className="linked-task">Activité liée · <b>{tasks.find(t=>t.id===m.linked_task_id)?.title||'Activité supprimée'}</b></div>}{m.decisions&&<div className="decision"><b>Décisions</b>{m.decisions}</div>}</div><button className="row-delete" onClick={()=>onDelete(m.id)}><Trash2 size={16}/></button></article>)}{!rows.length&&<div className="card"><EmptyRow text="Planifiez votre première réunion."/></div>}</div>}
function SettingsView(){const [info,setInfo]=useState(null);useEffect(()=>{api.system.info().then(setInfo)},[]);const cloud=!window.jalonis&&isCloudConfigured;return <div className="card settings-card"><div className="section-title"><Database size={20}/><div><h3>{cloud?'Données cloud':'Données locales'}</h3><p>{cloud?'Vos projets sont isolés dans l’espace de votre organisation.':'Vos projets restent sur cet ordinateur.'}</p></div></div><div className="setting-row"><span>Emplacement de la base</span><code>{info?.dataPath||'Chargement…'}</code></div><div className="setting-row"><span>Version de Jalonis</span><b>{info?.version||'0.1.0'}</b></div><div className="local-banner"><HardDrive size={19}/><div><b>{cloud?'Mode SaaS connecté':'Stockage local'}</b><p>{cloud?'Authentification, PostgreSQL et stockage sécurisé sont activés.':'Aucun compte et aucun serveur distant ne sont nécessaires pour cette version.'}</p></div></div>{cloud&&<div className="form-actions"><button className="btn ghost" onClick={()=>cloudAuth.signOut()}>Se déconnecter</button></div>}</div>}
