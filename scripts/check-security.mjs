import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')
const render=read('render.yaml')
const html=read('index.html')
const frameGuard=read('public/frame-guard.js')
const checkout=read('supabase/functions/create-jeko-checkout/index.ts')
const webhook=read('supabase/functions/jeko-webhook/index.ts')
const migration=read('supabase/migrations/202611230006_security_hardening.sql')
const sourceFiles=fs.readdirSync(new URL('../src',import.meta.url),{recursive:true})
  .filter(name=>name.endsWith('.js')||name.endsWith('.jsx'))
  .map(name=>read(`src/${name}`))
  .join('\n')

for(const header of ['Content-Security-Policy','X-Frame-Options','Strict-Transport-Security','Permissions-Policy']){
  assert(render.includes(`name: ${header}`),`En-tête de sécurité absent : ${header}`)
}
assert(render.includes("frame-ancestors 'none'"),'La protection anti-clickjacking est absente.')
assert(html.includes('http-equiv="Content-Security-Policy"'),'La politique CSP de secours est absente de la page.')
assert(html.includes('/frame-guard.js'),'Le blocage anti-iframe de secours n’est pas chargé.')
assert(frameGuard.includes('window.top!==window.self'),'Le blocage anti-iframe de secours est invalide.')
assert(!sourceFiles.includes('dangerouslySetInnerHTML'),'Du HTML non fiable peut être injecté dans React.')
assert(!sourceFiles.includes('.innerHTML'),'Une écriture innerHTML contourne la protection React.')
assert(migration.includes('consume_api_rate_limit'),'La limitation anti-abus serveur est absente.')
assert(checkout.includes("p_scope:'jeko_checkout'"),'La création de paiements n’est pas limitée.')
assert(checkout.includes('request.method!==\'POST\''),'La fonction de paiement accepte des méthodes inattendues.')
assert(webhook.includes('payload.storeId!==storeId'),'Le magasin Jèko reçu n’est pas vérifié.')
assert(webhook.includes('paymentRequestId===String(attempt.provider_transaction_id||\'\')'),'La demande de paiement Jèko reçue n’est pas vérifiée.')
assert(webhook.includes("transactionType==='payment'"),'Le webhook accepte un type de transaction non prévu.')
assert(webhook.includes('counterpartIdentifier:maskedIdentifier'),'Le numéro du payeur est conservé sans masquage.')
assert(webhook.includes('provider_customer:null'),'Le numéro du payeur est recopié dans l’abonnement.')

console.log('Sécurité validée : CSP, anti-clickjacking, validation Jèko, anti-abus et absence d’injection HTML directe.')
