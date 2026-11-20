const { DatabaseSync } = require('node:sqlite')
const crypto = require('node:crypto')
const sqlValue = value => typeof value === 'boolean' ? Number(value) : value

const ENTITY_TABLES = {
  tasks: ['title', 'status', 'priority', 'assignee', 'assignee_id', 'start_date', 'due_date', 'progress', 'notes', 'color',
    'wbs_code', 'predecessor_id', 'dependency_type', 'lag_days', 'is_milestone',
    'baseline_start', 'baseline_end', 'actual_start', 'actual_end', 'work_hours'],
  risks: ['title', 'category', 'probability', 'impact', 'owner', 'response', 'status', 'linked_task_id'],
  team: ['name', 'role', 'email', 'availability', 'skills'],
  meetings: ['title', 'meeting_date', 'participants', 'agenda', 'decisions', 'actions', 'linked_task_id'],
  sprints: ['name', 'goal', 'start_date', 'end_date', 'status', 'capacity_points', 'review_notes', 'retrospective_notes'],
  backlog_items: ['title', 'item_type', 'description', 'acceptance_criteria', 'definition_done', 'priority',
    'story_points', 'status', 'sprint_id', 'assignee', 'assignee_id', 'linked_task_id', 'epic', 'parent_epic_id',
    'estimate_hours', 'start_date', 'due_date', 'rank'],
  attachments: ['entity_type', 'entity_id', 'file_name', 'mime_type', 'stored_path', 'size_bytes', 'caption'],
  suppliers: ['name', 'supplier_code', 'category', 'supplier_type', 'status', 'tax_id', 'registration_number',
    'contact_name', 'email', 'phone', 'address', 'country', 'website', 'qualification_score', 'risk_level',
    'payment_terms', 'notes'],
  procurements: ['reference', 'title', 'request_type', 'category', 'description', 'issue_date', 'deadline',
    'status', 'currency', 'estimated_budget', 'owner', 'linked_task_id', 'linked_risk_id', 'evaluation_method',
    'technical_weight', 'financial_weight'],
  supplier_quotes: ['procurement_id', 'supplier_id', 'quote_reference', 'submission_date', 'amount', 'currency',
    'lead_time_days', 'validity_date', 'technical_score', 'financial_score', 'compliance_score', 'total_score',
    'status', 'notes'],
  supplier_contracts: ['supplier_id', 'procurement_id', 'contract_number', 'title', 'start_date', 'end_date',
    'amount', 'currency', 'status', 'owner', 'payment_terms', 'deliverables', 'renewal_notice_days', 'linked_task_id'],
  supplier_evaluations: ['supplier_id', 'contract_id', 'evaluation_date', 'evaluator', 'quality_score',
    'delivery_score', 'cost_score', 'compliance_score', 'communication_score', 'overall_score', 'comments'],
  supplier_documents: ['supplier_id', 'procurement_id', 'contract_id', 'document_type', 'title', 'file_name',
    'stored_path', 'issue_date', 'expiry_date', 'status', 'notes'],
  comments: ['entity_type', 'entity_id', 'author_name', 'body'],
  activities: ['event_type', 'entity_type', 'entity_id', 'title', 'description', 'actor_name'],
  notifications: ['event_type', 'entity_type', 'entity_id', 'title', 'body', 'is_read'],
}

