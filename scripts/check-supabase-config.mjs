import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const requiredFunctions=['create-workspace','invite-member','create-billing-checkout','create-jeko-checkout','flutterwave-webhook','jeko-webhook','submit-manual-payment','review-manual-payment','process-email-queue','process-whatsapp-queue','project-assistant','whatsapp-webhook']
const failures=[]

const envFile=path.join(root,'.env.local')
if(!fs.existsSync(envFile))failures.push('Le fichier .env.local est absent.')
else{
  const env=fs.readFileSync(envFile,'utf8')
  const url=env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key=env.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()
  if(!url||!/https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))failures.push('VITE_SUPABASE_URL est absente ou invalide.')
  if(!key||key==='votre-cle-publique-anon'||key.length<40)failures.push('VITE_SUPABASE_ANON_KEY est absente ou invalide.')
}

const migrations=fs.readdirSync(path.join(root,'supabase','migrations')).filter(file=>file.endsWith('.sql')).sort()
if(migrations.length!==27)failures.push(`27 migrations attendues, ${migrations.length} trouvée(s).`)
for(const name of requiredFunctions){
  if(!fs.existsSync(path.join(root,'supabase','functions',name,'index.ts')))failures.push(`Fonction manquante : ${name}.`)
}

if(failures.length){
  console.error('Configuration Supabase incomplète :')
  failures.forEach(item=>console.error(`- ${item}`))
  process.exit(1)
}

console.log(`Configuration Supabase prête : ${migrations.length} migrations et ${requiredFunctions.length} fonctions.`)
