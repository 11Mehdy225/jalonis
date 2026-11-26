import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const paymentMethods=new Set(['wave','orange','mtn','moov','djamo','jeko'])
const paidPlans=new Set(['personal_pro','team','business'])
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Méthode non autorisée.'},405)
  const contentLength=Number(request.headers.get('content-length')||0)
  if(contentLength>16_384)return json({error:'Requête trop volumineuse.'},413)
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey=Deno.env.get('JEKO_API_KEY'),apiKeyId=Deno.env.get('JEKO_API_KEY_ID'),storeId=Deno.env.get('JEKO_STORE_ID')
    if(!url||!serviceKey||!apiKey||!apiKeyId||!storeId)return json({error:'Le paiement Jèko n’est pas encore configuré.'},503)
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(token)
    if(userError||!user)return json({error:'Session invalide ou expirée.'},401)

    const {data:rateAllowed,error:rateError}=await admin.rpc('consume_api_rate_limit',{p_scope:'jeko_checkout',p_actor:user.id,p_max_requests:5,p_window_seconds:60})
    if(rateError)throw rateError
    if(!rateAllowed)return json({error:'Trop de tentatives. Réessayez dans une minute.'},429)

    const body=await request.json(),workspaceId=String(body.workspace_id||''),planCode=String(body.plan_code||'')
    if(!uuidPattern.test(workspaceId)||!paidPlans.has(planCode))return json({error:'Offre ou espace invalide.'},400)
    if(!['monthly','annual'].includes(body.billing_cycle))return json({error:'Cycle de facturation invalide.'},400)
    const cycle=body.billing_cycle as 'monthly'|'annual',seatInput=Number(body.seats)
    if(!Number.isSafeInteger(seatInput)||seatInput<1||seatInput>1000)return json({error:'Nombre de membres invalide.'},400)
    const requestedSeats=seatInput
    const [{data:membership},{data:workspace},{data:plan},{data:provider}]=await Promise.all([
      admin.from('workspace_members').select('role,status').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle(),
      admin.from('workspaces').select('id,name,account_type').eq('id',workspaceId).maybeSingle(),
      admin.from('plan_catalog').select('*').eq('code',planCode).eq('active',true).maybeSingle(),
      admin.from('billing_provider_settings').select('*').eq('provider','jeko').eq('active',true).maybeSingle(),
    ])
    if(!membership||membership.status!=='Actif'||!['Propriétaire','Administrateur'].includes(membership.role))return json({error:'Seuls le propriétaire et les administrateurs peuvent gérer la facturation.'},403)
    if(!workspace||!plan)return json({error:'Espace ou offre introuvable.'},404)
    if(!provider)return json({error:'Le paiement Jèko n’est pas activé.'},503)
    if(plan.account_type!==workspace.account_type)return json({error:'Cette offre ne correspond pas au type de compte.'},400)
    const method=String(body.payment_method||provider.payment_method||'wave').toLowerCase()
    if(!paymentMethods.has(method))return json({error:'Le moyen de paiement configuré n’est pas pris en charge.'},503)
    const {data:price}=await admin.from('provider_plan_prices').select('unit_amount,currency').eq('provider','jeko').eq('plan_code',planCode).eq('billing_cycle',cycle).eq('active',true).maybeSingle()
    if(!price)return json({error:`Le tarif ${plan.name} n’est pas encore configuré pour Jèko.`},503)
    if(price.currency!==provider.currency)return json({error:'La devise du tarif ne correspond pas à celle du prestataire.'},503)

    const seats=Math.max(requestedSeats,Number(plan.min_seats)||1),amount=Math.round(Number(price.unit_amount)*seats*100)/100,amountCents=Math.round(amount*100)
    if(!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>100_000_000_000||amountCents%100!==0)return json({error:'Montant de paiement invalide.'},503)
    const txRef=`kavelyo-${workspaceId.slice(0,8)}-${crypto.randomUUID()}`
    const origin=String(Deno.env.get('SITE_URL')||request.headers.get('origin')||'').replace(/\/$/,'')
    if(!origin.startsWith('https://')&&!origin.startsWith('http://localhost'))return json({error:'Adresse publique Kavelyo invalide.'},503)
    const paymentResponse=await fetch('https://api.jeko.africa/partner_api/payment_requests',{method:'POST',headers:{'X-API-KEY':apiKey,'X-API-KEY-ID':apiKeyId,'Content-Type':'application/json'},signal:AbortSignal.timeout(15_000),body:JSON.stringify({
      storeId,amountCents,currency:price.currency,reference:txRef,
      paymentDetails:{type:'redirect',data:{paymentMethod:method,successUrl:`${origin}/?billing=return&status=successful`,errorUrl:`${origin}/?billing=return&status=failed`}},
    })})
    const payment=await paymentResponse.json()
    if(!paymentResponse.ok||!payment.redirectUrl||!payment.id)throw new Error('JEKO_CHECKOUT_FAILED')
    const checkoutUrl=new URL(String(payment.redirectUrl))
    if(checkoutUrl.protocol!=='https:'||!checkoutUrl.hostname.endsWith('.jeko.africa'))throw new Error('JEKO_CHECKOUT_URL_INVALID')
    const {error:insertError}=await admin.from('billing_transactions').insert({workspace_id:workspaceId,tx_ref:txRef,provider:'jeko',provider_transaction_id:String(payment.id).slice(0,200),plan_code:planCode,billing_cycle:cycle,seats,amount,currency:price.currency,checkout_url:checkoutUrl.toString(),created_by:user.id})
    if(insertError)throw insertError
    return json({ok:true,checkout_url:checkoutUrl.toString(),tx_ref:txRef,provider:'jeko',payment_method:method})
  }catch(error){console.error('create-jeko-checkout failed',error instanceof Error?error.message:'unknown');return json({error:'Impossible de préparer le paiement pour le moment.'},500)}
})
