import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')
const checkout=read('supabase/functions/create-jeko-checkout/index.ts')
const webhook=read('supabase/functions/jeko-webhook/index.ts')
const migration=read('supabase/migrations/202611220024_jeko_billing.sql')
const pricing=read('supabase/migrations/202611230005_update_public_pricing.sql')

for(const secret of ['JEKO_API_KEY','JEKO_API_KEY_ID','JEKO_STORE_ID'])assert(checkout.includes(secret),`Secret attendu absent : ${secret}`)
assert(checkout.includes('https://api.jeko.africa/partner_api/payment_requests'),'Endpoint Jèko incorrect.')
assert(checkout.includes("provider:'jeko'"),'Le registre de paiement ne conserve pas le prestataire.')
assert(webhook.includes('JEKO_WEBHOOK_SECRET'),'Le secret de signature webhook est absent.')
assert(webhook.includes("crypto.subtle.sign('HMAC'"),'La signature HMAC-SHA256 n’est pas vérifiée.')
assert(webhook.includes("eventError?.code==='23505'"),'Le webhook Jèko n’est pas idempotent.')
assert(webhook.includes("eventType!=='TRANSACTION_COMPLETED'"),'Le webhook accepte des événements non financiers.')
assert(migration.includes('activate_paid_subscription'),'L’activation atomique des abonnements est absente.')
assert(migration.includes('revoke all on function public.activate_paid_subscription'),'La fonction sensible est exposée aux clients.')
for(const expected of [
  "('personal_pro','monthly','XOF',5000,true)",
  "('personal_pro','annual','XOF',50000,true)",
  "('team','monthly','XOF',6000,true)",
  "('team','annual','XOF',60000,true)",
  "('business','monthly','XOF',9000,true)",
  "('business','annual','XOF',90000,true)",
])assert(pricing.includes(expected),`Tarif Jèko absent : ${expected}`)

console.log('Paiement Jèko validé : tarifs, secrets serveur, signature, idempotence et activation atomique.')
