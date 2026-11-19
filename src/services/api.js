const memory = { projects: [], tasks: [], risks: [], team: [], meetings: [], sprints: [], backlog_items: [], attachments: [], suppliers: [], procurements: [], supplier_quotes: [], supplier_contracts: [], supplier_evaluations: [], supplier_documents: [] }
const browserWorkspace = { workspace: { id: 'browser', name: 'Mon espace Jalonis', mode: 'local' }, members: [], current_user: null }

const chooseImages = multiple => new Promise(resolve => {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = multiple
  input.onchange = () => resolve([...input.files || []]); input.click()
})
const asDataUrl = file => new Promise((resolve,reject) => { const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file) })

const previewApi = {
  workspace: {
    get: async () => browserWorkspace,
    update: async (data) => { Object.assign(browserWorkspace.workspace, data); return browserWorkspace },
    invite: async (data) => { browserWorkspace.members.push({ ...data, id: crypto.randomUUID(), membership_id: crypto.randomUUID(), membership_status: 'Invitation en attente' }); return browserWorkspace },
    removeMember: async (id) => { browserWorkspace.members = browserWorkspace.members.filter(member => member.membership_id !== id); return browserWorkspace },
  },
  projects: {
    list: async () => memory.projects,
    create: async (data) => { const item = { ...data, id: crypto.randomUUID(), status: 'Initialisation', health: 'good', progress: 0, task_count: 0, open_risks: 0 }; memory.projects.push(item); return item },
    update: async (id, data) => Object.assign(memory.projects.find(x => x.id === id), data),
    uploadLogo: async id => { const [file]=await chooseImages(false);if(!file)return null;return Object.assign(memory.projects.find(x=>x.id===id),{logo_url:await asDataUrl(file),logo_path:file.name}) },
  },
  media: {
    attach: async metadata => { const files=await chooseImages(true);const rows=await Promise.all(files.map(async file=>({...metadata,id:crypto.randomUUID(),file_name:file.name,mime_type:file.type,size_bytes:file.size,url:await asDataUrl(file)})));memory.attachments.push(...rows);return rows },
  },
  entities: {
    list: async (type, projectId) => memory[type].filter(x => x.project_id === projectId),
    create: async (type, data) => { const item = { ...data, id: crypto.randomUUID() }; memory[type].push(item); return item },
    update: async (type, id, data) => Object.assign(memory[type].find(x => x.id === id), data),
    remove: async (type, id) => { memory[type] = memory[type].filter(x => x.id !== id); return { ok: true } },
  },
  supplierDocuments: {
    attach: async (metadata) => { const item = { ...metadata, id: crypto.randomUUID(), file_name: 'document-local.pdf' }; memory.supplier_documents.push(item); return item },
    open: async () => ({ ok: true }),
    reveal: async () => ({ ok: true }),
  },
  system: { info: async () => ({ dataPath: 'Mode navigateur', version: '0.1.0' }) },
}

export const api = window.jalonis || (isCloudConfigured ? cloudApi : previewApi)
import { cloudApi } from './cloudApi'
import { isCloudConfigured } from './supabase'

