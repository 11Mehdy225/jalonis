import { useEffect, useMemo, useState } from 'react'
import { api, isDesktopCloud } from './services/api'
import Modal from './shared/Modal'
import ProjectForm from './features/projects/ProjectForm'
import EntityForm, { configs } from './features/projects/EntityForm'
import GanttView from './features/planning/GanttView'
import PlanningSettings from './features/planning/PlanningSettings'
import ScrumView from './features/agile/ScrumView'
import SupplierManagement from './features/procurement/SupplierManagement'
import WorkspaceView, { CreateWorkspaceForm, InviteMemberForm, WorkspaceSwitcher } from './features/workspace/WorkspaceView'
import ActivityView from './features/collaboration/ActivityView'
import NotificationCenter from './features/collaboration/NotificationCenter'
import DailyBrief from './features/collaboration/DailyBrief'
import EntityDiscussion from './features/collaboration/EntityDiscussion'
import WorkItemDetails from './features/projects/WorkItemDetails'
import ResourceManagement from './features/resources/ResourceManagement'
import FinancialView from './features/finance/FinancialView'
import GovernanceView from './features/governance/GovernanceView'
import StakeholderManagement from './features/stakeholders/StakeholderManagement'
import ReportCenter from './features/reports/ReportCenter'
import CustomFieldsView from './features/projects/CustomFieldsView'
import ProjectAssistant from './features/assistant/ProjectAssistant'
import AdminView from './features/admin/AdminView'
import ImpactCenter from './features/impact/ImpactCenter'
import ActionTracker from './features/actions/ActionTracker'
import RaidCenter from './features/raid/RaidCenter'
import { seedProjectTemplate } from './data/projectTemplates'
import { jiraTargets } from './services/jiraImport'
import PrivacyCenter from './features/privacy/PrivacyCenter'
import ProjectAccessManager from './features/workspace/ProjectAccessManager'
import { trackTelemetry } from './services/telemetry'
import './styles/workspace.css'
import './styles/dashboard-command.css'
import { cloudAuth, isCloudConfigured } from './services/supabase'
import { permissionsFor } from './services/permissions'
import { LayoutDashboard, FolderKanban, FileText, CalendarRange, CalendarDays, List, Columns3, Users, ShieldAlert, MessageSquareText, Settings, Plus, Search, Bell, ChevronRight, ChevronLeft, CircleDollarSign, Clock3, Target, HardDrive, MoreHorizontal, Trash2, ArrowUpRight, Database, CheckCircle2, Truck, Building2, Share2, Moon, Sun, ChartNoAxesGantt, ClipboardList, ImagePlus, Palette, Gavel, FileDown, Diamond, Sparkles, Menu, X, Shield, Workflow, LogOut, LockKeyhole, ListChecks, Grid2X2 } from 'lucide-react'

const money = (n,currency='XOF') => new Intl.NumberFormat('fr-FR',{style:'currency',currency,maximumFractionDigits:0}).format(Number(n)||0)
const date = value => value ? new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) : '—'
const outcomeLines=value=>String(value||'').split(/\r?\n/).map(row=>row.trim()).filter(Boolean)
const parseMeetingAction=value=>{const [title,owner,dueDate]=value.split('|').map(part=>part.trim());return {title,owner:owner||'',due_date:/^\d{4}-\d{2}-\d{2}$/.test(dueDate||'')?dueDate:null}}

const NAV = [
  ['dashboard','Vue d’ensemble',LayoutDashboard],['charter','Charte du projet',FileText],['tasks','Planning prédictif',CalendarRange],['scrum','Scrum & Sprints',Columns3],
  ['impact','Chaîne d’impact',Workflow],['assistant','Assistant de pilotage',Sparkles],['actions','Actions',ListChecks],['raid','Registre RAID',Grid2X2],['team','Équipe',Users],['stakeholders','Parties prenantes & RACI',Building2],['suppliers','Fournisseurs & Achats',Truck],['finance','Budget & Coûts',CircleDollarSign],['reports','Rapports & Exports',FileDown],['governance','Gouvernance',Gavel],['custom-fields','Champs personnalisés',List],['risks','Risques',ShieldAlert],['meetings','Réunions',MessageSquareText],
]
const moduleAllowed=(methodology,view)=>methodology==='Scrum'?view!=='tasks':methodology==='Prédictif'?view!=='scrum':true

const ENTITY_TYPES=['tasks','task_dependencies','work_calendars','risks','team','meetings','sprints','scrum_events','scrum_event_entries','backlog_items','attachments','suppliers','procurements','supplier_quotes','supplier_contracts','supplier_evaluations','supplier_documents','comments','activities','notifications','checklist_items','sprint_snapshots','time_entries','cost_entries','change_requests','issues','decisions','stakeholders','raci_assignments','conflicts','communication_plans','custom_fields','custom_field_values','project_links','action_items']
const ENTITY_LABELS={tasks:'Tâche',task_dependencies:'Dépendance',work_calendars:'Calendrier de travail',risks:'Risque',team:'Membre',meetings:'Réunion',sprints:'Sprint',scrum_events:'Événement Scrum',scrum_event_entries:'Contribution Daily',backlog_items:'Élément du backlog',suppliers:'Fournisseur',procurements:'Demande fournisseur',supplier_quotes:'Devis',supplier_contracts:'Contrat',comments:'Message',time_entries:'Temps saisi',cost_entries:'Coût',change_requests:'Demande de changement',issues:'Problème',decisions:'Décision',stakeholders:'Partie prenante',raci_assignments:'Attribution RACI',conflicts:'Conflit',communication_plans:'Communication',custom_fields:'Champ personnalisé',custom_field_values:'Valeur personnalisée',project_links:'Liaison d’impact',action_items:'Action'}
const emptyEntities=()=>Object.fromEntries(ENTITY_TYPES.map(type=>[type,[]]))

