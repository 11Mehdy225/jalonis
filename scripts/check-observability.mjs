import fs from 'node:fs'
const failures=[],read=file=>fs.readFileSync(file,'utf8')
const migration=read('supabase/migrations/202611230011_platform_observability.sql'),ingest=read('supabase/functions/telemetry-ingest/index.ts'),monitor=read('supabase/functions/platform-monitoring/index.ts'),ui=read('src/features/admin/MonitoringCenter.jsx'),client=read('src/services/telemetry.js')
for(const marker of ['platform_telemetry','platform_incidents','enable row level security','is_platform_admin','90 days'])if(!migration.includes(marker))failures.push(`Stockage de supervision incomplet : ${marker}`)
for(const marker of ['consume_api_rate_limit','[masqué]','client_error','platform_incidents'])if(!ingest.includes(marker))failures.push(`Collecte sécurisée incomplète : ${marker}`)
for(const marker of ['active_24h','security_signals','billing_transactions','api_rate_limits'])if(!monitor.includes(marker))failures.push(`KPI de supervision absent : ${marker}`)
for(const marker of ['Vue générale','Activité','Sécurité','Incidents'])if(!ui.includes(marker))failures.push(`Interface de supervision incomplète : ${marker}`)
if(!client.includes('unhandledrejection'))failures.push('Les erreurs JavaScript non gérées ne sont pas collectées.')
if(failures.length){console.error('Supervision incomplète :');failures.forEach(item=>console.error(`- ${item}`));process.exit(1)}
console.log('Supervision validée : trafic, services, sécurité, erreurs et incidents.')
