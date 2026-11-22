const memory = { projects: [], tasks: [], task_dependencies: [], work_calendars: [], risks: [], team: [], meetings: [], sprints: [], backlog_items: [], attachments: [], suppliers: [], procurements: [], supplier_quotes: [], supplier_contracts: [], supplier_evaluations: [], supplier_documents: [], comments: [], activities: [], notifications: [], checklist_items: [], sprint_snapshots: [], time_entries: [], cost_entries: [], change_requests: [], issues: [], decisions: [], stakeholders: [], raci_assignments: [], conflicts: [], communication_plans: [], custom_fields: [], custom_field_values: [] }
const browserUser = { id: 'browser-user', membership_id: 'browser-owner', membership_status: 'Actif', full_name: 'Chef de projet', role: 'Propriétaire', notify_email: 1, notify_whatsapp: 0, notify_in_app: 1, notify_assignments: 1, notify_status_changes: 1, notify_comments: 1, daily_digest: 1, quiet_start: '20:00', quiet_end: '07:00' }
const browserWorkspace = { workspace: { id: 'browser', name: 'Mon espace Jalonis', mode: 'local' }, members: [browserUser], current_user: browserUser }

const chooseImages = multiple => new Promise(resolve => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = multiple
  input.onchange = () => resolve([...input.files || []]); input.click()
})
const asDataUrl = file => new Promise((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file) })

const previewApi = {
  realtime: { subscribeProject: () => () => {} },
  workspace: {
    get: async () => browserWorkspace,
    update: async (data) => { Object.assign(browserWorkspace.workspace, data); return browserWorkspace },
    invite: async (data) => { browserWorkspace.members.push({ ...data, id: crypto.randomUUID(), membership_id: crypto.randomUUID(), membership_status: 'Invitation en attente' }); return browserWorkspace },
    updateMemberRole: async (id, role) => { const member=browserWorkspace.members.find(item=>item.membership_id===id);if(member&&member.role!=='Propriétaire')member.role=role;return browserWorkspace },
    removeMember: async (id) => { browserWorkspace.members = browserWorkspace.members.filter(member => member.membership_id !== id); return browserWorkspace },
    updatePreferences: async data => { Object.assign(browserUser, data); return browserWorkspace },
  },
  projects: {
    list: async () => memory.projects,
    create: async (data) => { const now = new Date().toISOString(); const item = { ...data, id: crypto.randomUUID(), status: 'Initialisation', health: 'good', progress: 0, task_count: 0, open_risks: 0, created_at: now, updated_at: now }; memory.projects.push(item); return item },
    update: async (id, data) => Object.assign(memory.projects.find(x => x.id === id), data, { updated_at: new Date().toISOString() }),
    uploadLogo: async id => { const [file]=await chooseImages(false);if(!file)return null;return Object.assign(memory.projects.find(x=>x.id===id),{logo_url:await asDataUrl(file),logo_path:file.name}) },
  },
  media: {
    attach: async metadata => { const files=await chooseImages(true);const rows=await Promise.all(files.map(async file=>({...metadata,id:crypto.randomUUID(),file_name:file.name,mime_type:file.type,size_bytes:file.size,url:await asDataUrl(file)})));memory.attachments.push(...rows);return rows },
  },
  entities: {
    list: async (type, projectId) => memory[type].filter(x => x.project_id === projectId),
    create: async (type, data) => { const now = new Date().toISOString(); const item = { ...data, id: crypto.randomUUID(), created_at: now, updated_at: now }; memory[type].push(item); return item },
    update: async (type, id, data) => Object.assign(memory[type].find(x => x.id === id), data, { updated_at: new Date().toISOString() }),
    remove: async (type, id) => { memory[type] = memory[type].filter(x => x.id !== id);if(type==='tasks')memory.task_dependencies=memory.task_dependencies.filter(link=>link.task_id!==id&&link.predecessor_task_id!==id);if(type==='custom_fields')memory.custom_field_values=memory.custom_field_values.filter(value=>value.field_id!==id);return { ok: true } },
  },
  supplierDocuments: {
    attach: async (metadata) => { const item = { ...metadata, id: crypto.randomUUID(), file_name: 'document-local.pdf' }; memory.supplier_documents.push(item); return item },
    open: async () => ({ ok: true }),
    reveal: async () => ({ ok: true }),
  },
  system: { info: async () => ({ dataPath: 'Mode navigateur', version: '0.1.0' }) },
}

const isPreviewMode = !window.jalonis && new URLSearchParams(window.location.search).get('preview') === '1'

export const api = window.jalonis || (isPreviewMode || !isCloudConfigured ? previewApi : cloudApi)
import { cloudApi } from './cloudApi'
import { isCloudConfigured } from './supabase'

