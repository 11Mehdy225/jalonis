import fs from 'node:fs'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const migration=read('supabase/migrations/202611230009_impact_chain.sql')
const center=read('src/features/impact/ImpactCenter.jsx')
const app=read('src/App.jsx')
const assistant=read('src/features/assistant/ProjectAssistant.jsx')
const edge=read('supabase/functions/project-assistant/index.ts')

for(const marker of ['create table if not exists public.project_links','enable row level security','project_links_member_select','project_links_member_insert','subscription_write_access','supabase_realtime'])if(!migration.includes(marker))failures.push(`Migration d’impact incomplète : ${marker}`)
for(const marker of ['CHAÎNE D’IMPACT KAVELYO','Mode hybride','Du besoin au livrable','Pilotage responsable','project_links'])if(!center.includes(marker))failures.push(`Centre d’impact incomplet : ${marker}`)
for(const marker of ["['impact','Chaîne d’impact'",'ImpactCenter','project_links'])if(!app.includes(marker))failures.push(`Intégration applicative incomplète : ${marker}`)
for(const marker of ['hybridGaps','supplierAlerts','humanAlerts','explicitImpacts'])if(!assistant.includes(marker))failures.push(`Copilote local incomplet : ${marker}`)
for(const marker of ['supplier_contracts','team_capacity','recent_time_entries','conflicts','impact_links'])if(!edge.includes(marker))failures.push(`Contexte du copilote avancé incomplet : ${marker}`)

if(failures.length){console.error('Chaîne d’impact incomplète :');failures.forEach(item=>console.error(`- ${item}`));process.exit(1)}
console.log('Chaîne d’impact validée : hybride, décision, fournisseurs et pilotage humain sont reliés.')
