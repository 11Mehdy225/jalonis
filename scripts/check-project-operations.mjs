import { readFile } from 'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')
const files=await Promise.all([
  read('src/App.jsx'),read('src/data/projectTemplates.js'),read('src/features/actions/ActionTracker.jsx'),
  read('src/features/raid/RaidCenter.jsx'),read('src/services/weeklyPowerPoint.js'),
  read('supabase/migrations/202611260002_action_tracker.sql'),read('electron/database.cjs'),read('package.json'),
  read('supabase/functions/process-email-queue/index.ts'),read('supabase/functions/process-whatsapp-queue/index.ts'),
])
const source=files.join('\n')
const expectations=[
  ['modèles de projet','PROJECT_TEMPLATES'],['registre central','action_items'],['matrice RAID','Matrice de criticité 5×5'],
  ['export PowerPoint','exportWeeklyPowerPoint'],['bibliothèque PowerPoint','pptxgenjs'],['sécurité cloud','action_items_member_select'],
  ['mode hors ligne','CREATE TABLE IF NOT EXISTS action_items'],
  ['rattrapage du résumé quotidien','localTime<digestTime'],['actions dans le résumé','Actions à suivre'],
  ['compatibilité du planificateur après renommage','x-jalonis-cron-secret'],
  ['nom Kavelyo dans l’expéditeur','from:brandedSender(from)'],
]
const missing=expectations.filter(([,marker])=>!source.includes(marker))
if(missing.length){console.error(`Contrôles manquants : ${missing.map(([label])=>label).join(', ')}`);process.exit(1)}
console.log('Opérations projet : modèles, actions, RAID, PowerPoint, cloud et hors ligne vérifiés.')
