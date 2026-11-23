import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8')
const migration=read('supabase/migrations/202611230008_promotion_codes_and_admin_kpis.sql')
const admin=read('src/features/admin/AdminView.jsx')
const workspace=read('src/features/workspace/WorkspaceView.jsx')
const html=read('index.html')
const robots=read('public/robots.txt')
const sitemap=read('public/sitemap.xml')

for(const marker of ['promotion_codes','promotion_redemptions','redeem_promotion_code','duration_days','expires_at'])assert(migration.includes(marker),`Socle promotionnel incomplet : ${marker}`)
for(const marker of ['mrr_xof','revenue_30d_xof','conversion_rate','past_due','expiring_7d'])assert(migration.includes(marker),`KPI administrateur absent : ${marker}`)
assert(admin.includes('Codes promotionnels')&&admin.includes('MRR estimé'),'La console commerciale est incomplète.')
assert(workspace.includes('Vous avez un code promotionnel ?'),'Le parcours d’activation client est absent.')
for(const marker of ['canonical','application/ld+json','twitter:card','name="robots"'])assert(html.includes(marker),`Métadonnée SEO absente : ${marker}`)
assert(robots.includes('Sitemap:'),'Le fichier robots.txt ne référence pas le sitemap.')
assert(sitemap.includes('?page=pricing'),'La page des tarifs manque dans le sitemap.')

console.log('Socle commercial validé : KPI SaaS, codes promotionnels et référencement technique.')