class JalonisDatabase {
  constructor(path) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    this.migrate()
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, description TEXT,
        sponsor TEXT, manager TEXT, objective TEXT, success_criteria TEXT,
        start_date TEXT, end_date TEXT, budget REAL DEFAULT 0,
        status TEXT DEFAULT 'Planification', health TEXT DEFAULT 'good', methodology TEXT DEFAULT 'Hybride',
        product_goal TEXT, definition_done TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        mode TEXT DEFAULT 'local', account_type TEXT DEFAULT 'Personnel', subscription_plan TEXT DEFAULT 'Découverte',
        subscription_status TEXT DEFAULT 'Essai', seat_limit INTEGER DEFAULT 1, trial_ends_at TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        phone TEXT, job_title TEXT, status TEXT DEFAULT 'Actif', timezone TEXT DEFAULT 'Africa/Abidjan',
        notify_email INTEGER DEFAULT 1, notify_whatsapp INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_members (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'Membre', status TEXT DEFAULT 'Actif',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL, status TEXT DEFAULT 'À faire', priority TEXT DEFAULT 'Moyenne',
        assignee TEXT, start_date TEXT, due_date TEXT, progress INTEGER DEFAULT 0, notes TEXT, color TEXT,
        wbs_code TEXT, predecessor_id TEXT, dependency_type TEXT DEFAULT 'FS', lag_days INTEGER DEFAULT 0,
        is_milestone INTEGER DEFAULT 0, baseline_start TEXT, baseline_end TEXT,
        actual_start TEXT, actual_end TEXT, work_hours REAL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS risks (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL, category TEXT, probability INTEGER DEFAULT 1, impact INTEGER DEFAULT 1,
        owner TEXT, response TEXT, status TEXT DEFAULT 'Ouvert', linked_task_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS team (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL, role TEXT, email TEXT, availability INTEGER DEFAULT 100, skills TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL, meeting_date TEXT, participants TEXT, agenda TEXT, decisions TEXT, actions TEXT, linked_task_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS custom_fields (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL, label TEXT NOT NULL, field_type TEXT DEFAULT 'text', options TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL, goal TEXT, start_date TEXT, end_date TEXT, status TEXT DEFAULT 'Planifié',
        capacity_points INTEGER DEFAULT 0, review_notes TEXT, retrospective_notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS backlog_items (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL, item_type TEXT DEFAULT 'User Story', description TEXT, acceptance_criteria TEXT,
        definition_done TEXT, priority TEXT DEFAULT 'Moyenne', story_points INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Backlog', sprint_id TEXT, assignee TEXT, linked_task_id TEXT,
        epic TEXT, rank INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL, supplier_code TEXT, category TEXT, supplier_type TEXT DEFAULT 'Services',
        status TEXT DEFAULT 'Prospect', tax_id TEXT, registration_number TEXT, contact_name TEXT,
        email TEXT, phone TEXT, address TEXT, country TEXT, website TEXT, qualification_score REAL DEFAULT 0,
        risk_level TEXT DEFAULT 'Moyen', payment_terms TEXT, notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS procurements (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        reference TEXT, title TEXT NOT NULL, request_type TEXT DEFAULT 'RFQ', category TEXT, description TEXT,
        issue_date TEXT, deadline TEXT, status TEXT DEFAULT 'Brouillon', currency TEXT DEFAULT 'EUR',
        estimated_budget REAL DEFAULT 0, owner TEXT, linked_task_id TEXT, linked_risk_id TEXT,
        evaluation_method TEXT, technical_weight REAL DEFAULT 60, financial_weight REAL DEFAULT 40,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS supplier_quotes (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        procurement_id TEXT, supplier_id TEXT, quote_reference TEXT, submission_date TEXT,
        amount REAL DEFAULT 0, currency TEXT DEFAULT 'EUR', lead_time_days INTEGER DEFAULT 0,
        validity_date TEXT, technical_score REAL DEFAULT 0, financial_score REAL DEFAULT 0,
        compliance_score REAL DEFAULT 0, total_score REAL DEFAULT 0, status TEXT DEFAULT 'Reçue', notes TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS supplier_contracts (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        supplier_id TEXT, procurement_id TEXT, contract_number TEXT, title TEXT NOT NULL,
        start_date TEXT, end_date TEXT, amount REAL DEFAULT 0, currency TEXT DEFAULT 'EUR',
        status TEXT DEFAULT 'Brouillon', owner TEXT, payment_terms TEXT, deliverables TEXT,
        renewal_notice_days INTEGER DEFAULT 30, linked_task_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS supplier_evaluations (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        supplier_id TEXT, contract_id TEXT, evaluation_date TEXT, evaluator TEXT,
        quality_score REAL DEFAULT 0, delivery_score REAL DEFAULT 0, cost_score REAL DEFAULT 0,
        compliance_score REAL DEFAULT 0, communication_score REAL DEFAULT 0, overall_score REAL DEFAULT 0,
        comments TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS supplier_documents (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        supplier_id TEXT, procurement_id TEXT, contract_id TEXT, document_type TEXT,
        title TEXT NOT NULL, file_name TEXT, stored_path TEXT, issue_date TEXT, expiry_date TEXT,
        status TEXT DEFAULT 'Valide', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL, stored_path TEXT NOT NULL, size_bytes INTEGER DEFAULT 0, caption TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL DEFAULT 'project', entity_id TEXT NOT NULL,
        author_name TEXT NOT NULL DEFAULT 'Chef de projet', body TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
        title TEXT NOT NULL, description TEXT, actor_name TEXT NOT NULL DEFAULT 'Chef de projet',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
        title TEXT NOT NULL, body TEXT, is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    const taskColumns = this.db.prepare('PRAGMA table_info(tasks)').all().map(column => column.name)
    const taskMigrations = {
      color: 'TEXT', wbs_code: 'TEXT', predecessor_id: 'TEXT', dependency_type: "TEXT DEFAULT 'FS'",
      lag_days: 'INTEGER DEFAULT 0', is_milestone: 'INTEGER DEFAULT 0', baseline_start: 'TEXT',
      baseline_end: 'TEXT', actual_start: 'TEXT', actual_end: 'TEXT', work_hours: 'REAL DEFAULT 0'
    }
    Object.entries(taskMigrations).forEach(([column, definition]) => {
      if (!taskColumns.includes(column)) this.db.exec(`ALTER TABLE tasks ADD COLUMN ${column} ${definition}`)
    })
    const ensureColumn = (table, column, definition) => {
      const columns = this.db.prepare(`PRAGMA table_info(${table})`).all().map(item => item.name)
      if (!columns.includes(column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
    ensureColumn('risks', 'linked_task_id', 'TEXT')
    ensureColumn('meetings', 'linked_task_id', 'TEXT')
    ensureColumn('projects', 'methodology', "TEXT DEFAULT 'Hybride'")
    ensureColumn('projects', 'product_goal', 'TEXT')
    ensureColumn('projects', 'definition_done', 'TEXT')
    ensureColumn('projects', 'workspace_id', 'TEXT')
    ensureColumn('projects', 'theme_color', "TEXT DEFAULT '#4f46e5'")
    ensureColumn('projects', 'logo_path', 'TEXT')
    ensureColumn('tasks', 'assignee_id', 'TEXT')
    ensureColumn('backlog_items', 'assignee_id', 'TEXT')
    ensureColumn('backlog_items', 'parent_epic_id', 'TEXT')
    ensureColumn('backlog_items', 'estimate_hours', 'REAL DEFAULT 0')
    ensureColumn('backlog_items', 'start_date', 'TEXT')
    ensureColumn('backlog_items', 'due_date', 'TEXT')
    ensureColumn('workspaces', 'account_type', "TEXT DEFAULT 'Personnel'")
    ensureColumn('workspaces', 'subscription_plan', "TEXT DEFAULT 'Découverte'")
    ensureColumn('workspaces', 'subscription_status', "TEXT DEFAULT 'Essai'")
    ensureColumn('workspaces', 'seat_limit', 'INTEGER DEFAULT 1')
    ensureColumn('workspaces', 'trial_ends_at', 'TEXT')
    ensureColumn('users', 'notify_in_app', 'INTEGER DEFAULT 1')
    ensureColumn('users', 'notify_assignments', 'INTEGER DEFAULT 1')
    ensureColumn('users', 'notify_status_changes', 'INTEGER DEFAULT 1')
    ensureColumn('users', 'notify_comments', 'INTEGER DEFAULT 1')
    ensureColumn('users', 'daily_digest', 'INTEGER DEFAULT 1')
    ensureColumn('users', 'quiet_start', "TEXT DEFAULT '20:00'")
    ensureColumn('users', 'quiet_end', "TEXT DEFAULT '07:00'")
    this.ensureLocalWorkspace()
    const palette = ['#4f46e5','#0f9f8f','#e46c45','#2878c7','#9b51c7','#cf4f83','#ca8a04','#475569']
    const colorless = this.db.prepare("SELECT id FROM tasks WHERE color IS NULL OR color = ''").all()
    const paint = this.db.prepare('UPDATE tasks SET color=? WHERE id=?')
    colorless.forEach((task, index) => paint.run(palette[index % palette.length], task.id))
    const uncoded = this.db.prepare("SELECT id FROM tasks WHERE wbs_code IS NULL OR wbs_code = '' ORDER BY created_at").all()
    const codeTask = this.db.prepare('UPDATE tasks SET wbs_code=? WHERE id=?')
    uncoded.forEach((task, index) => codeTask.run(String(index + 1), task.id))
  }

  ensureLocalWorkspace() {
    const existing = this.db.prepare('SELECT * FROM workspaces ORDER BY created_at LIMIT 1').get()
    if (existing) {
      this.db.prepare("UPDATE projects SET workspace_id=? WHERE workspace_id IS NULL OR workspace_id='' ").run(existing.id)
      return existing
    }
    const now = new Date().toISOString()
    const workspaceId = crypto.randomUUID(); const userId = crypto.randomUUID(); const membershipId = crypto.randomUUID()
    const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString()
    this.db.prepare(`INSERT INTO workspaces (id,name,slug,mode,account_type,subscription_plan,subscription_status,seat_limit,trial_ends_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(workspaceId, 'Mon espace Jalonis', `espace-${workspaceId.slice(0, 8)}`, 'local', 'Personnel', 'Découverte', 'Essai', 1, trialEnd, now, now)
    this.db.prepare(`INSERT INTO users (id,full_name,email,job_title,status,timezone,notify_email,notify_whatsapp,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(userId, 'Chef de projet', `admin-${userId.slice(0, 8)}@jalonis.local`, 'Administrateur', 'Actif', 'Africa/Abidjan', 1, 0, now, now)
    this.db.prepare(`INSERT INTO workspace_members (id,workspace_id,user_id,role,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run(membershipId, workspaceId, userId, 'Propriétaire', 'Actif', now, now)
    this.db.prepare("UPDATE projects SET workspace_id=? WHERE workspace_id IS NULL OR workspace_id='' ").run(workspaceId)
    return this.db.prepare('SELECT * FROM workspaces WHERE id=?').get(workspaceId)
  }

  getWorkspace() {
    const workspace = this.ensureLocalWorkspace()
    const members = this.db.prepare(`SELECT wm.id membership_id, wm.role, wm.status membership_status,
      u.id, u.full_name, u.email, u.phone, u.job_title, u.status, u.timezone, u.notify_email, u.notify_whatsapp,
      u.notify_in_app, u.notify_assignments, u.notify_status_changes, u.notify_comments, u.daily_digest, u.quiet_start, u.quiet_end
      FROM workspace_members wm JOIN users u ON u.id=wm.user_id
      WHERE wm.workspace_id=? ORDER BY CASE wm.role WHEN 'Propriétaire' THEN 0 WHEN 'Administrateur' THEN 1 WHEN 'Chef de projet' THEN 2 ELSE 3 END, u.full_name`).all(workspace.id)
    return { workspace, members, current_user: members[0] || null }
  }

  updateWorkspace(data) {
    const workspace = this.ensureLocalWorkspace(); const name = String(data.name || '').trim()
    if (!name) throw new Error("Le nom de l’espace est obligatoire")
    const accountType = ['Personnel', 'Organisation'].includes(data.account_type) ? data.account_type : workspace.account_type
    const seatLimit = accountType === 'Organisation' ? Math.max(Number(workspace.seat_limit) || 5, 5) : 1
    this.db.prepare('UPDATE workspaces SET name=?, account_type=?, seat_limit=?, updated_at=? WHERE id=?').run(name, accountType, seatLimit, new Date().toISOString(), workspace.id)
    return this.getWorkspace()
  }

  createWorkspaceMember(data) {
    const workspace = this.ensureLocalWorkspace(); const now = new Date().toISOString()
    const fullName = String(data.full_name || '').trim(); const email = String(data.email || '').trim().toLowerCase()
    if (!fullName || !email) throw new Error('Le nom et l’adresse e-mail sont obligatoires')
    let user = this.db.prepare('SELECT * FROM users WHERE email=?').get(email)
    if (!user) {
      const id = crypto.randomUUID()
      this.db.prepare(`INSERT INTO users (id,full_name,email,phone,job_title,status,timezone,notify_email,notify_whatsapp,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, fullName, email, data.phone || '', data.job_title || '', 'Invité', data.timezone || 'Africa/Abidjan', data.notify_email ? 1 : 0, data.notify_whatsapp ? 1 : 0, now, now)
      user = this.db.prepare('SELECT * FROM users WHERE id=?').get(id)
    }
    const alreadyMember = this.db.prepare('SELECT id FROM workspace_members WHERE workspace_id=? AND user_id=?').get(workspace.id, user.id)
    if (alreadyMember) throw new Error('Cette personne appartient déjà à cet espace')
    this.db.prepare(`INSERT INTO workspace_members (id,workspace_id,user_id,role,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run(crypto.randomUUID(), workspace.id, user.id, data.role || 'Membre', 'Invitation en attente', now, now)
    return this.getWorkspace()
  }

  removeWorkspaceMember(membershipId) {
    const membership = this.db.prepare('SELECT * FROM workspace_members WHERE id=?').get(membershipId)
    if (!membership) return this.getWorkspace()
    if (membership.role === 'Propriétaire') throw new Error("Le propriétaire de l’espace ne peut pas être retiré")
    this.db.prepare('DELETE FROM workspace_members WHERE id=?').run(membershipId)
    return this.getWorkspace()
  }

  updateCurrentUserPreferences(data) {
    const state = this.getWorkspace(); const user = state.current_user
    if (!user) throw new Error('Utilisateur local introuvable')
    const allowed = ['notify_email','notify_whatsapp','notify_in_app','notify_assignments','notify_status_changes','notify_comments','daily_digest','quiet_start','quiet_end']
    const entries = Object.entries(data).filter(([key]) => allowed.includes(key))
    if (entries.length) this.db.prepare(`UPDATE users SET ${entries.map(([key])=>`${key}=?`).join(',')},updated_at=? WHERE id=?`).run(...entries.map(([,value])=>sqlValue(value)),new Date().toISOString(),user.id)
    return this.getWorkspace()
  }

  listProjects() {
    return this.db.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) task_count,
      (SELECT COALESCE(ROUND(AVG(progress)),0) FROM tasks t WHERE t.project_id=p.id) progress,
      (SELECT COUNT(*) FROM risks r WHERE r.project_id=p.id AND r.status!='Fermé') open_risks
      FROM projects p ORDER BY updated_at DESC`).all()
  }

  createProject(data) {
    const id = crypto.randomUUID(); const now = new Date().toISOString()
    const workspace = this.ensureLocalWorkspace()
    this.db.prepare(`INSERT INTO projects (id,name,code,description,manager,start_date,end_date,budget,status,health,methodology,theme_color,workspace_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, data.name, data.code || '', data.description || '', data.manager || '', data.start_date || '', data.end_date || '', Number(data.budget)||0, 'Initialisation', 'good', data.methodology || 'Hybride', data.theme_color || '#4f46e5', workspace.id, now, now)
    return this.db.prepare('SELECT * FROM projects WHERE id=?').get(id)
  }

  updateProject(id, data) {
    const allowed = ['name','code','description','sponsor','manager','objective','success_criteria','start_date','end_date','budget','status','health','methodology','product_goal','definition_done','theme_color','logo_path']
    const entries = Object.entries(data).filter(([key]) => allowed.includes(key))
    if (!entries.length) return this.db.prepare('SELECT * FROM projects WHERE id=?').get(id)
    const sql = `UPDATE projects SET ${entries.map(([key]) => `${key}=?`).join(',')}, updated_at=? WHERE id=?`
    this.db.prepare(sql).run(...entries.map(([,v]) => sqlValue(v)), new Date().toISOString(), id)
    return this.db.prepare('SELECT * FROM projects WHERE id=?').get(id)
  }

  listEntities(type, projectId) {
    if (!ENTITY_TABLES[type]) throw new Error('Type non autorisé')
    const orders = { meetings: 'meeting_date DESC', procurements: 'deadline ASC', supplier_contracts: 'end_date ASC', supplier_documents: 'expiry_date ASC' }
    const order = orders[type] || 'created_at DESC'
    return this.db.prepare(`SELECT * FROM ${type} WHERE project_id=? ORDER BY ${order}`).all(projectId)
  }

  createEntity(type, data) {
    const columns = ENTITY_TABLES[type]
    if (!columns) throw new Error('Type non autorisé')
    const id = crypto.randomUUID(); const now = new Date().toISOString()
    if (type === 'tasks' && !data.color) {
      const palette = ['#4f46e5','#0f9f8f','#e46c45','#2878c7','#9b51c7','#cf4f83','#ca8a04','#475569']
      data.color = palette[crypto.randomInt(palette.length)]
    }
    if (type === 'tasks' && !data.wbs_code) {
      const total = this.db.prepare('SELECT COUNT(*) AS total FROM tasks WHERE project_id=?').get(data.project_id).total
      data.wbs_code = String(total + 1)
    }
    const fields = ['id','project_id',...columns,'created_at','updated_at']
    const values = [id,data.project_id,...columns.map((key) => sqlValue(data[key] ?? null)),now,now]
    this.db.prepare(`INSERT INTO ${type} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).run(...values)
    return this.db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id)
  }

  updateEntity(type, id, data) {
    const allowed = ENTITY_TABLES[type]
    if (!allowed) throw new Error('Type non autorisé')
    const entries = Object.entries(data).filter(([key]) => allowed.includes(key))
    if (entries.length) this.db.prepare(`UPDATE ${type} SET ${entries.map(([key])=>`${key}=?`).join(',')},updated_at=? WHERE id=?`).run(...entries.map(([,v])=>sqlValue(v)),new Date().toISOString(),id)
    return this.db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id)
  }

  deleteEntity(type, id) {
    if (!ENTITY_TABLES[type]) throw new Error('Type non autorisé')
    this.db.prepare(`DELETE FROM ${type} WHERE id=?`).run(id)
    return { ok: true }
  }

  getEntity(type, id) {
    if (!ENTITY_TABLES[type]) throw new Error('Type non autorisé')
    return this.db.prepare(`SELECT * FROM ${type} WHERE id=?`).get(id)
  }
}

module.exports = { JalonisDatabase }
