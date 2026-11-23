import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
const configured=(...names:string[])=>names.every(name=>Boolean(Deno.env.get(name)))

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!key)return json({error:'Configuration serveur incomplète.'},503)
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user}}=await admin.auth.getUser(token)
    if(!user)return json({error:'Session invalide.'},401)
    const {data:platformAdmin}=await admin.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle()
    if(!platformAdmin)return json({error:'Accès réservé à l’administration Jalonis.'},403)
    const [{data:provider},{data:prices},{data:channels},{data:lastJekoEvent},{data:lastPayment}]=await Promise.all([
      admin.from('billing_provider_settings').select('provider,active,currency,display_name').eq('provider','jeko').maybeSingle(),
      admin.from('provider_plan_prices').select('plan_code,billing_cycle,currency,active').eq('provider','jeko').eq('active',true),
      admin.from('notification_channel_settings').select('channel,provider,configured,enabled,last_checked_at'),
      admin.from('billing_events').select('event_type,processed_at').eq('provider','jeko').order('processed_at',{ascending:false}).limit(1).maybeSingle(),
      admin.from('billing_transactions').select('status,created_at').eq('provider','jeko').order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ])
    const jekoSecrets=configured('JEKO_API_KEY','JEKO_API_KEY_ID','JEKO_STORE_ID','JEKO_WEBHOOK_SECRET','SITE_URL')
    const emailSecrets=configured('RESEND_API_KEY','JALONIS_EMAIL_FROM','JALONIS_CRON_SECRET')
    const whatsappSecrets=configured('WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','JALONIS_CRON_SECRET')
    const checks=[
      {id:'jeko-secrets',group:'Paiement',label:'Secrets Jèko',ready:jekoSecrets,detail:jekoSecrets?'Clé API, identifiant, magasin, signature et adresse publique présents.':'Un ou plusieurs secrets Jèko manquent.'},
      {id:'jeko-provider',group:'Paiement',label:'Jèko activé',ready:Boolean(provider?.active&&provider.currency==='XOF'),detail:provider?.active?`${provider.display_name} · ${provider.currency}`:'Prestataire automatique inactif.'},
      {id:'jeko-prices',group:'Paiement',label:'Tarifs Jèko',ready:(prices||[]).length===6,detail:`${(prices||[]).length}/6 tarifs actifs.`},
      {id:'jeko-webhook',group:'Paiement',label:'Webhook reçu',ready:Boolean(lastJekoEvent),detail:lastJekoEvent?`${lastJekoEvent.event_type} · ${lastJekoEvent.processed_at}`:'Aucun événement reçu — normal avant le premier paiement.'},
      {id:'jeko-payment',group:'Paiement',label:'Paiement réel confirmé',ready:lastPayment?.status==='successful',detail:lastPayment?`${lastPayment.status} · ${lastPayment.created_at}`:'Aucune tentative enregistrée.'},
      {id:'email',group:'Notifications',label:'Envoi e-mail',ready:emailSecrets,detail:emailSecrets?'Resend, expéditeur et secret de planification présents.':'Configuration Resend ou planification incomplète.'},
      {id:'whatsapp',group:'Notifications',label:'WhatsApp',ready:whatsappSecrets,optional:true,detail:whatsappSecrets?'Meta Cloud API configurée.':'Facultatif · identifiants Meta non complets.'},
      {id:'assistant',group:'Intelligence',label:'Copilote avancé',ready:configured('OPENAI_API_KEY'),optional:true,detail:configured('OPENAI_API_KEY')?'Clé serveur présente.':'Facultatif · le copilote local reste disponible.'},
    ]
    return json({generated_at:new Date().toISOString(),checks,channels:channels||[],summary:{ready:checks.filter(row=>row.ready).length,total:checks.length,required_ready:checks.filter(row=>!row.optional&&row.ready).length,required_total:checks.filter(row=>!row.optional).length}})
  }catch(error){return json({error:error instanceof Error?error.message:'Diagnostic indisponible.'},500)}
})
