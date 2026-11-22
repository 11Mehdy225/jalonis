import { supabase } from './supabase'

let cachedWorkspaceId = null
let cachedUserId = null
const realtimeProjectTables=['tasks','task_dependencies','work_calendars','risks','team','meetings','sprints','backlog_items','attachments','suppliers','procurements','supplier_quotes','supplier_contracts','supplier_evaluations','supplier_documents','comments','activities','notifications','checklist_items','sprint_snapshots','time_entries','cost_entries','change_requests','issues','decisions','stakeholders','raci_assignments','conflicts','communication_plans','custom_fields','custom_field_values']

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

const optional = (request, fallback=[]) => request.then(({data,error}) => error ? fallback : (data ?? fallback))

async function currentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

async function workspaceId() {
  const user = await currentUser()
  if (cachedWorkspaceId&&cachedUserId===user.id) return cachedWorkspaceId
  const storageKey=`jalonis-workspace:${user.id}`
  const preferred=localStorage.getItem(storageKey)
  if(preferred){
    const membership=unwrap(await supabase.from('workspace_members').select('workspace_id').eq('workspace_id',preferred).eq('user_id',user.id).eq('status','Actif').maybeSingle())
    if(membership){cachedWorkspaceId=preferred;cachedUserId=user.id;return preferred}
    localStorage.removeItem(storageKey)
  }
  const rows = unwrap(await supabase.from('workspace_members').select('workspace_id,created_at').eq('user_id', user.id).eq('status', 'Actif').order('created_at',{ascending:false}).limit(1))
  if (!rows[0]) throw new Error("Aucun espace de travail actif n’est associé à ce compte")
  cachedWorkspaceId = rows[0].workspace_id
  cachedUserId = user.id
  localStorage.setItem(storageKey,cachedWorkspaceId)
  return cachedWorkspaceId
}

async function listWorkspaces(){
  const user=await currentUser()
  const memberships=unwrap(await supabase.from('workspace_members').select('workspace_id,role,status,created_at').eq('user_id',user.id).eq('status','Actif').order('created_at'))
  if(!memberships.length)return []
  const ids=memberships.map(item=>item.workspace_id)
  const [spaces,projects]=await Promise.all([
    supabase.from('workspaces').select('*').in('id',ids).then(unwrap),
    supabase.from('projects').select('workspace_id').in('workspace_id',ids).then(unwrap),
  ])
  return memberships.map(membership=>({...spaces.find(space=>space.id===membership.workspace_id),role:membership.role,project_count:projects.filter(project=>project.workspace_id===membership.workspace_id).length})).filter(space=>space.id)
}

async function selectWorkspace(id){
  const user=await currentUser()
  const membership=unwrap(await supabase.from('workspace_members').select('workspace_id').eq('workspace_id',id).eq('user_id',user.id).eq('status','Actif').maybeSingle())
  if(!membership)throw new Error("Vous n’avez pas accès à cet espace de travail.")
  cachedWorkspaceId=id;cachedUserId=user.id;localStorage.setItem(`jalonis-workspace:${user.id}`,id)
  return workspaceState()
}

