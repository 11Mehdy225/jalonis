import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')
const migration=read('supabase/migrations/202611230008_promotion_codes_and_admin_kpis.sql')
const admin=read('src/features/admin/AdminView.jsx')
const workspace=read('src/features/workspace/WorkspaceView.jsx')
const html=read('index.html')
const robots=read('public/robots.txt')
const sitemap=read('public/sitemap.xml')
const manifest=read('public/site.webmanifest')
const readiness=read('supabase/functions/platform-readiness/index.ts')

for(const marker of ['promotion_codes','promotion_redemptions','redeem_promotion_code','duration_days','expires_at'])assert(migration.includes(marker),`Socle promotionnel incomplet : ${marker}`)
for(const marker of ['mrr_xof','revenue_30d_xof','conversion_rate','past_due','expiring_7d'])assert(migration.includes(marker),`KPI administrateur absent : ${marker}`)
assert(admin.includes('Codes promotionnels')&&admin.includes('MRR estimé')&&admin.includes('Préparation de la production'),'La console commerciale est incomplète.')
for(const marker of ['JEKO_API_KEY','JEKO_WEBHOOK_SECRET','RESEND_API_KEY','WHATSAPP_ACCESS_TOKEN','OPENAI_API_KEY','platform_admins'])assert(readiness.includes(marker),`Diagnostic de production incomplet : ${marker}`)
assert(readiness.includes("select('event_type,processed_at')")&&readiness.includes("lastPayment?.status==='successful'"),'Le diagnostic Jèko doit suivre les colonnes et statuts réels du registre de paiement.')
assert(workspace.includes('Vous avez un code promotionnel ?'),'Le parcours d’activation client est absent.')
for(const marker of ['canonical','application/ld+json','twitter:card','name="robots"'])assert(html.includes(marker),`Métadonnée SEO absente : ${marker}`)
assert(html.includes('rel="icon"')&&html.includes('/assets/kavelyo-icon-192.png'),'Le favicon public doit utiliser l’identité Kavelyo stable.')
for(const marker of ['"name": "Kavelyo — Pilotage de projets"','kavelyo-icon-192.png','kavelyo-icon-512.png'])assert(manifest.includes(marker),`Manifeste Kavelyo incomplet : ${marker}`)
for(const content of [html,robots,sitemap])assert(content.includes('kavelyo.ronnagroup.net'),'Le domaine public Kavelyo doit être utilisé dans toutes les métadonnées.')
assert(robots.includes('Sitemap:'),'Le fichier robots.txt ne référence pas le sitemap.')
assert(sitemap.includes('?page=pricing'),'La page des tarifs manque dans le sitemap.')

console.log('Socle commercial validé : KPI SaaS, codes promotionnels et référencement technique.')
