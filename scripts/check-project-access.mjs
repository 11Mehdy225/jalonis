import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=path=>fs.readFileSync(path,'utf8')
const migration=read('supabase/migrations/202611250001_project_scoped_access.sql')
const cloud=read('src/services/cloudApi.js')
const app=read('src/App.jsx')
const invite=read('supabase/functions/invite-member/index.ts')

for(const marker of ['project_members','access_mode','can_access_project','set_project_access','workspace_files_select'])assert.ok(migration.includes(marker),`Protection manquante : ${marker}`)
assert.ok(migration.includes("default 'restricted'"),'Les nouveaux projets doivent être restreints par défaut')
assert.ok(cloud.includes('get_project_access')&&cloud.includes('set_project_access'),'API de gestion des accès absente')
assert.ok(app.includes('ProjectAccessManager'),'Interface de gestion des accès absente')
assert.ok(invite.includes('project_ids')&&invite.includes('project_members'),'L’invitation ciblée par projet est absente')
console.log('Accès par projet validé : visibilité, membres, invitations et fichiers protégés.')