async function workspaceState() {
  const id = await workspaceId()
  const user=await currentUser()
  const [workspace, memberships, invitations, subscription, plans, projectCount, billingTransactions, paymentMethods, manualPrices, manualRequests, platformAdmin, onlineProvider, providerPrices] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', id).single().then(unwrap),
    supabase.from('workspace_members').select('*').eq('workspace_id', id).order('created_at').then(unwrap),
    supabase.from('workspace_invitations').select('*').eq('workspace_id', id).eq('status', 'En attente').gt('expires_at',new Date().toISOString()).order('created_at').then(unwrap),
    supabase.from('subscriptions').select('*').eq('workspace_id', id).maybeSingle().then(unwrap),
    supabase.from('plan_catalog').select('*').eq('active', true).order('monthly_price_eur').then(unwrap),
    supabase.from('projects').select('id',{count:'exact',head:true}).eq('workspace_id',id).then(({count,error})=>{if(error)throw error;return count||0}),
    supabase.from('billing_transactions').select('*').eq('workspace_id',id).order('created_at',{ascending:false}).limit(8).then(unwrap),
    optional(supabase.from('manual_payment_methods').select('*').eq('active',true).order('sort_order')),
    optional(supabase.from('manual_plan_prices').select('*').eq('active',true)),
    optional(supabase.from('manual_payment_requests').select('*,manual_payment_methods(name,channel),plan_catalog(name)').eq('workspace_id',id).order('created_at',{ascending:false}).limit(8)),
    optional(supabase.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle(),null),
    optional(supabase.from('billing_provider_settings').select('provider,display_name,payment_method,currency').eq('active',true).maybeSingle(),null),
    optional(supabase.from('provider_plan_prices').select('*').eq('active',true)),
  ])
  const profileIds = memberships.map(item => item.user_id)
  const profiles = profileIds.length ? unwrap(await supabase.from('profiles').select('*').in('id', profileIds)) : []
  const members = memberships.map(membership => ({
    ...profiles.find(profile => profile.id === membership.user_id),
    membership_id: membership.id,
    role: membership.role,
    membership_status: membership.status,
  }))
  invitations.forEach(invitation => members.push({
    id: `invitation-${invitation.id}`,
    membership_id: `invitation-${invitation.id}`,
    full_name: invitation.full_name || invitation.email,
    email: invitation.email,
    phone: invitation.phone,
    role: invitation.role,
    membership_status: 'Invitation en attente',
    notify_email: 1,
    notify_whatsapp: 0,
    invitation: true,
  }))
  let platformRequests=[]
  if(platformAdmin)platformRequests=await optional(supabase.from('manual_payment_requests').select('*,manual_payment_methods(name,channel),plan_catalog(name),workspaces(name)').eq('status','pending').order('created_at').limit(100))
  return { workspace, subscription, plans, billing_transactions: billingTransactions, billing_available: true, automatic_billing_available: Boolean(onlineProvider), billing_provider: onlineProvider, provider_plan_prices: providerPrices.filter(price=>price.provider===onlineProvider?.provider), manual_payment_methods: paymentMethods, manual_plan_prices: manualPrices, manual_payment_requests: manualRequests, is_platform_admin: Boolean(platformAdmin), platform_payment_requests: platformRequests, usage: { projects: projectCount }, members, current_user: members.find(member => member.id === user.id) || null }
}

async function listProjects() {
  const id = await workspaceId()
  const projects = unwrap(await supabase.from('projects').select('*').eq('workspace_id', id).order('updated_at', { ascending: false }))
  if (!projects.length) return []
  const ids = projects.map(project => project.id)
  const [tasks, risks] = await Promise.all([
    supabase.from('tasks').select('project_id,progress,status').in('project_id', ids).then(unwrap),
    supabase.from('risks').select('project_id,status').in('project_id', ids).then(unwrap),
  ])
  const hydrated = await Promise.all(projects.map(async project => {
    const projectTasks = tasks.filter(task => task.project_id === project.id)
    let logo_url = null
    if (project.logo_path) {
      const signed = unwrap(await supabase.storage.from('workspace-files').createSignedUrl(project.logo_path, 3600))
      logo_url = signed.signedUrl
    }
    return {
      ...project,
      logo_url,
      task_count: projectTasks.length,
      progress: projectTasks.length ? Math.round(projectTasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / projectTasks.length) : 0,
      open_risks: risks.filter(risk => risk.project_id === project.id && risk.status !== 'Fermé').length,
    }
  }))
  return hydrated
}

async function selectFile() {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => resolve(input.files?.[0] || null)
    input.click()
  })
}

async function selectImages(multiple=true) {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp,image/gif'
    input.multiple = multiple
    input.onchange = () => resolve([...input.files || []])
    input.click()
  })
}

