import fs from 'node:fs'

const failures=[],read=file=>fs.readFileSync(file,'utf8')
const migration=read('supabase/migrations/202611230010_scrum_events.sql')
const view=read('src/features/agile/ScrumEvents.jsx')
const scrum=read('src/features/agile/ScrumView.jsx')
const app=read('src/App.jsx')
const assistant=read('src/features/assistant/ProjectAssistant.jsx')

for(const marker of ['create table if not exists public.scrum_events','create table if not exists public.scrum_event_entries','enable row level security','subscription_write_access','supabase_realtime'])if(!migration.includes(marker))failures.push(`Migration Scrum incomplète : ${marker}`)
for(const marker of ['Sprint Planning','Backlog Refinement','Daily Scrum','Sprint Review','Sprint Retrospective','Compte rendu partagé','Actions — une par ligne'])if(!view.includes(marker))failures.push(`Registre Scrum incomplet : ${marker}`)
for(const marker of ["tab==='events'",'ScrumEvents','events={entities.scrum_events}','scrum_event_entries'])if(!(scrum+app).includes(marker))failures.push(`Intégration Scrum incomplète : ${marker}`)
if(!assistant.includes('dailyBlockers'))failures.push('Les blocages du Daily ne remontent pas dans le copilote local.')

if(failures.length){console.error('Événements Scrum incomplets :');failures.forEach(item=>console.error(`- ${item}`));process.exit(1)}
console.log('Événements Scrum validés : Planning, Refinement, Daily, Review et Rétrospective.')
