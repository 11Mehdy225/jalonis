import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd(),failures=[]
const required=[
  'src/features/admin/AdminView.jsx','src/features/auth/AuthGate.jsx','src/styles/mobile.css',
  'supabase/functions/process-email-queue/index.ts','supabase/functions/process-whatsapp-queue/index.ts',
  'supabase/migrations/202611230002_platform_operations.sql','docs/MISE_EN_PRODUCTION.md',
  'build/icon.icns','build/icon.ico','public/assets/jalonis-logo.png',
]
for(const file of required)if(!fs.existsSync(path.join(root,file)))failures.push(`Fichier requis absent : ${file}`)
const auth=fs.readFileSync(path.join(root,'src/features/auth/AuthGate.jsx'),'utf8')
for(const marker of ['pricing','terms','privacy','support','termsAccepted'])if(!auth.includes(marker))failures.push(`Parcours public incomplet : ${marker}`)
const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8')
for(const marker of ['Administration SaaS','SubscriptionNotice','onboarding-steps'])if(!app.includes(marker))failures.push(`Parcours applicatif incomplet : ${marker}`)
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
if(!pkg.build?.mac?.icon||!pkg.build?.win?.icon)failures.push('Icônes Desktop non configurées.')
if(!pkg.build?.dmg?.contents||!pkg.build?.nsis)failures.push('Installateurs macOS ou Windows incomplets.')
if(failures.length){console.error('Préparation de version incomplète :');failures.forEach(item=>console.error(`- ${item}`));process.exit(1)}
console.log('Préparation de version validée : SaaS, notifications, administration, parcours public, mobile et Desktop présents.')
