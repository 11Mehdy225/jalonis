const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jalonis', {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (data) => ipcRenderer.invoke('projects:create', data),
    update: (id, data) => ipcRenderer.invoke('projects:update', id, data),
    uploadLogo: (id) => ipcRenderer.invoke('project-logo:attach', id),
  },
  media: {
    attach: (metadata) => ipcRenderer.invoke('media:attach', metadata),
  },
  workspace: {
    get: () => ipcRenderer.invoke('workspace:get'),
    list: () => ipcRenderer.invoke('workspaces:list'),
    select: (id) => ipcRenderer.invoke('workspaces:select', id),
    create: (data) => ipcRenderer.invoke('workspaces:create', data),
    updateProfile: (data) => ipcRenderer.invoke('workspace-profile:update', data),
    update: (data) => ipcRenderer.invoke('workspace:update', data),
    invite: (data) => ipcRenderer.invoke('workspace-members:create', data),
    updateMemberRole: (membershipId, role) => ipcRenderer.invoke('workspace-members:update-role', membershipId, role),
    removeMember: (membershipId) => ipcRenderer.invoke('workspace-members:remove', membershipId),
    updatePreferences: (data) => ipcRenderer.invoke('workspace-preferences:update', data),
  },
  entities: {
    list: (type, projectId) => ipcRenderer.invoke('entities:list', type, projectId),
    create: (type, data) => ipcRenderer.invoke('entities:create', type, data),
    update: (type, id, data) => ipcRenderer.invoke('entities:update', type, id, data),
    remove: (type, id) => ipcRenderer.invoke('entities:delete', type, id),
  },
  supplierDocuments: {
    attach: (metadata) => ipcRenderer.invoke('supplier-documents:attach', metadata),
    open: (id) => ipcRenderer.invoke('supplier-documents:open', id),
    reveal: (id) => ipcRenderer.invoke('supplier-documents:reveal', id),
  },
  system: {
    info: () => ipcRenderer.invoke('system:info'),
  },
})
