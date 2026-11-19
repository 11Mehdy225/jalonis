const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { JalonisDatabase } = require('./database.cjs')

let database

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
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
}

app.whenReady().then(() => {
  database = new JalonisDatabase(path.join(app.getPath('userData'), 'jalonis.sqlite'))
  ipcMain.handle('projects:list', () => database.listProjects())
  ipcMain.handle('projects:create', (_, data) => database.createProject(data))
  ipcMain.handle('projects:update', (_, id, data) => database.updateProject(id, data))
  ipcMain.handle('workspace:get', () => database.getWorkspace())
  ipcMain.handle('workspace:update', (_, data) => database.updateWorkspace(data))
  ipcMain.handle('workspace-members:create', (_, data) => database.createWorkspaceMember(data))
  ipcMain.handle('workspace-members:remove', (_, membershipId) => database.removeWorkspaceMember(membershipId))
  ipcMain.handle('entities:list', (_, type, projectId) => database.listEntities(type, projectId))
  ipcMain.handle('entities:create', (_, type, data) => database.createEntity(type, data))
  ipcMain.handle('entities:update', (_, type, id, data) => database.updateEntity(type, id, data))
  ipcMain.handle('entities:delete', (_, type, id) => database.deleteEntity(type, id))
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
