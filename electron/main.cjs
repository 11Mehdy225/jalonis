const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { JalonisDatabase } = require('./database.cjs')

let database
const externalProtocol = url => { try { return ['https:','http:','mailto:'].includes(new URL(url).protocol) } catch { return false } }

const imageMime = filePath => ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'}[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
const dataUrl = filePath => fs.existsSync(filePath) ? `data:${imageMime(filePath)};base64,${fs.readFileSync(filePath).toString('base64')}` : null

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'Jalonis',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) win.loadURL('http://localhost:5173')
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  win.webContents.setWindowOpenHandler(({ url }) => { if(externalProtocol(url))shell.openExternal(url);return { action: 'deny' } })
  win.webContents.on('will-navigate',(event,url)=>{const current=win.webContents.getURL();if(url!==current){event.preventDefault();if(externalProtocol(url))shell.openExternal(url)}})
}

app.whenReady().then(() => {
  if(process.platform==='win32')app.setAppUserModelId('com.jalonis.desktop')
  database = new JalonisDatabase(path.join(app.getPath('userData'), 'jalonis.sqlite'))
  ipcMain.handle('projects:list', () => database.listProjects().map(project => ({ ...project, logo_url: project.logo_path ? dataUrl(project.logo_path) : null })))
  ipcMain.handle('projects:create', (_, data) => database.createProject(data))
  ipcMain.handle('projects:update', (_, id, data) => database.updateProject(id, data))
  ipcMain.handle('workspace:get', () => database.getWorkspace())
  ipcMain.handle('workspaces:list', () => database.listWorkspaces())
  ipcMain.handle('workspaces:select', (_, id) => database.selectWorkspace(id))
  ipcMain.handle('workspaces:create', (_, data) => database.createWorkspace(data))
  ipcMain.handle('workspace-profile:update', (_, data) => database.updateCurrentUserProfile(data))
  ipcMain.handle('workspace:update', (_, data) => database.updateWorkspace(data))
  ipcMain.handle('workspace-members:create', (_, data) => database.createWorkspaceMember(data))
  ipcMain.handle('workspace-members:update-role', (_, membershipId, role) => database.updateWorkspaceMemberRole(membershipId, role))
  ipcMain.handle('workspace-members:remove', (_, membershipId) => database.removeWorkspaceMember(membershipId))
  ipcMain.handle('workspace-preferences:update', (_, data) => database.updateCurrentUserPreferences(data))
  ipcMain.handle('entities:list', (_, type, projectId) => database.listEntities(type, projectId).map(item => type === 'attachments' ? { ...item, url: dataUrl(item.stored_path) } : item))
  ipcMain.handle('entities:create', (_, type, data) => database.createEntity(type, data))
  ipcMain.handle('entities:update', (_, type, id, data) => database.updateEntity(type, id, data))
  ipcMain.handle('entities:delete', (_, type, id) => database.deleteEntity(type, id))
  ipcMain.handle('project-logo:attach', async (event, projectId) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const selection = await dialog.showOpenDialog(win, { title: 'Choisir le logo du projet', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp'] }] })
    if (selection.canceled || !selection.filePaths[0]) return null
    const source = selection.filePaths[0]
    const folder = path.join(app.getPath('userData'), 'project-branding', String(projectId)); fs.mkdirSync(folder, { recursive: true })
    const storedPath = path.join(folder, `logo-${crypto.randomUUID()}${path.extname(source).toLowerCase()}`); fs.copyFileSync(source, storedPath)
    return database.updateProject(projectId, { logo_path: storedPath })
  })
  ipcMain.handle('media:attach', async (event, metadata) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const selection = await dialog.showOpenDialog(win, { title: 'Ajouter des rendus visuels', properties: ['openFile','multiSelections'], filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp','gif'] }] })
    if (selection.canceled) return []
    const folder = path.join(app.getPath('userData'), 'project-media', String(metadata.project_id), String(metadata.entity_type), String(metadata.entity_id)); fs.mkdirSync(folder, { recursive: true })
    return selection.filePaths.map(source => {
      const storedPath = path.join(folder, `${crypto.randomUUID()}${path.extname(source).toLowerCase()}`); fs.copyFileSync(source, storedPath)
      const stats = fs.statSync(storedPath)
      return database.createEntity('attachments', { ...metadata, file_name: path.basename(source), mime_type: imageMime(source), stored_path: storedPath, size_bytes: stats.size })
    })
  })
  ipcMain.handle('supplier-documents:attach', async (event, metadata) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const selection = await dialog.showOpenDialog(win, { title: 'Joindre un document fournisseur', properties: ['openFile'] })
    if (selection.canceled || !selection.filePaths[0]) return null
    const source = selection.filePaths[0]
    const originalName = path.basename(source)
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const folder = path.join(app.getPath('userData'), 'supplier-documents', String(metadata.project_id), String(metadata.supplier_id || 'general'))
    fs.mkdirSync(folder, { recursive: true })
    const storedPath = path.join(folder, `${crypto.randomUUID()}-${safeName}`)
    fs.copyFileSync(source, storedPath)
    return database.createEntity('supplier_documents', { ...metadata, file_name: originalName, stored_path: storedPath })
  })
  ipcMain.handle('supplier-documents:open', async (_, id) => {
    const document = database.getEntity('supplier_documents', id)
    if (!document?.stored_path || !fs.existsSync(document.stored_path)) throw new Error('Fichier introuvable')
    const error = await shell.openPath(document.stored_path)
    if (error) throw new Error(error)
    return { ok: true }
  })
  ipcMain.handle('supplier-documents:reveal', (_, id) => {
    const document = database.getEntity('supplier_documents', id)
    if (!document?.stored_path || !fs.existsSync(document.stored_path)) throw new Error('Fichier introuvable')
    shell.showItemInFolder(document.stored_path)
    return { ok: true }
  })
  ipcMain.handle('system:info', () => ({ dataPath: app.getPath('userData'), version: app.getVersion() }))
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