export default function App() {
  const [projects,setProjects]=useState([]), [activeId,setActiveId]=useState(null), [view,setView]=useState('dashboard')
  const [entities,setEntities]=useState(emptyEntities), [modal,setModal]=useState(null), [query,setQuery]=useState('')
  const [workspace,setWorkspace]=useState(null), [error,setError]=useState('')
  const [workspaceOptions,setWorkspaceOptions]=useState([])
  const [notice,setNotice]=useState('')
  const [agileTab,setAgileTab]=useState('board'), [dark,setDark]=useState(()=>(localStorage.getItem('kavelyo-theme')||localStorage.getItem('jalonis-theme'))==='dark')
  const [notificationOpen,setNotificationOpen]=useState(false)
  const [mobileNav,setMobileNav]=useState(false)
  const [projectAccess,setProjectAccess]=useState(null),[inviteProject,setInviteProject]=useState(null)
  const [online,setOnline]=useState(()=>navigator.onLine)
  const active=projects.find(p=>p.id===activeId)

  async function loadProjects(selectFirst=true){ const rows=await api.projects.list(); setProjects(rows); if(selectFirst&&!activeId&&rows[0]) setActiveId(rows[0].id) }
  async function loadEntities(id){ if(!id)return; const values=await Promise.all(ENTITY_TYPES.map(t=>api.entities.list(t,id))); setEntities(Object.fromEntries(ENTITY_TYPES.map((t,i)=>[t,values[i]]))) }
  async function reloadProjectTable(table,id){if(table==='projects'){await loadProjects(false);return}if(!ENTITY_TYPES.includes(table))return;const rows=await api.entities.list(table,id);setEntities(current=>({...current,[table]:rows}))}
  async function loadWorkspace(){const state=await api.workspace.get();setWorkspace(state);setWorkspaceOptions(api.workspace.list?await api.workspace.list():[state.workspace])}
  useEffect(()=>{Promise.all([loadProjects(),loadWorkspace()]).catch(reason=>setError(reason.message||"Impossible de charger l’espace de travail."))},[])
  useEffect(()=>{const connected=()=>setOnline(true),disconnected=()=>setOnline(false);window.addEventListener('online',connected);window.addEventListener('offline',disconnected);return()=>{window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected)}},[])
  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get('billing')==='return'){const status=params.get('status');setNotice(status==='successful'?'Paiement reçu. La vérification sécurisée de votre abonnement est en cours.':status==='cancelled'?'Paiement annulé. Aucun changement n’a été appliqué.':'Le paiement n’a pas été finalisé.');params.delete('billing');params.delete('status');params.delete('tx_ref');params.delete('transaction_id');window.history.replaceState({},'',`${window.location.pathname}${params.size?`?${params}`:''}`)}},[])
  useEffect(()=>{loadEntities(activeId)},[activeId])
  useEffect(()=>{if(!activeId||!api.projects.access){setProjectAccess(null);return}api.projects.access(activeId).then(setProjectAccess).catch(reason=>setError(reason.message||'Impossible de charger les accès du projet.'))},[activeId])
  useEffect(()=>{if(!activeId||!api.realtime?.subscribeProject)return;const timers=new Map();const unsubscribe=api.realtime.subscribeProject(activeId,({table})=>{clearTimeout(timers.get(table));timers.set(table,setTimeout(()=>reloadProjectTable(table,activeId).catch(reason=>setError(reason.message||'Synchronisation interrompue.')),120))});return()=>{timers.forEach(clearTimeout);unsubscribe?.()}},[activeId])
  useEffect(()=>{if(!active)return;if(active.methodology==='Scrum'&&view==='tasks'){setView('scrum');setAgileTab('backlog')}if(active.methodology==='Prédictif'&&view==='scrum')setView('tasks')},[active?.methodology,view])
  useEffect(()=>{if(workspace?.current_user)trackTelemetry('page_view',{route:`/${view}`})},[view,workspace?.current_user?.id])

  const stats=useMemo(()=>{
    const scrumItems=entities.backlog_items.filter(item=>item.item_type!=='Epic'),isScrum=active?.methodology==='Scrum',total=isScrum?scrumItems.length:entities.tasks.length
    const progress=isScrum?(total?Math.round(scrumItems.filter(item=>item.status==='Terminé').length/total*100):0):(total?Math.round(entities.tasks.reduce((s,t)=>s+Number(t.progress||0),0)/total):0)
    const critical=entities.risks.filter(r=>Number(r.probability)*Number(r.impact)>=15&&r.status!=='Fermé').length
    return {progress,critical,total,done:isScrum?scrumItems.filter(item=>item.status==='Terminé').length:entities.tasks.filter(t=>t.status==='Terminé').length}
  },[entities,active?.methodology])

  async function createProject(data){
    if(!permissions.createProject)return deny('Votre rôle ne permet pas de créer un projet.')
    try { setError('');const {template_id,...projectData}=data;const item=await api.projects.create(projectData);await seedProjectTemplate(template_id,item,api);setModal(null);await loadProjects(false);setActiveId(item.id);setView('dashboard');setNotice(template_id&&template_id!=='blank'?'Projet créé avec son plan de démarrage.':'Projet créé.') }
    catch(reason){setError(reason.message||'Impossible de créer ce projet avec l’offre actuelle.')}
  }
  async function switchWorkspace(id){
    if(id===workspace?.workspace?.id){setModal(null);return}
    try{
      setError('')
      const next=await api.workspace.select(id)
      const [rows,options]=await Promise.all([api.projects.list(),api.workspace.list?api.workspace.list():[next.workspace]])
      setWorkspace(next);setWorkspaceOptions(options);setProjects(rows);setActiveId(rows[0]?.id||null);setEntities(emptyEntities());setView('dashboard');setModal(null);setNotice('')
    }catch(reason){setError(reason.message||"Impossible d’ouvrir cet espace.")}
  }
  async function createWorkspace(data){
    try{
      setError('')
      const next=await api.workspace.create(data)
      const options=api.workspace.list?await api.workspace.list():[next.workspace]
      setWorkspace(next);setWorkspaceOptions(options);setProjects([]);setActiveId(null);setEntities(emptyEntities());setView('dashboard');setModal(null);setNotice(`L’espace « ${next.workspace.name} » a été créé.`)
    }catch(reason){setError(reason.message||"Impossible de créer cet espace.")}
  }
  async function importProjectArchive(backup){
    if(!permissions.createProject)return deny('Votre rôle ne permet pas d’importer un projet.')
    const source=backup.project||{}
    const projectData=Object.fromEntries(Object.entries(source).filter(([key])=>!['id','workspace_id','created_at','updated_at','logo_path','logo_url','task_count','progress','open_risks'].includes(key)))
    projectData.name=`${source.name||'Projet restauré'} (copie)`
    const restored=await api.projects.create(projectData)
    const excluded=new Set(['attachments','activities','notifications','supplier_documents'])
    const idMap=new Map(),created=[]
    for(const type of ENTITY_TYPES.filter(name=>!excluded.has(name))){
      for(const row of backup.entities?.[type]||[]){
        const clean=Object.fromEntries(Object.entries(row).filter(([key])=>!['id','project_id','created_at','updated_at','stored_path','url'].includes(key)))
        const item=await api.entities.create(type,{...clean,project_id:restored.id})
        if(row.id)idMap.set(row.id,item.id)
        created.push({type,item,source:row})
      }
    }
    for(const {type,item,source:row} of created){
      const links={}
      Object.entries(row).forEach(([key,value])=>{if((key==='entity_id'||key.endsWith('_id'))&&idMap.has(value))links[key]=idMap.get(value)})
      if(Object.keys(links).length)await api.entities.update(type,item.id,links)
    }
    await loadProjects(false);setActiveId(restored.id);setView('dashboard');await loadEntities(restored.id)
    return restored
  }
  async function importJiraProject({name,methodology,issues,prefix}){
    if(!permissions.createProject)return deny('Votre rôle ne permet pas d’importer un projet Jira.')
    const project=await api.projects.create({name:name.trim(),code:prefix||'JIRA',description:'Projet migré depuis un export CSV Jira.',methodology,status:'Planification',health:'good',budget:0})
    const assignees=[...new Set(issues.map(row=>row.assignee).filter(Boolean))]
    for(const person of assignees)await api.entities.create('team',{project_id:project.id,name:person,role:'Membre importé depuis Jira',availability:100})
    const sprintIds=new Map()
    for(const sprint of [...new Set(issues.map(row=>row.sprint).filter(Boolean))]){const created=await api.entities.create('sprints',{project_id:project.id,name:sprint,status:'Planifié',capacity_points:0});sprintIds.set(sprint,created.id)}
    const createdByKey=new Map(),ordered=[...issues].sort((a,b)=>(a.type==='Epic'?-1:1)-(b.type==='Epic'?-1:1))
    for(const [rank,issue] of ordered.entries()){
      const target=jiraTargets(issue,methodology),title=`${issue.key} · ${issue.summary}`,trace=[issue.description,issue.reporter&&`Rapporteur Jira : ${issue.reporter}`,issue.labels&&`Étiquettes Jira : ${issue.labels}`,issue.parent_key&&`Parent Jira : ${issue.parent_key}`].filter(Boolean).join('\n\n')
      const payload=target==='backlog_items'?{project_id:project.id,title,item_type:issue.type,status:issue.status==='À faire'?'Backlog':issue.status,priority:issue.priority,description:trace,story_points:issue.story_points,sprint_id:sprintIds.get(issue.sprint)||null,assignee:issue.assignee||null,epic:issue.epic_key||null,rank}: {project_id:project.id,title,wbs_code:issue.key,status:issue.status,priority:issue.priority,assignee:issue.assignee||null,start_date:issue.created,due_date:issue.due_date,work_hours:issue.estimate_hours,progress:issue.status==='Terminé'?100:issue.status==='En cours'?50:0,notes:trace}
      const created=await api.entities.create(target,payload);createdByKey.set(issue.key,{...created,target})
    }
    for(const issue of issues){const created=createdByKey.get(issue.key),parent=createdByKey.get(issue.epic_key||issue.parent_key);if(created?.target==='backlog_items'&&parent?.target==='backlog_items'&&parent.id!==created.id)await api.entities.update('backlog_items',created.id,{parent_epic_id:parent.id})}
    await loadProjects(false);setActiveId(project.id);setView('dashboard');await loadEntities(project.id);setNotice(`${issues.length} ticket(s) Jira importé(s) dans « ${project.name} ».`);return project
  }
  async function recordEvent({projectId=activeId,eventType,entityType,entityId,title,description,notify=true,recipientId}){
    if(!projectId)return
    const actorName=workspace?.current_user?.full_name||'Chef de projet'
    await api.entities.create('activities',{project_id:projectId,event_type:eventType,entity_type:entityType,entity_id:entityId,title,description,actor_name:actorName})
    const preferences=workspace?.current_user||{}
    const preferenceKey=eventType==='assignment.changed'?'notify_assignments':eventType==='comment.created'?'notify_comments':['status.changed','task.completed'].includes(eventType)?'notify_status_changes':null
    const inAppEnabled=preferences.notify_in_app===undefined||Boolean(Number(preferences.notify_in_app))
    const eventEnabled=!preferenceKey||preferences[preferenceKey]===undefined||Boolean(Number(preferences[preferenceKey]))
    if(notify&&inAppEnabled&&eventEnabled)await api.entities.create('notifications',{project_id:projectId,recipient_id:recipientId||workspace?.current_user?.id,event_type:eventType,entity_type:entityType,entity_id:entityId,title,body:description,is_read:false})
  }
  async function addEntity(type,data){
    if(type==='comments'?!permissions.comment:!permissions.editProject)return deny(type==='comments'?'Votre rôle ne permet pas de publier un message.':'Votre rôle dispose uniquement d’un accès en lecture.')
    const payload=type==='comments'?{...data,author_id:data.author_id||workspace?.current_user?.id}:data
    const item=await api.entities.create(type,{...payload,project_id:activeId})
    let meetingOutcomeCount=0
    if(type==='meetings'){
      const decisionRows=[]
      for(const title of outcomeLines(payload.decisions))decisionRows.push(await api.entities.create('decisions',{project_id:activeId,title,decision_date:String(payload.meeting_date||new Date().toISOString()).slice(0,10),context:`Décision issue de la réunion « ${item.title} »`,decision:title,status:'Décidée',linked_meeting_id:item.id,linked_task_id:payload.linked_task_id||null}))
      const actionRows=outcomeLines(payload.actions).map(parseMeetingAction)
      for(const [index,action] of actionRows.entries())await api.entities.create('action_items',{project_id:activeId,...action,source_type:'Réunion',source_label:item.title,priority:'Moyenne',status:'À faire',progress:0,linked_task_id:payload.linked_task_id||null,linked_meeting_id:item.id,linked_decision_id:decisionRows.length===1?decisionRows[0].id:decisionRows[index]?.id||null})
      meetingOutcomeCount=decisionRows.length+actionRows.length
    }
    if(!['activities','notifications','attachments','checklist_items','sprint_snapshots','custom_field_values'].includes(type)){
      const isComment=type==='comments', label=ENTITY_LABELS[type]||'Élément', name=item.title||item.name||item.body?.slice(0,55)||label
      await recordEvent({eventType:isComment?'comment.created':`${type}.created`,entityType:isComment?(item.entity_type||'project'):type,entityId:isComment?(item.entity_id||item.id):item.id,title:isComment?'Nouveau message dans le projet':`${label} créé`,description:isComment?`${item.author_name||'Un membre'} : ${item.body}`:name,notify:!isComment&&['tasks','risks','backlog_items'].includes(type)})
      if(isComment){
        const mentioned=Array.isArray(item.mentioned_user_ids)?item.mentioned_user_ids:(()=>{try{return JSON.parse(item.mentioned_user_ids||'[]')}catch{return []}})()
        const recipients=(workspace?.members||[]).filter(member=>member.id&&member.id!==workspace?.current_user?.id&&!member.invitation&&member.membership_status!=='Invitation en attente'&&(member.notify_in_app===undefined||Boolean(Number(member.notify_in_app)))&&(member.notify_comments===undefined||Boolean(Number(member.notify_comments))))
        for(const member of recipients){
          const isMentioned=mentioned.includes(member.id)
          await api.entities.create('notifications',{project_id:activeId,recipient_id:member.id,event_type:isMentioned?'mention.created':'comment.created',entity_type:item.entity_type||'project',entity_id:item.entity_id||item.id,title:isMentioned?`${item.author_name||'Un membre'} vous a mentionné`:'Nouveau message dans le projet',body:item.body,is_read:false})
        }
      }
    }
    setModal(null); await loadEntities(activeId); await loadProjects(false); if(type==='meetings'&&meetingOutcomeCount)setNotice(`${meetingOutcomeCount} résultat(s) de réunion relié(s) aux registres Décisions et Actions.`); return item
  }
  async function removeEntity(type,id){
    if(!permissions.deleteProjectContent)return deny('Seuls les responsables du projet peuvent supprimer cet élément.')
    const previous=entities[type]?.find(item=>item.id===id)
    await api.entities.remove(type,id)
    if(previous&&!['activities','notifications','comments','attachments','checklist_items','sprint_snapshots','custom_field_values'].includes(type))await recordEvent({eventType:`${type}.deleted`,entityType:type,entityId:id,title:`${ENTITY_LABELS[type]||'Élément'} supprimé`,description:previous.title||previous.name||'',notify:false})
    await loadEntities(activeId); await loadProjects(false)
  }
  async function updateEntity(type,id,data){
    if(!permissions.editProject)return deny('Votre rôle dispose uniquement d’un accès en lecture.')
    const previous=entities[type]?.find(item=>item.id===id)
    const item=await api.entities.update(type,id,data)
    const name=item?.title||item?.name||ENTITY_LABELS[type]||'Élément'
    let recorded=false
    if(previous&&data.status!==undefined&&previous.status!==item.status){await recordEvent({eventType:'status.changed',entityType:type,entityId:id,title:`${name} · ${item.status}`,description:`Statut modifié de « ${previous.status||'Non défini'} » vers « ${item.status} ».`});recorded=true}
    const oldAssignee=previous?.assignee||previous?.assignee_id, nextAssignee=item?.assignee||item?.assignee_id
    if(previous&&(data.assignee!==undefined||data.assignee_id!==undefined)&&oldAssignee!==nextAssignee){await recordEvent({eventType:'assignment.changed',entityType:type,entityId:id,title:`Nouvelle affectation · ${name}`,description:nextAssignee?`Assigné à ${item.assignee||'un membre de l’équipe'}.`:'Affectation retirée.'});recorded=true}
    if(previous&&type==='tasks'&&Number(previous.progress)<100&&Number(item.progress)===100){await recordEvent({eventType:'task.completed',entityType:type,entityId:id,title:`Activité terminée · ${name}`,description:'L’avancement a atteint 100 %.'});recorded=true}
    if(previous&&!recorded&&!['notifications','activities','checklist_items','sprint_snapshots','custom_field_values'].includes(type))await recordEvent({eventType:`${type}.updated`,entityType:type,entityId:id,title:`${ENTITY_LABELS[type]||'Élément'} mis à jour`,description:name,notify:false})
    if(type==='backlog_items'){
      const nextItems=entities.backlog_items.map(row=>row.id===id?item:row)
      const sprintIds=[...new Set([previous?.sprint_id,item?.sprint_id].filter(Boolean))]
      for(const sprintId of sprintIds)await createSprintSnapshot(sprintId,nextItems,false)
    }
    await loadEntities(activeId); await loadProjects(false)
    return item
  }
  async function createSprintSnapshot(sprintId,items=entities.backlog_items,reload=true){
    if(!sprintId||!activeId)return
    const sprintItems=items.filter(row=>row.sprint_id===sprintId)
    const completed=sprintItems.filter(row=>row.status==='Terminé')
    const total=sprintItems.reduce((sum,row)=>sum+Number(row.story_points||0),0)
    const done=completed.reduce((sum,row)=>sum+Number(row.story_points||0),0)
    await api.entities.create('sprint_snapshots',{project_id:activeId,sprint_id:sprintId,snapshot_date:new Date().toISOString().slice(0,10),total_points:total,remaining_points:Math.max(0,total-done),completed_points:done,item_count:sprintItems.length,completed_count:completed.length})
    if(reload)await loadEntities(activeId)
  }
  async function saveCustomValue(fieldId,entityType,entityId,value){const existing=entities.custom_field_values.find(row=>row.field_id===fieldId&&row.entity_type===entityType&&row.entity_id===entityId);return existing?updateEntity('custom_field_values',existing.id,{value_text:String(value??'')}):addEntity('custom_field_values',{field_id:fieldId,entity_type:entityType,entity_id:entityId,value_text:String(value??'')})}
  async function updateCharter(data){if(!permissions.manageProject)return deny('Votre rôle ne permet pas de modifier la charte.');await api.projects.update(activeId,data);await recordEvent({eventType:'project.updated',entityType:'projects',entityId:activeId,title:'Charte du projet mise à jour',description:data.name||active?.name,notify:false});await loadEntities(activeId);await loadProjects(false)}
  async function attachMedia(entityType,entityId){if(!permissions.editProject)return deny('Votre rôle dispose uniquement d’un accès en lecture.');await api.media.attach({project_id:activeId,entity_type:entityType,entity_id:entityId});await loadEntities(activeId)}
  async function updateBranding(data){if(!permissions.manageProject)return deny('Votre rôle ne permet pas de personnaliser ce projet.');await api.projects.update(activeId,{theme_color:data.theme_color});if(data.upload_logo)await api.projects.uploadLogo(activeId);setModal(null);await loadProjects(false)}
  async function renameWorkspace(data){if(!permissions.manageWorkspace)return deny('Seuls le propriétaire et les administrateurs peuvent modifier cet espace.');setWorkspace(await api.workspace.update(data))}
  async function updateNotificationPreferences(data){
    try{
      setError('')
      setWorkspace(await api.workspace.updatePreferences(data))
    }catch(reason){
      const message=reason?.message||'Impossible d’enregistrer les préférences de notification.'
      setError(message)
      throw reason
    }
  }
  async function updateProfile(data){
    try{setError('');setWorkspace(await api.workspace.updateProfile(data));setNotice('Profil enregistré.')}
    catch(reason){setError(reason.message||'Impossible de mettre à jour le profil.');throw reason}
  }
  async function startCheckout(data){
    if(!permissions.manageWorkspace)return deny('Seuls le propriétaire et les administrateurs peuvent gérer la facturation.')
    try{setError('');const result=await api.billing.createCheckout(data);if(!result?.checkout_url)throw new Error('Lien de paiement indisponible.');window.location.assign(result.checkout_url)}
    catch(reason){setError(reason.message||'Impossible de préparer le paiement.')}
  }
  async function submitManualPayment(data){
    if(!permissions.manageWorkspace)return deny('Seuls le propriétaire et les administrateurs peuvent gérer la facturation.')
    try{setError('');const result=await api.billing.submitManual(data);setWorkspace(result.workspace);setNotice(result.message||'Demande de paiement transmise.')}
    catch(reason){setError(reason.message||'Impossible de transmettre cette demande de paiement.');throw reason}
  }
  async function redeemPromotionCode(code){
    if(!permissions.manageWorkspace)return deny('Seuls le propriétaire et les administrateurs peuvent activer un code promotionnel.')
    try{setError('');const result=await api.billing.redeemPromotionCode(code);setWorkspace(result.workspace);setNotice(result.message||'Code promotionnel activé.');return result}
    catch(reason){setError(reason.message||'Impossible d’activer ce code promotionnel.');throw reason}
  }
  async function reviewManualPayment(data){
    try{setError('');const result=await api.billing.reviewManual(data);setWorkspace(result.workspace);setNotice(data.decision==='approved'?'Paiement confirmé et abonnement activé.':'Demande de paiement refusée.')}
    catch(reason){setError(reason.message||'Impossible de traiter cette demande.');throw reason}
  }
  async function analyzeProject(question){return api.assistant.analyze(activeId,question)}
  async function inviteMember(data){
    if(!permissions.inviteMembers)return deny('Votre rôle ne permet pas d’inviter des membres.')
    try { setError('');const next=await api.workspace.invite(data);setWorkspace(next);if(activeId&&data.project_ids?.includes(activeId)&&api.projects.access)setProjectAccess(await api.projects.access(activeId));setNotice(next?.invite_result?.message||'Invitation créée.');setInviteProject(null);setModal(null) }
    catch (reason) { setError(reason.message || "Impossible de créer l’invitation") }
  }
  async function removeMember(id){
    if(!permissions.manageWorkspace)return deny('Seuls le propriétaire et les administrateurs peuvent retirer un membre.')
    try { setError(''); setWorkspace(await api.workspace.removeMember(id)) }
    catch (reason) { setError(reason.message || "Impossible de retirer ce membre") }
  }
  const currentUser=workspace?.current_user
  const permissions=permissionsFor(currentUser?.role)
  const visibleProjectMembers=active?.access_mode==='restricted'
    ? (workspace?.members||[]).filter(member=>['Propriétaire','Administrateur'].includes(member.role)||(projectAccess?.members||[]).some(access=>access.user_id===member.id))
    : (workspace?.members||[])
  function deny(message){setError(message);return null}
  async function signOut(){try{setError('');setMobileNav(false);await cloudAuth.signOut()}catch(reason){setError(reason.message||'Impossible de vous déconnecter.')}}
  async function updateMemberRole(id,role){if(!permissions.manageWorkspace)return deny('Seuls le propriétaire et les administrateurs peuvent modifier les rôles.');try{setError('');setWorkspace(await api.workspace.updateMemberRole(id,role))}catch(reason){setError(reason.message||'Impossible de modifier ce rôle')}}
  async function saveProjectAccess(data){try{setError('');const next=await api.projects.setAccess(activeId,data);setProjectAccess(next);setProjects(rows=>rows.map(project=>project.id===activeId?{...project,access_mode:next.access_mode}:project));setNotice('Accès au projet mis à jour.');setModal(null)}catch(reason){setError(reason.message||'Impossible de modifier les accès.');throw reason}}
  function toggleTheme(){setDark(value=>{const next=!value;localStorage.setItem('kavelyo-theme',next?'dark':'light');return next})}
  function openProjectView(nextView,nextAgileTab){if(nextAgileTab)setAgileTab(nextAgileTab);setView(nextView);setMobileNav(false)}
  async function readNotification(id){await api.entities.update('notifications',id,{is_read:true});await loadEntities(activeId)}
  async function readAllNotifications(){await Promise.all(visibleNotifications.filter(item=>!Number(item.is_read)).map(item=>api.entities.update('notifications',item.id,{is_read:true})));await loadEntities(activeId)}
  const visibleNotifications=entities.notifications.filter(item=>!item.recipient_id||item.recipient_id===currentUser?.id)
  const unreadNotifications=visibleNotifications.filter(item=>!Number(item.is_read)).length
  const visibleNav=active?NAV.filter(([id])=>moduleAllowed(active.methodology,id)):NAV
  const currentPlan=workspace?.plans?.find(plan=>plan.code===(workspace?.subscription?.plan_code||'discovery'))
  const advancedAssistant=Boolean(currentPlan?.features?.assistant)

  return <div className={`app-shell${dark?' dark':''}${mobileNav?' mobile-nav-open':''}`}>
    {mobileNav&&<button className="mobile-nav-backdrop" aria-label="Fermer le menu" onClick={()=>setMobileNav(false)}/>}
    <aside className={`sidebar${mobileNav?' open':''}`}>
      <div className="brand"><img src="./assets/kavelyo-logo.png"/><div><strong>Kavelyo</strong><span>Pilotage de projets</span></div><button className="mobile-nav-close" aria-label="Fermer le menu" onClick={()=>setMobileNav(false)}><X size={21}/></button></div>
      <div className="workspace-label">ESPACE DE TRAVAIL</div>
      <button className="project-switcher" onClick={()=>{setModal('workspace-switcher');setMobileNav(false)}} style={{'--project-color':active?.theme_color||'#4f46e5'}}>{active?.logo_url?<img className="project-avatar project-logo" src={active.logo_url} alt=""/>:<span className="project-avatar">{active?.name?.[0]||workspace?.workspace?.name?.[0]||'J'}</span>}<span><b>{workspace?.workspace?.name||'Mon espace Kavelyo'}</b><small>{active?.name||'Aucun projet sélectionné'}</small></span><ChevronRight size={16}/></button>
      <nav>{visibleNav.map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>{setView(id);setMobileNav(false)}}><Icon size={18}/><span>{label}</span>{id==='risks'&&stats.critical>0?<em>{stats.critical}</em>:null}</button>)}</nav>
      <div className="sidebar-bottom">{workspace?.is_platform_admin&&<button className={view==='admin'?'active':''} onClick={()=>{setView('admin');setMobileNav(false)}}><Shield size={18}/>Administration SaaS</button>}<button className={view==='workspace'?'active':''} onClick={()=>{setView('workspace');setMobileNav(false)}}><Building2 size={18}/>Espace & accès</button><button onClick={()=>{setModal('projects');setMobileNav(false)}}><FolderKanban size={18}/>Tous les projets</button><button onClick={()=>{setView('settings');setMobileNav(false)}}><Settings size={18}/>Paramètres</button></div>
      <div className="user-chip"><div className="avatar">{(currentUser?.full_name||'CP').split(' ').map(part=>part[0]).slice(0,2).join('')}</div><div><b>{currentUser?.full_name||'Chef de projet'}</b><small>{currentUser?.role||'Administrateur local'}</small></div><MoreHorizontal size={17}/></div>
      {(isDesktopCloud||(!window.kavelyo&&new URLSearchParams(window.location.search).get('preview')!=='1'))&&<button className="sidebar-signout" onClick={signOut}><LogOut size={16}/><span>Déconnexion</span></button>}
    </aside>
    <main>
      <header className="app-header"><button className="icon-btn mobile-menu-btn" aria-label="Ouvrir le menu" onClick={()=>setMobileNav(true)}><Menu size={21}/></button><span className="mobile-header-brand"><img src="./assets/kavelyo-logo.png" alt=""/>Kavelyo</span><div className="search"><Search size={17}/><input placeholder="Rechercher dans le projet…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="icon-btn" title={dark?'Mode clair':'Mode sombre'} onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-btn notification-trigger" title="Notifications" onClick={()=>setNotificationOpen(value=>!value)}><Bell size={18}/>{unreadNotifications>0&&<span className="notification-badge">{unreadNotifications>9?'9+':unreadNotifications}</span>}</button>{permissions.createProject&&<button className="btn primary header-create" onClick={()=>setModal('project')}><Plus size={17}/><span>Créer</span></button>}{notificationOpen&&<NotificationCenter notifications={visibleNotifications} onRead={readNotification} onReadAll={readAllNotifications} onClose={()=>setNotificationOpen(false)}/>}</header>
      <section className={`content${active&&!['workspace','settings','admin'].includes(view)?' project-content':''}`} style={active?{'--project-color':active.theme_color||'#4f46e5'}:undefined}>
        {!online&&<div className="offline-banner"><Database size={16}/><span><b>Connexion interrompue</b> Les changements cloud reprendront après le retour du réseau.</span></div>}
        <SubscriptionNotice workspace={workspace} onOpen={()=>setView('workspace')}/>
        {error&&<div className="app-error">{error}<button onClick={()=>setError('')}>×</button></div>}
        {notice&&<div className="app-notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
        {view==='admin'&&workspace?.is_platform_admin ? <><div className="page-title"><div><span className="eyebrow">EXPLOITATION KAVELYO</span><h1>Administration SaaS</h1><p>Supervisez les comptes, abonnements, paiements et notifications.</p></div></div><AdminView plans={workspace.plans||[]} onLoad={api.admin.dashboard} onReadiness={api.admin.readiness} onMonitoring={api.admin.monitoring} onManageIncident={api.admin.manageIncident} onPrivacyRequests={api.admin.privacyRequests} onManagePrivacyRequest={api.admin.managePrivacyRequest} onManage={api.admin.manageSubscription} onCreatePromotion={api.admin.createPromotionCode} onSetPromotionActive={api.admin.setPromotionCodeActive} onUpdateChannel={api.admin.updateChannel}/></>
        : view==='workspace' ? <><div className="page-title"><div><span className="eyebrow">ORGANISATION</span><h1>Espace de travail</h1><p>Gérez les membres, les rôles et les canaux de notification.</p></div></div><WorkspaceView data={workspace} canManage={permissions.manageWorkspace} canInvite={permissions.inviteMembers} onRename={renameWorkspace} onInvite={()=>{setInviteProject(null);setModal('invite-member')}} onRemove={removeMember} onUpdateRole={updateMemberRole} onUpdatePreferences={updateNotificationPreferences} onCheckout={startCheckout} onRedeemPromotion={redeemPromotionCode} onManualPayment={submitManualPayment} onReviewPayment={reviewManualPayment}/></>
        : view==='settings' ? <><div className="page-title"><div><span className="eyebrow">APPLICATION</span><h1>Paramètres</h1><p>Votre profil et la configuration de cette installation.</p></div></div><SettingsView currentUser={currentUser} onUpdateProfile={updateProfile}/></>
        : !active ? <Empty canCreate={permissions.createProject} canInvite={permissions.inviteMembers} onCreate={()=>setModal('project')} onInvite={()=>setModal('invite-member')} onProfile={()=>setView('settings')}/> : <>
          <ProjectHeader active={active} view={view} agileTab={agileTab} members={visibleProjectMembers} canManage={Boolean(projectAccess?.can_manage)} canInvite={permissions.inviteMembers&&Boolean(projectAccess?.can_manage)} onNavigate={openProjectView} onAccess={()=>setModal('project-access')} onShare={()=>{setInviteProject(active);setModal('invite-member')}} onBranding={()=>setModal('branding')}/>
          {permissions.readOnly&&<div className="read-only-banner"><ShieldAlert size={15}/><span><b>Mode lecture seule</b> Votre rôle « {currentUser?.role} » permet de consulter le projet sans le modifier.</span></div>}
          {view!=='scrum'&&<div className="page-title compact-title"><div><span className="eyebrow">{active.code||'PROJET'}</span><h1>{view==='dashboard'?'Vue d’ensemble':view==='activity'?'Activité du projet':NAV.find(n=>n[0]===view)?.[1]||'Paramètres'}</h1><p>{view==='dashboard'?'Les signaux essentiels pour prendre les bonnes décisions.':view==='activity'?'Messages, notifications et historique des changements.':active.name}</p></div>{permissions.editProject&&['tasks','risks','team','meetings'].includes(view)&&<button className="btn primary" onClick={()=>setModal(view)}><Plus size={17}/>Ajouter</button>}</div>}
          {view==='dashboard'&&<Dashboard active={active} entities={entities} stats={stats} setView={setView} setAgileTab={setAgileTab}/>}
          {view==='impact'&&<ImpactCenter project={active} entities={entities} onCreate={addEntity} onDelete={removeEntity} onNavigate={target=>{if(target==='scrum')setAgileTab('backlog');setView(target)}}/>}
          {view==='assistant'&&<ProjectAssistant project={active} entities={entities} advancedAvailable={advancedAssistant} onAnalyze={analyzeProject} onNavigate={target=>{if(target==='scrum')setAgileTab('backlog');setView(target)}}/>}
          {view==='actions'&&<ActionTracker
            actions={entities.action_items} tasks={entities.tasks} risks={entities.risks} meetings={entities.meetings} decisions={entities.decisions}
            onCreate={data=>addEntity('action_items',data)} onUpdate={(id,data)=>updateEntity('action_items',id,data)} onDelete={id=>removeEntity('action_items',id)}/>
          }
          {view==='raid'&&<RaidCenter
            risks={entities.risks} issues={entities.issues} decisions={entities.decisions}
            dependencies={entities.task_dependencies} tasks={entities.tasks}/>
          }
          {view==='charter'&&<Charter project={active} onSave={updateCharter}/>}
          {view==='tasks'&&<Tasks methodology={active.methodology} rows={entities.tasks} dependencies={entities.task_dependencies} calendars={entities.work_calendars} items={entities.backlog_items} sprints={entities.sprints} team={entities.team} members={workspace?.members||[]} attachments={entities.attachments} comments={entities.comments} activities={entities.activities} checklist={entities.checklist_items} customFields={entities.custom_fields} customValues={entities.custom_field_values} currentUser={currentUser} query={query} onAttach={id=>attachMedia('tasks',id)} onComment={data=>addEntity('comments',data)} onAddChecklist={data=>addEntity('checklist_items',data)} onUpdateChecklist={(id,data)=>updateEntity('checklist_items',id,data)} onDeleteChecklist={id=>removeEntity('checklist_items',id)} onSaveCustomValue={saveCustomValue} onCreateDependency={data=>addEntity('task_dependencies',data)} onDeleteDependency={id=>removeEntity('task_dependencies',id)} onSaveCalendar={async data=>{const current=entities.work_calendars[0];return current?updateEntity('work_calendars',current.id,data):addEntity('work_calendars',data)}} onDelete={id=>removeEntity('tasks',id)} onUpdate={(id,data)=>updateEntity('tasks',id,data)}/>}
          {view==='scrum'&&<ScrumView
            project={active} sprints={entities.sprints} events={entities.scrum_events} eventEntries={entities.scrum_event_entries}
            items={entities.backlog_items} tasks={entities.tasks} attachments={entities.attachments} comments={entities.comments}
            activities={entities.activities} checklist={entities.checklist_items} customFields={entities.custom_fields} customValues={entities.custom_field_values}
            snapshots={entities.sprint_snapshots} team={entities.team} members={workspace?.members||[]} currentUser={currentUser}
            activeTab={agileTab} onTabChange={setAgileTab} onAttach={id=>attachMedia('backlog_items',id)} onComment={data=>addEntity('comments',data)}
            onAddChecklist={data=>addEntity('checklist_items',data)} onUpdateChecklist={(id,data)=>updateEntity('checklist_items',id,data)}
            onDeleteChecklist={id=>removeEntity('checklist_items',id)} onSaveCustomValue={saveCustomValue} onSnapshot={createSprintSnapshot}
            onCreate={addEntity} onUpdate={updateEntity} onDelete={removeEntity} onUpdateProject={updateCharter}
          />}
          {view==='suppliers'&&<SupplierManagement projectId={activeId} currency={active.currency||'XOF'} data={entities} tasks={entities.tasks} risks={entities.risks} onCreate={addEntity} onDelete={removeEntity} onReload={()=>loadEntities(activeId)}/>}
          {view==='finance'&&<FinancialView project={active} costs={entities.cost_entries} team={entities.team} tasks={entities.tasks} timeEntries={entities.time_entries} suppliers={entities.suppliers} onCreate={data=>addEntity('cost_entries',data)} onDelete={id=>removeEntity('cost_entries',id)} onUpdateProject={updateCharter}/>}
          {view==='governance'&&<GovernanceView project={active} changes={entities.change_requests} issues={entities.issues} decisions={entities.decisions} tasks={entities.tasks} risks={entities.risks} meetings={entities.meetings} onCreate={addEntity} onUpdate={updateEntity} onDelete={removeEntity}/>}
          {view==='stakeholders'&&<StakeholderManagement stakeholders={entities.stakeholders} raci={entities.raci_assignments} conflicts={entities.conflicts} communications={entities.communication_plans} tasks={entities.tasks} team={entities.team} onCreate={addEntity} onUpdate={updateEntity} onDelete={removeEntity}/>}
          {view==='reports'&&<ReportCenter project={active} entities={entities} onImport={importProjectArchive} onJiraImport={importJiraProject}/>}
          {view==='custom-fields'&&<CustomFieldsView fields={entities.custom_fields} canEdit={permissions.manageProject} onCreate={data=>addEntity('custom_fields',data)} onDelete={id=>removeEntity('custom_fields',id)}/>}
          {view==='risks'&&<Risks rows={entities.risks} tasks={entities.tasks} query={query} onDelete={id=>removeEntity('risks',id)}/>}
          {view==='team'&&<ResourceManagement members={entities.team} tasks={entities.tasks} entries={entities.time_entries} query={query} onCreateEntry={data=>addEntity('time_entries',data)} onUpdateEntry={(id,data)=>updateEntity('time_entries',id,data)} onDeleteEntry={id=>removeEntity('time_entries',id)} onDeleteMember={id=>removeEntity('team',id)}/>}
          {view==='meetings'&&<Meetings rows={entities.meetings} tasks={entities.tasks} decisions={entities.decisions} actions={entities.action_items} query={query} onDelete={id=>removeEntity('meetings',id)}/>}
          {view==='activity'&&<ActivityView project={active} comments={entities.comments} activities={entities.activities} members={workspace?.members||[]} currentUser={currentUser} onComment={data=>addEntity('comments',data)}/>}
        </>}
      </section>
    </main>
    {modal==='project'&&<Modal title="Créer un projet" onClose={()=>setModal(null)}><ProjectForm onSubmit={createProject} onCancel={()=>setModal(null)}/></Modal>}
    {modal==='projects'&&<Modal title="Portefeuille de projets" onClose={()=>setModal(null)}><div className="project-list">{projects.map(p=><button key={p.id} style={{'--project-color':p.theme_color||'#4f46e5'}} onClick={()=>{setActiveId(p.id);setModal(null);setView('dashboard')}}>{p.logo_url?<img className="portfolio-logo" src={p.logo_url} alt=""/>:<span className="portfolio-color">{p.name?.[0]||'P'}</span>}<span><b>{p.name}</b><small>{p.code||'Sans code'} · {p.status}</small></span><strong>{p.progress||0}%</strong><ChevronRight size={17}/></button>)}</div>{permissions.createProject&&<div className="form-actions"><button className="btn primary" onClick={()=>setModal('project')}><Plus size={17}/>Nouveau projet</button></div>}</Modal>}
    {modal==='workspace-switcher'&&<Modal title="Espaces de travail" onClose={()=>setModal(null)}><WorkspaceSwitcher items={workspaceOptions} currentId={workspace?.workspace?.id} onSelect={switchWorkspace} onCreate={api.workspace.create?()=>setModal('new-workspace'):null}/><div className="form-actions"><button className="btn ghost" onClick={()=>setModal('projects')}><FolderKanban size={16}/>Projets de cet espace</button></div></Modal>}
    {modal==='new-workspace'&&<Modal title="Créer un espace de travail" onClose={()=>setModal(null)}><CreateWorkspaceForm allowPersonal={!workspaceOptions.some(item=>item.account_type==='Personnel'&&item.role==='Propriétaire')} onSubmit={createWorkspace} onCancel={()=>setModal('workspace-switcher')}/></Modal>}
    {['tasks','risks','team','meetings'].includes(modal)&&<Modal title={configs[modal].title} onClose={()=>setModal(null)}><EntityForm type={modal} tasks={entities.tasks} members={workspace?.members||[]} onSubmit={d=>addEntity(modal,d)} onCancel={()=>setModal(null)}/></Modal>}
    {modal==='invite-member'&&<Modal title={inviteProject?`Partager « ${inviteProject.name} »`:'Inviter un membre'} onClose={()=>{setInviteProject(null);setModal(null)}}><InviteMemberForm project={inviteProject} onSubmit={inviteMember} onCancel={()=>{setInviteProject(null);setModal(null)}}/></Modal>}
    {modal==='project-access'&&<Modal title="Accès au projet" onClose={()=>setModal(null)}><ProjectAccessManager project={active} members={workspace?.members||[]} access={projectAccess} onSave={saveProjectAccess} onCancel={()=>setModal(null)}/></Modal>}
    {modal==='branding'&&<Modal title="Identité du projet" onClose={()=>setModal(null)}><ProjectBrandingForm project={active} onSubmit={updateBranding} onCancel={()=>setModal(null)}/></Modal>}
  </div>
}

