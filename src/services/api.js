const makeMemory=()=>({ projects: [], tasks: [], task_dependencies: [], work_calendars: [], risks: [], team: [], meetings: [], sprints: [], scrum_events: [], scrum_event_entries: [], backlog_items: [], attachments: [], suppliers: [], procurements: [], supplier_quotes: [], supplier_contracts: [], supplier_evaluations: [], supplier_documents: [], comments: [], activities: [], notifications: [], checklist_items: [], sprint_snapshots: [], time_entries: [], cost_entries: [], change_requests: [], issues: [], decisions: [], stakeholders: [], raci_assignments: [], conflicts: [], communication_plans: [], custom_fields: [], custom_field_values: [], project_links: [] })
let memory=makeMemory()
const browserUser = { id: 'browser-user', membership_id: 'browser-owner', membership_status: 'Actif', full_name: 'Chef de projet', role: 'Propriétaire', notify_email: 1, notify_whatsapp: 0, notify_in_app: 1, notify_assignments: 1, notify_status_changes: 1, notify_comments: 1, daily_digest: 1, quiet_start: '20:00', quiet_end: '07:00' }
const previewPlans = [
  { code: 'discovery', name: 'Découverte', account_type: 'Personnel', monthly_price_xof: 0, annual_price_xof: 0, min_seats: 1, features: { projects: 2, storage_mb: 250 } },
  { code: 'personal_pro', name: 'Personnel Pro', account_type: 'Personnel', monthly_price_xof: 5000, annual_price_xof: 50000, min_seats: 1, features: { projects: -1, storage_mb: 2048, email_reminders: true } },
  { code: 'team', name: 'Équipe', account_type: 'Organisation', monthly_price_xof: 6000, annual_price_xof: 60000, min_seats: 3, features: { projects: -1, storage_mb: 10240, collaboration: true } },
  { code: 'business', name: 'Business', account_type: 'Organisation', monthly_price_xof: 9000, annual_price_xof: 90000, min_seats: 10, features: { projects: -1, storage_mb: 51200, automation: true, assistant: true, assistant_monthly_runs: 100 } },
]
const makeBrowserWorkspace=({id,name,account_type='Personnel'})=>({ workspace: { id, name, mode: 'local', account_type, subscription_plan: 'Découverte', subscription_status: 'Aperçu', seat_limit: account_type==='Organisation'?3:1, trial_ends_at: null }, members: [{...browserUser,membership_id:`${id}-owner`}], current_user: {...browserUser,membership_id:`${id}-owner`}, subscription: { plan_code: 'discovery', status: 'preview', seats: account_type==='Organisation'?3:1 }, plans: previewPlans, billing_transactions: [], billing_available: false, automatic_billing_available: false, manual_payment_methods: [], manual_plan_prices: [], manual_payment_requests: [], is_platform_admin: false, platform_payment_requests: [], usage: { projects: 0 } })
let browserWorkspace=makeBrowserWorkspace({id:'browser',name:'Mon espace Kavelyo'})
const previewWorkspaces=[browserWorkspace]
const previewMemories=new Map([['browser',memory]])
const previewWorkspaceList=()=>previewWorkspaces.map(state=>({...state.workspace,role:state.current_user.role,project_count:previewMemories.get(state.workspace.id)?.projects.length||0}))

const chooseImages = multiple => new Promise(resolve => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = multiple
  input.onchange = () => resolve([...input.files || []]); input.click()
})
const asDataUrl = file => new Promise((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file) })

