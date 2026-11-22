import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')
const initial=read('supabase/migrations/202611190001_initial_saas.sql')
const invitations=read('supabase/migrations/202611220015_invitation_onboarding.sql')
const events=read('supabase/migrations/202611200003_collaboration_events.sql')
const mentions=read('supabase/migrations/202611220012_member_mentions.sql')
const realtime=read('supabase/migrations/202611220021_full_project_realtime.sql')
const cloudApi=read('src/services/cloudApi.js')
const app=read('src/App.jsx')
const inviteFunction=read('supabase/functions/invite-member/index.ts')

for(const policy of ['membership_member_select','membership_admin_insert','membership_admin_update','membership_admin_delete']){
  assert(initial.includes(policy),`Politique de collaboration absente : ${policy}`)
}
assert(invitations.includes('accept_my_invitations'),'L’acceptation automatique des invitations est absente.')
assert(inviteFunction.includes("['Propriétaire','Administrateur','Chef de projet']"),'Les rôles autorisés à inviter ont changé.')
assert(inviteFunction.includes("status:'Actif'"),'Un membre existant ne rejoint pas immédiatement l’espace.')

for(const table of ['comments','activities','notifications']){
  assert(events.includes(`supabase_realtime add table public.${table}`),`${table} n’est pas publié en temps réel.`)
}
for(const table of ['tasks','backlog_items','sprints','comments','activities','notifications']){
  assert(realtime.includes(`'${table}'`),`${table} n’est pas couvert par la publication collaborative complète.`)
  assert(cloudApi.includes(`'${table}'`),`${table} n’est pas écouté par l’application.`)
}
assert(mentions.includes('mentioned_user_ids'),'Les mentions @membre ne sont pas enregistrées.')
assert(app.includes("event_type:isMentioned?'mention.created':'comment.created'"),'Les notifications de discussion et de mention ne sont pas générées.')
assert(cloudApi.includes("filter:`project_id=eq.${projectId}`"),'L’écoute temps réel n’est pas isolée par projet.')

console.log('Collaboration validée : rôles, invitations, isolation, mentions, notifications et temps réel.')