const PROJECT_TABS=[
  ['dashboard',null,'Résumé',LayoutDashboard],['impact',null,'Impacts',Workflow],['assistant',null,'Assistant',Sparkles],['actions',null,'Actions',ListChecks],['raid',null,'RAID',Grid2X2],['tasks',null,'Planning prédictif',ChartNoAxesGantt],['scrum','board','Tableau Scrum',Columns3],['scrum','backlog','Backlog',ClipboardList],
  ['suppliers',null,'Fournisseurs',Truck],['finance',null,'Budget',CircleDollarSign],['reports',null,'Rapports',FileDown],['governance',null,'Gouvernance',Gavel],['stakeholders',null,'Parties prenantes',Building2],['risks',null,'Risques',ShieldAlert],['team',null,'Équipe',Users],['meetings',null,'Réunions',MessageSquareText],['activity',null,'Activité',Bell],
]

function ProjectHeader({active,view,agileTab,members,canManage,canInvite,onNavigate,onShare,onAccess,onBranding}){
  const tabs=PROJECT_TABS.filter(([target])=>moduleAllowed(active.methodology,target))
  return <div className="project-context">
    <div className="project-context-main">
      <div><span className="project-breadcrumb">Projets <ChevronRight size={13}/> {active.code||'Projet actif'}</span><div className="project-heading">{active.logo_url?<img className="project-mark project-logo" src={active.logo_url} alt={`Logo ${active.name}`}/>:<span className="project-mark">{active.name?.[0]||'J'}</span>}<div><h1>{active.name}</h1><p>{active.methodology||'Hybride'} · {active.status||'En cours'}</p></div></div></div>
      <div className="project-actions"><div className="member-stack">{members.slice(0,4).map((member,index)=><span key={member.id||index} title={member.full_name}>{(member.full_name||'M').split(' ').map(part=>part[0]).slice(0,2).join('')}</span>)}{members.length>4&&<em>+{members.length-4}</em>}</div>{canManage&&<button className="btn ghost" onClick={onAccess}><LockKeyhole size={15}/>Accès</button>}{canManage&&<button className="btn ghost" onClick={onBranding}><Palette size={15}/>Personnaliser</button>}{canInvite&&<button className="btn ghost" onClick={onShare}><Share2 size={15}/>Partager</button>}</div>
    </div>
    <nav className="project-tabs">{tabs.map(([target,subtab,label,Icon])=>{const selected=view===target&&(!subtab||agileTab===subtab);return <button key={`${target}-${subtab||''}`} className={selected?'active':''} onClick={()=>onNavigate(target,subtab)}><Icon size={15}/>{label}</button>})}<button className="project-tab-more"><MoreHorizontal size={16}/></button></nav>
  </div>
}

