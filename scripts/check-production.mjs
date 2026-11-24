import fs from 'node:fs'

const siteUrl=(process.env.JALONIS_SITE_URL||'https://jalonis.ronnagroup.net').replace(/\/$/,'')
const env=fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):''
const supabaseUrl=process.env.VITE_SUPABASE_URL||env.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
const publicKey=process.env.VITE_SUPABASE_ANON_KEY||env.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim()

if(!supabaseUrl||!publicKey)throw new Error('Configuration publique Supabase absente.')

const assert=(condition,message)=>{if(!condition)throw new Error(message)}
const headers={apikey:publicKey}

const site=await fetch(`${siteUrl}/`)
assert(site.ok,`Le site public répond ${site.status}.`)
const html=await site.text()
const asset=html.match(/src="\.\/assets\/([^"]+\.js)"/)?.[1]
assert(asset,'Le fichier JavaScript de production est introuvable.')
const bundle=await (await fetch(`${siteUrl}/assets/${asset}`)).text()
assert(bundle.includes(new URL(supabaseUrl).hostname.split('.')[0]),'Le site public n’utilise pas le projet Supabase attendu.')

const auth=await fetch(`${supabaseUrl}/auth/v1/health`,{headers})
assert(auth.ok,`Supabase Auth répond ${auth.status}.`)

const plansResponse=await fetch(`${supabaseUrl}/rest/v1/plan_catalog?select=code&order=monthly_price_eur`,{headers})
assert(plansResponse.ok,`Le catalogue Supabase répond ${plansResponse.status}.`)
const plans=await plansResponse.json()
assert(plans.length===5,`Le catalogue contient ${plans.length} offre(s) au lieu de 5.`)

const protectedFunction=await fetch(`${supabaseUrl}/functions/v1/create-workspace`,{
  method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',
})
assert([401,403].includes(protectedFunction.status),'Une fonction protégée accepte une requête sans session.')

console.log(`Production validée : Render, Auth, ${plans.length} offres et fonctions protégées.`)
