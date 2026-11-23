import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')
const migration=read('supabase/migrations/202611230007_subscription_access_control.sql')
const app=read('src/App.jsx')

assert(migration.includes("s.plan_code='discovery'"),'L’offre Découverte doit rester gratuite et accessible.')
assert(migration.includes("interval '3 days'"),'Le délai de grâce de trois jours est absent.')
assert(migration.includes('enforce_subscription_write_access'),'Le verrou serveur en lecture seule est absent.')
for(const table of ['projects','tasks','backlog_items','workspace_members','attachments','assistant_runs']){
  assert(migration.includes(`'${table}'`),`La table ${table} n’est pas protégée par le verrou d’abonnement.`)
}
for(const operation of ['workspace_files_subscription_insert','workspace_files_subscription_update','workspace_files_subscription_delete']){
  assert(migration.includes(operation),`Le stockage ne protège pas l’opération ${operation}.`)
}
assert(migration.includes('process_subscription_lifecycle'),'Le traitement automatique des échéances est absent.')
assert(migration.includes("'jalonis-subscription-lifecycle'"),'La planification quotidienne Supabase Cron est absente.')
assert(migration.includes("'j7'")&&migration.includes("'j3'")&&migration.includes("'lecture_seule'"),'Les rappels d’échéance sont incomplets.')
assert(app.includes('Espace en lecture seule'),'L’interface ne signale pas le verrouillage de l’espace.')

console.log('Abonnements validés : rappels, délai de grâce, stockage et lecture seule côté serveur.')