function ProjectBrandingForm({project,onSubmit,onCancel}){const [color,setColor]=useState(project.theme_color||'#4f46e5'),[uploadLogo,setUploadLogo]=useState(false);return <form onSubmit={event=>{event.preventDefault();onSubmit({theme_color:color,upload_logo:uploadLogo})}}><div className="branding-preview" style={{'--project-color':color}}>{project.logo_url?<img src={project.logo_url} alt=""/>:<span>{project.name?.[0]||'P'}</span>}<div><h3>{project.name}</h3><p>Aperçu de l’identité du projet</p></div></div><div className="form-grid"><label>Couleur principale<span className="color-field"><input type="color" value={color} onChange={event=>setColor(event.target.value)}/><b>{color}</b></span></label><label className="logo-choice"><input type="checkbox" checked={uploadLogo} onChange={event=>setUploadLogo(event.target.checked)}/><span><b>Choisir un nouveau logo</b><small>PNG, JPG ou WebP au moment d’enregistrer</small></span></label></div><div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary">Enregistrer l’identité</button></div></form>}

function Empty({onCreate,onInvite,onProfile,canCreate=true,canInvite=false}){return <div className="empty onboarding-empty"><img src="./assets/kavelyo-logo.png"/><span className="eyebrow">PREMIERS PAS</span><h1>Bienvenue dans Kavelyo</h1><p>{canCreate?'Votre espace est prêt. Suivez ces trois étapes pour lancer votre premier projet.':'Aucun projet ne vous a encore été rendu accessible.'}</p>{canCreate&&<div className="onboarding-steps"><button onClick={onProfile}><i>1</i><span><b>Compléter mon profil</b><small>Fonction, téléphone et fuseau horaire.</small></span><ChevronRight/></button><button onClick={onCreate}><i>2</i><span><b>Créer mon premier projet</b><small>Méthode prédictive, Scrum ou hybride.</small></span><ChevronRight/></button><button onClick={onInvite} disabled={!canInvite}><i>3</i><span><b>Inviter mon équipe</b><small>Attribuer les rôles et les accès.</small></span><ChevronRight/></button></div>}</div>}

function SubscriptionNotice({workspace,onOpen}){
  const subscription=workspace?.subscription||{},end=subscription.current_period_end||workspace?.workspace?.trial_ends_at
  const days=end?Math.ceil((new Date(end)-new Date())/86400000):null
  if(!workspace||subscription.plan_code==='discovery'||subscription.status==='preview')return null
  const graceDays=days===null?null:days+3
  const promotionEnded=subscription.provider==='promotion'&&days!==null&&days<=0
  const manuallySuspended=subscription.status==='past_due'&&(days===null||days>0)
  const locked=['canceled','suspended'].includes(subscription.status)||promotionEnded||manuallySuspended||(days!==null&&graceDays<=0)
  const grace=subscription.provider!=='promotion'&&days!==null&&days<=0&&!locked
  if(!locked&&!grace&&(days===null||days>7))return null
  const title=locked?'Espace en lecture seule':grace?'Délai de grâce en cours':'Votre abonnement arrive à échéance'
  const message=locked
    ? ' Vos données restent accessibles. Renouvelez l’abonnement pour reprendre les modifications.'
    : grace
      ? ` Il reste ${Math.max(1,graceDays)} jour${graceDays>1?'s':''} avant le passage en lecture seule.`
      : ` Il reste ${Math.max(0,days)} jour${days>1?'s':''}.`
  return <button className={`subscription-notice ${locked?'locked':grace?'expired':''}`} onClick={onOpen}><ShieldAlert size={16}/><span><b>{title}</b>{message}</span><ChevronRight size={16}/></button>
}

function Dashboard({active,entities,stats,setView,setAgileTab}){
  const isScrum=active.methodology==='Scrum',workItems=isScrum?entities.backlog_items.filter(item=>item.item_type!=='Epic'):entities.tasks
  const upcoming=[...workItems].filter(item=>item.status!=='Terminé'&&item.due_date).sort((a,b)=>(a.due_date||'').localeCompare(b.due_date||'')).slice(0,4)
  const today=new Date().toISOString().slice(0,10),openActions=(entities.action_items||[]).filter(item=>!['Terminée','Annulée'].includes(item.status)),lateActions=openActions.filter(item=>item.due_date&&item.due_date<today)
  const overdue=workItems.filter(item=>item.status!=='Terminé'&&item.due_date&&String(item.due_date).slice(0,10)<today),blocked=workItems.filter(item=>['Bloqué','En attente'].includes(item.status))
  const actualCost=entities.cost_entries.reduce((sum,row)=>sum+Number(row.actual_amount||0),0),budget=Number(active.budget||0),budgetState=budget&&actualCost>budget?'danger':budget&&actualCost>=budget*.85?'warning':'good'
  const scheduleState=overdue.length?'warning':'good',teamState=blocked.length?'warning':'good',scopeState=entities.change_requests.some(row=>!['Approuvée','Rejetée','Annulée'].includes(row.status))?'warning':'good'
  const overallState=stats.critical||budgetState==='danger'?'danger':[scheduleState,budgetState,teamState,scopeState].includes('warning')?'warning':'good'
  const openDelivery=()=>{if(isScrum){setAgileTab('backlog');setView('scrum')}else setView('tasks')}
  return <>
    <DailyBrief entities={entities} onOpenTasks={openDelivery} onOpenActions={()=>setView('actions')} onOpenRisks={()=>setView('risks')}/>
    <div className="kpi-grid">
      <Kpi icon={Target} label="Avancement global" value={`${stats.progress}%`} note={`${stats.done}/${stats.total} ${isScrum?'éléments terminés':'activités terminées'}`} color="indigo" progress={stats.progress}/>
      <Kpi icon={Clock3} label="Échéance cible" value={date(active.end_date)} note={active.status} color="blue"/>
      <Kpi icon={CircleDollarSign} label="Budget de référence" value={money(active.budget,active.currency||'XOF')} note={`${entities.cost_entries.length} ligne(s) de coûts suivie(s)`} color="teal"/>
      <Kpi icon={ShieldAlert} label="Risques critiques" value={stats.critical} note={`${entities.risks.filter(r=>r.status!=='Fermé').length} risques ouverts`} color="orange"/>
    </div>
    <div className="dashboard-command-grid">
      <section className="card command-actions"><div className="command-icon"><ListChecks size={20}/></div><div><small>ENGAGEMENTS</small><h3>Actions à piloter</h3><p><b>{lateActions.length}</b> en retard · <b>{openActions.length}</b> ouvertes</p></div><button onClick={()=>setView('actions')}>Ouvrir les actions<ChevronRight size={15}/></button></section>
      <section className="card command-raid"><div className="command-icon"><Grid2X2 size={20}/></div><div><small>SURVEILLANCE</small><h3>Registre RAID</h3><p><b>{stats.critical}</b> risques critiques · <b>{entities.issues.filter(row=>!['Résolu','Clos'].includes(row.status)).length}</b> problèmes ouverts</p></div><button onClick={()=>setView('raid')}>Ouvrir le RAID<ChevronRight size={15}/></button></section>
      <section className="card command-report"><div className="command-icon"><FileDown size={20}/></div><div><small>COMMUNICATION</small><h3>Rapport hebdomadaire</h3><p>PDF, PowerPoint et exports Excel à jour.</p></div><button onClick={()=>setView('reports')}>Préparer le rapport<ChevronRight size={15}/></button></section>
    </div>
    <div className="dashboard-grid">
      <section className="card span-2"><CardHead title={isScrum?'Flux de livraison Scrum':'Trajectoire du projet'} action={isScrum?'Ouvrir le backlog':'Ouvrir le planning'} onClick={openDelivery}/><div className="trajectory"><div className="donut" style={{'--progress':`${stats.progress*3.6}deg`}}><span><b>{stats.progress}%</b><small>réalisé</small></span></div><div className="phase-list">{(isScrum?['Product Backlog','Sprint','Review','Incrément']:['Initialisation','Planification','Exécution','Clôture']).map((p,i)=><div key={p} className={i<2?'complete':i===2?'current':''}><span>{i<2?<CheckCircle2 size={17}/>:i+1}</span><div><b>{p}</b><small>{i<2?'Validée':i===2?'Phase actuelle':'À venir'}</small></div></div>)}</div></div></section>
      <section className="card"><CardHead title="Santé calculée du projet"/><div className="health-panel"><div className={`health-big ${overallState}`}>{overallState==='good'?'Bonne':overallState==='warning'?'À surveiller':'Critique'}</div>{[['Périmètre',scopeState],['Délais',scheduleState],['Budget',budgetState],['Équipe',teamState]].map(([l,s])=><div className="health-row" key={l}><span>{l}</span><b className={s}>{s==='good'?'Maîtrisé':s==='danger'?'Critique':'Attention'}</b></div>)}</div></section>
      <section className="card span-2"><CardHead title={isScrum?'Éléments avec date cible':'Prochaines échéances'} action="Tout afficher" onClick={openDelivery}/>{upcoming.length?<div className="timeline-list">{upcoming.map(t=><div key={t.id}><span className={`priority-dot ${t.priority?.toLowerCase()}`}></span><div><b>{t.title}</b><small>{t.assignee||'Non assigné'}</small></div><strong>{date(t.due_date)}</strong><span className="pill">{t.status}</span></div>)}</div>:<EmptyRow text={isScrum?'Aucune date cible dans le backlog':'Aucune échéance planifiée'}/>}</section>
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
  return <form className="card charter" onSubmit={save}><div className="section-title"><FileText size={20}/><div><h3>Charte de projet</h3><p>Le mandat qui aligne le sponsor, l’équipe et les parties prenantes.</p></div></div><div className="form-grid"><label>Code<input name="code" value={form.code||''} onChange={change}/></label><label>Statut<select name="status" value={form.status||''} onChange={change}>{['Initialisation','Planification','Exécution','Surveillance','Clôture','Archivé'].map(x=><option key={x}>{x}</option>)}</select></label><label>Mode de pilotage<select name="methodology" value={form.methodology||'Hybride'} onChange={change}><option>Hybride</option><option>Scrum</option><option>Prédictif</option></select></label><label>Sponsor<input name="sponsor" value={form.sponsor||''} onChange={change}/></label><label>Chef de projet<input name="manager" value={form.manager||''} onChange={change}/></label><label>Budget de référence<input type="number" min="0" name="budget" value={form.budget||''} onChange={change}/></label><label>Devise<select name="currency" value={form.currency||'XOF'} onChange={change}><option value="XOF">FCFA (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar (USD)</option><option value="GBP">Livre sterling (GBP)</option></select></label><label className="span-2">Description<textarea name="description" value={form.description||''} onChange={change}/></label><label className="span-2">Objectif principal<textarea name="objective" value={form.objective||''} onChange={change}/></label><label className="span-2">Critères de succès<textarea name="success_criteria" value={form.success_criteria||''} onChange={change}/></label><label>Début<input type="date" name="start_date" value={form.start_date||''} onChange={change}/></label><label>Fin cible<input type="date" name="end_date" value={form.end_date||''} onChange={change}/></label></div><div className="form-actions"><span className={saved?'save-state visible':'save-state'}>Enregistré localement</span><button className="btn primary">Enregistrer la charte</button></div></form>
}

const match=(row,q)=>!q||Object.values(row).some(v=>String(v||'').toLowerCase().includes(q.toLowerCase()))
function Table({columns,rows,query,onDelete,onRowClick,empty}){return <div className="card table-card"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}<th></th></tr></thead><tbody>{rows.filter(r=>match(r,query)).map(row=><tr key={row.id} className={onRowClick?'clickable-row':''} onClick={()=>onRowClick?.(row)}>{columns.map(c=><td key={c.key}>{c.render?c.render(row[c.key],row):row[c.key]||'—'}</td>)}<td><button className="row-delete" title="Supprimer" onClick={event=>{event.stopPropagation();onDelete(row.id)}}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!rows.length&&<EmptyRow text={empty}/>}</div>}
const status=v=><span className={`status ${String(v).toLowerCase().replaceAll(' ','-')}`}>{v||'—'}</span>
function Tasks({methodology,rows,dependencies=[],calendars=[],items,sprints,team,members,attachments=[],comments=[],activities=[],checklist=[],customFields=[],customValues=[],currentUser,query,onAttach,onComment,onAddChecklist,onUpdateChecklist,onDeleteChecklist,onSaveCustomValue,onCreateDependency,onDeleteDependency,onSaveCalendar,onDelete,onUpdate}){
  const [mode,setMode]=useState('calendar')
  const [discussion,setDiscussion]=useState(null)
  const [selected,setSelected]=useState(null)
  const setBaseline=async()=>{await Promise.all(rows.filter(t=>t.start_date&&t.due_date).map(t=>onUpdate(t.id,{baseline_start:t.start_date,baseline_end:t.due_date}))) }
  return <>
    <div className="method-boundary predictive"><ChartNoAxesGantt size={17}/><div><b>Planning prédictif</b><span>WBS, jalons, calendrier ouvré, dépendances FS/SS/FF/SF et chemin critique.</span></div>{methodology==='Hybride'&&<em>Mode hybride · les User Stories peuvent être reliées aux activités, sans mélanger les deux méthodes.</em>}</div>
    <div className="planning-toolbar"><div className="view-toggle"><button className={mode==='calendar'?'active':''} onClick={()=>setMode('calendar')}><CalendarDays size={15}/>Calendrier</button><button className={mode==='gantt'?'active':''} onClick={()=>setMode('gantt')}><CalendarRange size={15}/>Gantt</button><button className={mode==='list'?'active':''} onClick={()=>setMode('list')}><List size={15}/>Liste</button><button className={mode==='settings'?'active':''} onClick={()=>setMode('settings')}><Settings size={15}/>Temps de travail</button></div><span>Calendrier, dépendances et trajectoire critique synchronisés.</span></div>
    {mode === 'calendar'
      ? <MonthCalendar rows={rows.filter(r=>match(r,query))}/>
      : mode === 'gantt'
        ? <GanttView rows={rows.filter(r=>match(r,query))} dependencies={dependencies} calendar={calendars[0]} team={team} onSetBaseline={setBaseline}/>
        : mode === 'settings'
          ? <PlanningSettings calendar={calendars[0]} onSave={onSaveCalendar}/>
          : <Table rows={rows} query={query} onDelete={onDelete} onRowClick={setSelected} empty="Ajoutez la première activité du planning." columns={[{key:'wbs_code',label:'WBS'},{key:'title',label:'Activité',render:(v,r)=><b className="task-title-cell">{r.is_milestone&&<Diamond size={11} fill="currentColor"/>}{v}</b>},{key:'visuals',label:'Rendus',render:(_,r)=><VisualCell files={attachments.filter(file=>file.entity_type==='tasks'&&file.entity_id===r.id)} onAttach={()=>onAttach(r.id)}/>},{key:'comments',label:'Messages',render:(_,r)=>{const count=comments.filter(item=>item.entity_type==='tasks'&&item.entity_id===r.id).length;return <button className="comment-link" onClick={event=>{event.stopPropagation();setDiscussion(r)}}><MessageSquareText size={13}/>{count}</button>}},{key:'status',label:'Statut',render:status},{key:'priority',label:'Priorité'},{key:'assignee',label:'Responsable'},{key:'due_date',label:'Échéance',render:date},{key:'progress',label:'Avancement',render:v=><div className="progress-cell"><i><span style={{width:`${v||0}%`}}/></i><b>{v||0}%</b></div>}]}/>
    }
    {discussion&&<Modal title="Discussion de l’activité" onClose={()=>setDiscussion(null)}><EntityDiscussion entity={discussion} entityType="tasks" comments={comments} members={members} currentUser={currentUser} onComment={onComment}/></Modal>}
    {selected&&<Modal title="Fiche complète de l’activité" onClose={()=>setSelected(null)}><WorkItemDetails item={rows.find(row=>row.id===selected.id)||selected} type="tasks" tasks={rows} dependencies={dependencies} items={items} sprints={sprints} members={members} attachments={attachments} comments={comments} activities={activities} checklist={checklist} customFields={customFields} customValues={customValues} currentUser={currentUser} onUpdate={onUpdate} onCreateDependency={onCreateDependency} onDeleteDependency={onDeleteDependency} onAttach={()=>onAttach(selected.id)} onComment={onComment} onAddChecklist={onAddChecklist} onUpdateChecklist={onUpdateChecklist} onDeleteChecklist={onDeleteChecklist} onSaveCustomValue={onSaveCustomValue}/></Modal>}
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
function Meetings({rows,tasks,decisions=[],actions=[],query,onDelete}){return <div className="meeting-list">{rows.filter(r=>match(r,query)).map(m=>{const linkedDecisions=decisions.filter(row=>row.linked_meeting_id===m.id),linkedActions=actions.filter(row=>row.linked_meeting_id===m.id);return <article className="card meeting" key={m.id}><div className="meeting-date"><b>{m.meeting_date?new Date(m.meeting_date).getDate():'—'}</b><span>{m.meeting_date?new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(new Date(m.meeting_date)):'Date'}</span></div><div><h3>{m.title}</h3><p>{m.agenda||'Aucun ordre du jour'}</p><small><Users size={14}/>{m.participants||'Participants non précisés'}</small>{m.linked_task_id&&<div className="linked-task">Activité liée · <b>{tasks.find(t=>t.id===m.linked_task_id)?.title||'Activité supprimée'}</b></div>}{(linkedDecisions.length>0||linkedActions.length>0)&&<div className="meeting-outcomes"><span><Gavel size={13}/><b>{linkedDecisions.length}</b> décision(s) consignée(s)</span><span><ListChecks size={13}/><b>{linkedActions.length}</b> action(s) suivie(s)</span></div>}{m.decisions&&!linkedDecisions.length&&<div className="decision"><b>Décisions</b>{m.decisions}</div>}</div><button className="row-delete" onClick={()=>onDelete(m.id)}><Trash2 size={16}/></button></article>})}{!rows.length&&<div className="card"><EmptyRow text="Planifiez votre première réunion."/></div>}</div>}
function SettingsView({currentUser,onUpdateProfile}){
  const [info,setInfo]=useState(null),[form,setForm]=useState({}),[saved,setSaved]=useState(false)
  useEffect(()=>{api.system.info().then(setInfo)},[])
  useEffect(()=>setForm({full_name:currentUser?.full_name||'',phone:currentUser?.phone||'',job_title:currentUser?.job_title||'',timezone:currentUser?.timezone||'Africa/Abidjan'}),[currentUser])
  const cloud=isCloudConfigured&&(!window.kavelyo||isDesktopCloud)
  const switchDesktopMode=mode=>{localStorage.setItem('kavelyo-desktop-mode',mode);window.location.reload()}
  const save=async event=>{event.preventDefault();try{await onUpdateProfile(form);setSaved(true);setTimeout(()=>setSaved(false),1600)}catch{}}
  return <div className="settings-layout">
    <form className="card settings-card" onSubmit={save}><div className="section-title"><Users size={20}/><div><h3>Mon profil</h3><p>Ces informations sont visibles par les membres de vos espaces.</p></div></div><div className="form-grid"><label>Nom complet<input required minLength="2" maxLength="80" value={form.full_name||''} onChange={event=>setForm({...form,full_name:event.target.value})}/></label><label>Fonction<input value={form.job_title||''} onChange={event=>setForm({...form,job_title:event.target.value})} placeholder="Ex. Chef de projet"/></label><label>Téléphone<input type="tel" value={form.phone||''} onChange={event=>setForm({...form,phone:event.target.value})}/></label><label>Fuseau horaire<select value={form.timezone||'Africa/Abidjan'} onChange={event=>setForm({...form,timezone:event.target.value})}><option>Africa/Abidjan</option><option>Africa/Dakar</option><option>Africa/Casablanca</option><option>Europe/Paris</option><option>America/Montreal</option></select></label></div><div className="form-actions"><span className={saved?'save-state visible':'save-state'}>Profil enregistré</span><button className="btn primary">Enregistrer mon profil</button></div></form>
    <div className="card settings-card"><div className="section-title"><Database size={20}/><div><h3>{cloud?'Données cloud':'Données locales'}</h3><p>{cloud?'Vos projets sont isolés dans l’espace de votre organisation.':'Vos projets restent sur cet ordinateur.'}</p></div></div><div className="setting-row"><span>Emplacement de la base</span><code>{info?.dataPath||'Chargement…'}</code></div><div className="setting-row"><span>Version de Kavelyo</span><b>{info?.version||'0.17.1'}</b></div><div className="local-banner"><HardDrive size={19}/><div><b>{cloud?'Mode SaaS connecté':'Stockage local'}</b><p>{cloud?'Authentification, PostgreSQL et stockage sécurisé sont activés.':'Aucun compte et aucun serveur distant ne sont nécessaires pour cette version.'}</p></div></div>{window.kavelyo&&<div className="form-actions"><button className="btn ghost" onClick={()=>switchDesktopMode(cloud?'local':'cloud')}>{cloud?'Utiliser la base locale':'Connecter ce poste à Kavelyo Cloud'}</button>{cloud&&<button className="btn ghost" onClick={()=>cloudAuth.signOut()}>Se déconnecter</button>}</div>}{!window.kavelyo&&cloud&&<div className="form-actions"><button className="btn ghost" onClick={()=>cloudAuth.signOut()}>Se déconnecter</button></div>}</div>
    {cloud&&<PrivacyCenter/>}
  </div>
}
