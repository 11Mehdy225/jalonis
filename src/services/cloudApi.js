import { supabase } from './supabase'

let cachedWorkspaceId = null

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user
}

async function workspaceId() {
  if (cachedWorkspaceId) return cachedWorkspaceId
  const user = await currentUser()
  const rows = unwrap(await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).eq('status', 'Actif').limit(1))
  if (!rows[0]) throw new Error("Aucun espace de travail actif n’est associé à ce compte")
  cachedWorkspaceId = rows[0].workspace_id
  return cachedWorkspaceId
}

async function workspaceState() {
  const id = await workspaceId()
  const [workspace, memberships, invitations, user] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', id).single().then(unwrap),
    supabase.from('workspace_members').select('*').eq('workspace_id', id).order('created_at').then(unwrap),
    supabase.from('workspace_invitations').select('*').eq('workspace_id', id).eq('status', 'En attente').order('created_at').then(unwrap),
    currentUser(),
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
  return { workspace, members, current_user: members.find(member => member.id === user.id) || null }
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
  return projects.map(project => {
    const projectTasks = tasks.filter(task => task.project_id === project.id)
    return {
      ...project,
      task_count: projectTasks.length,
      progress: projectTasks.length ? Math.round(projectTasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / projectTasks.length) : 0,
      open_risks: risks.filter(risk => risk.project_id === project.id && risk.status !== 'Fermé').length,
    }
  })
}

async function selectFile() {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => resolve(input.files?.[0] || null)
    input.click()
  })
}

export const cloudApi = {
  workspace: {
    get: workspaceState,
    update: async data => {
      const id = await workspaceId()
      unwrap(await supabase.from('workspaces').update({ name: data.name, account_type: data.account_type }).eq('id', id))
      return workspaceState()
    },
    invite: async data => {
      const id = await workspaceId()
      const user = await currentUser()
      unwrap(await supabase.from('workspace_invitations').insert({
        workspace_id: id,
        email: String(data.email).trim().toLowerCase(),
        full_name: data.full_name,
        phone: data.phone || null,
        role: data.role || 'Membre',
        invited_by: user.id,
      }))
      return workspaceState()
    },
    removeMember: async membershipId => {
      if (String(membershipId).startsWith('invitation-')) {
        unwrap(await supabase.from('workspace_invitations').delete().eq('id', String(membershipId).replace('invitation-', '')))
      } else {
        unwrap(await supabase.from('workspace_members').delete().eq('id', membershipId).neq('role', 'Propriétaire'))
      }
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
  },
  entities: {
    list: async (type, projectId) => unwrap(await supabase.from(type).select('*').eq('project_id', projectId).order('created_at', { ascending: false })),
    create: async (type, data) => unwrap(await supabase.from(type).insert(data).select().single()),
    update: async (type, id, data) => unwrap(await supabase.from(type).update(data).eq('id', id).select().single()),
    remove: async (type, id) => { unwrap(await supabase.from(type).delete().eq('id', id)); return { ok: true } },
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