export const cloudApi = {
  assistant: {
    analyze: async (projectId, question) => {
      const {data,error}=await supabase.functions.invoke('project-assistant',{body:{project_id:projectId,question}})
      if(error){let message=data?.error||error.message||"Impossible d’analyser le projet";try{const details=await error.context?.json();message=details?.error||message}catch{}throw new Error(message)}
      if(data?.error)throw new Error(data.error)
      return data
    },
  },
  billing: {
    createCheckout: async data => {
      const id=await workspaceId()
      const provider=String(data.provider||'jeko')
      const functionName=provider==='flutterwave'?'create-billing-checkout':'create-jeko-checkout'
      const {data:result,error}=await supabase.functions.invoke(functionName,{body:{...data,workspace_id:id}})
      if(error){let message=result?.error||error.message||'Impossible de préparer le paiement';try{const details=await error.context?.json();message=details?.error||message}catch{}throw new Error(message)}
      if(result?.error)throw new Error(result.error)
      return result
    },
    submitManual: async data => {
      const id=await workspaceId()
      const {data:result,error}=await supabase.functions.invoke('submit-manual-payment',{body:{...data,workspace_id:id}})
      if(error){let message=result?.error||error.message||'Impossible de transmettre le paiement';try{const details=await error.context?.json();message=details?.error||message}catch{}throw new Error(message)}
      if(result?.error)throw new Error(result.error)
      return {...result,workspace:await workspaceState()}
    },
    reviewManual: async data => {
      const {data:result,error}=await supabase.functions.invoke('review-manual-payment',{body:data})
      if(error){let message=result?.error||error.message||'Impossible de traiter le paiement';try{const details=await error.context?.json();message=details?.error||message}catch{}throw new Error(message)}
      if(result?.error)throw new Error(result.error)
      return {...result,workspace:await workspaceState()}
    },
  },
  realtime: {
    subscribeProject: (projectId, onChange) => {
      const channel=supabase.channel(`project-${projectId}-${crypto.randomUUID()}`)
      realtimeProjectTables.forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`project_id=eq.${projectId}`},payload=>onChange?.({table,payload})))
      channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'projects',filter:`id=eq.${projectId}`},payload=>onChange?.({table:'projects',payload}))
      channel.subscribe()
      return () => { supabase.removeChannel(channel) }
    },
  },
  workspace: {
    get: workspaceState,
    list: listWorkspaces,
    select: selectWorkspace,
    create: async data => {
      const {data:result,error}=await supabase.functions.invoke('create-workspace',{body:data})
      if(error){let message=result?.error||error.message||"Impossible de créer cet espace";try{const details=await error.context?.json();message=details?.error||message}catch{}throw new Error(message)}
      if(result?.error)throw new Error(result.error)
      return selectWorkspace(result.workspace_id)
    },
    updateProfile: async data => {
      const user=await currentUser(),allowed=['full_name','phone','job_title','timezone']
      const profile=Object.fromEntries(Object.entries(data).filter(([key])=>allowed.includes(key)))
      unwrap(await supabase.from('profiles').update(profile).eq('id',user.id))
      return workspaceState()
    },
    update: async data => {
      const id = await workspaceId()
      unwrap(await supabase.from('workspaces').update({ name: data.name, account_type: data.account_type }).eq('id', id))
      return workspaceState()
    },
    invite: async data => {
      const id = await workspaceId()
      const {data:result,error}=await supabase.functions.invoke('invite-member',{body:{...data,workspace_id:id}})
      if(error){let message=result?.error||error.message||"Impossible d’envoyer l’invitation";try{const details=await error.context?.json();message=details?.error||message}catch{}throw new Error(message)}
      if(result?.error)throw new Error(result.error)
      return {...await workspaceState(),invite_result:result}
    },
    removeMember: async membershipId => {
      if (String(membershipId).startsWith('invitation-')) {
        unwrap(await supabase.from('workspace_invitations').delete().eq('id', String(membershipId).replace('invitation-', '')))
      } else {
        unwrap(await supabase.from('workspace_members').delete().eq('id', membershipId).neq('role', 'Propriétaire'))
      }
      return workspaceState()
    },
    updateMemberRole: async (membershipId, role) => {
      if (String(membershipId).startsWith('invitation-')) unwrap(await supabase.from('workspace_invitations').update({ role }).eq('id', String(membershipId).replace('invitation-', '')))
      else unwrap(await supabase.from('workspace_members').update({ role }).eq('id', membershipId).neq('role', 'Propriétaire'))
      return workspaceState()
    },
    updatePreferences: async data => {
      const user = await currentUser()
      const allowed = ['phone','notify_email','notify_whatsapp','notify_in_app','notify_assignments','notify_status_changes','notify_comments','daily_digest','quiet_start','quiet_end']
      const preferences = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)))
      unwrap(await supabase.from('profiles').update(preferences).eq('id', user.id))
      return workspaceState()
    },
  },
  projects: {
    list: listProjects,
    create: async data => {
      const id = await workspaceId()
      return unwrap(await supabase.from('projects').insert({ ...data, workspace_id: id, status: 'Initialisation', health: 'good' }).select().single())
    },
    update: async (id, data) => unwrap(await supabase.from('projects').update(data).eq('id', id).select().single()),
    uploadLogo: async projectId => {
      const [file] = await selectImages(false)
      if (!file) return null
      const id = await workspaceId()
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${id}/${projectId}/branding/logo-${crypto.randomUUID()}.${extension}`
      unwrap(await supabase.storage.from('workspace-files').upload(path, file, { contentType: file.type, upsert: false }))
      return unwrap(await supabase.from('projects').update({ logo_path: path }).eq('id', projectId).select().single())
    },
  },
  entities: {
    list: async (type, projectId) => {
      const rows = unwrap(await supabase.from(type).select('*').eq('project_id', projectId).order('created_at', { ascending: false }))
      if (type !== 'attachments') return rows
      return Promise.all(rows.map(async attachment => {
        const signed = unwrap(await supabase.storage.from('workspace-files').createSignedUrl(attachment.stored_path, 3600))
        return { ...attachment, url: signed.signedUrl }
      }))
    },
    create: async (type, data) => unwrap(await supabase.from(type).insert(data).select().single()),
    update: async (type, id, data) => unwrap(await supabase.from(type).update(data).eq('id', id).select().single()),
    remove: async (type, id) => { unwrap(await supabase.from(type).delete().eq('id', id)); return { ok: true } },
  },
  media: {
    attach: async metadata => {
      const files = await selectImages(true)
      if (!files.length) return []
      const id = await workspaceId()
      return Promise.all(files.map(async file => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${id}/${metadata.project_id}/visuals/${metadata.entity_type}/${metadata.entity_id}/${crypto.randomUUID()}-${safeName}`
        unwrap(await supabase.storage.from('workspace-files').upload(path, file, { contentType: file.type, upsert: false }))
        return unwrap(await supabase.from('attachments').insert({ ...metadata, file_name: file.name, mime_type: file.type, stored_path: path, size_bytes: file.size }).select().single())
      }))
    },
  },
  supplierDocuments: {
    attach: async metadata => {
      const file = await selectFile()
      if (!file) return null
      const id = await workspaceId()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${id}/${metadata.project_id}/${crypto.randomUUID()}-${safeName}`
      unwrap(await supabase.storage.from('workspace-files').upload(path, file, { contentType: file.type, upsert: false }))
      return unwrap(await supabase.from('supplier_documents').insert({ ...metadata, file_name: file.name, stored_path: path }).select().single())
    },
    open: async documentId => {
      const document = unwrap(await supabase.from('supplier_documents').select('stored_path').eq('id', documentId).single())
      const signed = unwrap(await supabase.storage.from('workspace-files').createSignedUrl(document.stored_path, 120))
      window.open(signed.signedUrl, '_blank', 'noopener,noreferrer')
      return { ok: true }
    },
    reveal: async documentId => cloudApi.supplierDocuments.open(documentId),
  },
  system: { info: async () => ({ dataPath: 'PostgreSQL et stockage sécurisé', version: 'Web SaaS' }) },
}