const previewApi = {
  admin: { dashboard: async () => ({metrics:{},workspaces:[],channels:[],recent_failures:[],promotion_codes:[]}), readiness:async()=>({checks:[],summary:{ready:0,total:0,required_ready:0,required_total:0}}), monitoring:async()=>({metrics:{},services:[],incidents:[],recent_events:[],security_signals:[],top_routes:[],backup_checks:[]}), manageIncident:async()=>({}), privacyRequests:async()=>[], managePrivacyRequest:async()=>({}), manageSubscription: async()=>({}), createPromotionCode:async()=>({}), setPromotionCodeActive:async()=>({}), updateChannel: async()=>({}) },
  privacy: {list:async()=>[],export:async()=>({mode:'aperçu',profile:browserUser}),submit:async()=>({}),cancel:async()=>true},
  realtime: { subscribeProject: () => () => {} },
  assistant: { analyze: async () => { throw new Error('L’analyse approfondie sera disponible dans la version SaaS Business.') } },
  billing: { redeemPromotionCode:async()=>{throw new Error('Les codes promotionnels nécessitent un compte connecté.')}, createCheckout: async () => { throw new Error('Le paiement sera disponible dans la version SaaS connectée.') }, submitManual: async () => { throw new Error('Le paiement manuel nécessite un compte connecté.') }, reviewManual: async () => { throw new Error('Cette action nécessite un compte administrateur.') } },
  workspace: {
    get: async () => { browserWorkspace.usage.projects = memory.projects.length; return browserWorkspace },
    list: async () => previewWorkspaceList(),
    select: async id => { const selected=previewWorkspaces.find(state=>state.workspace.id===id);if(!selected)throw new Error('Espace de travail introuvable.');browserWorkspace=selected;memory=previewMemories.get(id);browserWorkspace.usage.projects=memory.projects.length;return browserWorkspace },
    create: async data => { const id=crypto.randomUUID(),state=makeBrowserWorkspace({id,name:data.name,account_type:data.account_type});previewWorkspaces.push(state);previewMemories.set(id,makeMemory());browserWorkspace=state;memory=previewMemories.get(id);return browserWorkspace },
    updateProfile: async data => { Object.assign(browserUser,browserWorkspace.current_user,data);const member=browserWorkspace.members.find(item=>item.id===browserUser.id);if(member)Object.assign(member,data);return browserWorkspace },
    update: async (data) => { Object.assign(browserWorkspace.workspace, data); return browserWorkspace },
    invite: async (data) => { browserWorkspace.members.push({ ...data, id: crypto.randomUUID(), membership_id: crypto.randomUUID(), membership_status: 'Invitation en attente' }); return browserWorkspace },
    updateMemberRole: async (id, role) => { const member=browserWorkspace.members.find(item=>item.membership_id===id);if(member&&member.role!=='Propriétaire')member.role=role;return browserWorkspace },
    removeMember: async (id) => { browserWorkspace.members = browserWorkspace.members.filter(member => member.membership_id !== id); return browserWorkspace },
    updatePreferences: async data => { Object.assign(browserUser,browserWorkspace.current_user,data);const member=browserWorkspace.members.find(item=>item.id===browserUser.id);if(member)Object.assign(member,data);return browserWorkspace },
  },
  projects: {
    list: async () => memory.projects,
    create: async (data) => { const now = new Date().toISOString(); const item = { ...data, created_by:browserUser.id, project_access:[{user_id:browserUser.id,access_role:'manager',full_name:browserUser.full_name}], id: crypto.randomUUID(), status: 'Initialisation', health: 'good', progress: 0, task_count: 0, open_risks: 0, created_at: now, updated_at: now }; memory.projects.push(item); browserWorkspace.usage.projects = memory.projects.length; return item },
    access: async id => {const project=memory.projects.find(item=>item.id===id);return {project_id:id,access_mode:project?.access_mode||'restricted',can_manage:true,members:project?.project_access||[]}},
    setAccess: async (id,data) => {const project=memory.projects.find(item=>item.id===id);project.access_mode=data.access_mode;project.project_access=data.members.map(member=>({...member,full_name:browserWorkspace.members.find(row=>row.id===member.user_id)?.full_name}));return {project_id:id,access_mode:project.access_mode,can_manage:true,members:project.project_access}},
    update: async (id, data) => {
      const project=Object.assign(memory.projects.find(x => x.id === id), data, { updated_at: new Date().toISOString() })
      if ('currency' in data) ['procurements','supplier_quotes','supplier_contracts'].forEach(type=>memory[type].filter(row=>row.project_id===id).forEach(row=>{row.currency=project.currency||'XOF'}))
      return project
    },
    uploadLogo: async id => { const [file]=await chooseImages(false);if(!file)return null;return Object.assign(memory.projects.find(x=>x.id===id),{logo_url:await asDataUrl(file),logo_path:file.name}) },
  },
  media: {
    attach: async metadata => { const files=await chooseImages(true);const rows=await Promise.all(files.map(async file=>({...metadata,id:crypto.randomUUID(),file_name:file.name,mime_type:file.type,size_bytes:file.size,url:await asDataUrl(file)})));memory.attachments.push(...rows);return rows },
  },
  entities: {
    list: async (type, projectId) => memory[type].filter(x => x.project_id === projectId),
    create: async (type, data) => { const now = new Date().toISOString(); const project=memory.projects.find(item=>item.id===data.project_id);const payload=['procurements','supplier_quotes','supplier_contracts'].includes(type)?{...data,currency:project?.currency||'XOF'}:data; const item = { ...payload, id: crypto.randomUUID(), created_at: now, updated_at: now }; memory[type].push(item); return item },
    update: async (type, id, data) => { const current=memory[type].find(x => x.id === id);const project=memory.projects.find(item=>item.id===current?.project_id);const payload=['procurements','supplier_quotes','supplier_contracts'].includes(type)?{...data,currency:project?.currency||'XOF'}:data;return Object.assign(current,payload,{ updated_at:new Date().toISOString() }) },
    remove: async (type, id) => { memory[type] = memory[type].filter(x => x.id !== id);if(type==='tasks')memory.task_dependencies=memory.task_dependencies.filter(link=>link.task_id!==id&&link.predecessor_task_id!==id);if(type==='custom_fields')memory.custom_field_values=memory.custom_field_values.filter(value=>value.field_id!==id);return { ok: true } },
  },
  supplierDocuments: {
    attach: async (metadata) => { const item = { ...metadata, id: crypto.randomUUID(), file_name: 'document-local.pdf' }; memory.supplier_documents.push(item); return item },
    open: async () => ({ ok: true }),
    reveal: async () => ({ ok: true }),
  },
  system: { info: async () => ({ dataPath: 'Mode navigateur', version: '0.17.1' }) },
}

const isPreviewMode = !window.kavelyo && new URLSearchParams(window.location.search).get('preview') === '1'
const desktopMode=localStorage.getItem('kavelyo-desktop-mode')||localStorage.getItem('jalonis-desktop-mode')
if(desktopMode&&!localStorage.getItem('kavelyo-desktop-mode'))localStorage.setItem('kavelyo-desktop-mode',desktopMode)
export const isDesktopCloud = Boolean(window.kavelyo) && desktopMode === 'cloud'

export const api = window.kavelyo && !isDesktopCloud ? window.kavelyo : (isPreviewMode || !isCloudConfigured ? previewApi : cloudApi)
import { cloudApi } from './cloudApi'
import { isCloudConfigured } from './supabase'

