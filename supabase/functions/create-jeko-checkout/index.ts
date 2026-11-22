import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const paymentMethods=new Set(['wave','orange','mtn','moov','djamo','jeko'])

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey=Deno.env.get('JEKO_API_KEY'),apiKeyId=Deno.env.get('JEKO_API_KEY_ID'),storeId=Deno.env.get('JEKO_STORE_ID')
    if(!url||!serviceKey||!apiKey||!apiKeyId||!storeId)return json({error:'Le paiement Jèko n’est pas encore configuré.'},503)
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(token)
    if(userError||!user)return json({error:'Session invalide ou expirée.'},401)

    const body=await request.json(),workspaceId=String(body.workspace_id||''),planCode=String(body.plan_code||'')
    const cycle=body.billing_cycle==='annual'?'annual':'monthly',requestedSeats=Math.max(1,Math.floor(Number(body.seats)||1))
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
    if(planCode==='discovery'||planCode==='enterprise')return json({error:'Cette offre ne passe pas par le paiement automatique.'},400)

    const method=String(provider.payment_method||'wave').toLowerCase()
    if(!paymentMethods.has(method))return json({error:'Le moyen de paiement configuré n’est pas pris en charge.'},503)
    const {data:price}=await admin.from('provider_plan_prices').select('unit_amount,currency').eq('provider','jeko').eq('plan_code',planCode).eq('billing_cycle',cycle).eq('active',true).maybeSingle()
    if(!price)return json({error:`Le tarif ${plan.name} n’est pas encore configuré pour Jèko.`},503)
    if(price.currency!==provider.currency)return json({error:'La devise du tarif ne correspond pas à celle du prestataire.'},503)

    const seats=Math.max(requestedSeats,Number(plan.min_seats)||1),amount=Math.round(Number(price.unit_amount)*seats*100)/100,amountCents=Math.round(amount*100)
    if(amountCents<100||amountCents%100!==0)return json({error:'Le tarif Jèko doit être exprimé en francs CFA entiers.'},503)
    const txRef=`jalonis-${workspaceId.slice(0,8)}-${crypto.randomUUID()}`
    const origin=String(Deno.env.get('SITE_URL')||request.headers.get('origin')||'').replace(/\/$/,'')
    if(!origin.startsWith('https://')&&!origin.startsWith('http://localhost'))return json({error:'Adresse publique Jalonis invalide.'},503)
    const paymentResponse=await fetch('https://api.jeko.africa/partner_api/payment_requests',{method:'POST',headers:{'X-API-KEY':apiKey,'X-API-KEY-ID':apiKeyId,'Content-Type':'application/json'},body:JSON.stringify({
      storeId,amountCents,currency:price.currency,reference:txRef,
      paymentDetails:{type:'redirect',data:{paymentMethod:method,successUrl:`${origin}/?billing=return&status=successful`,errorUrl:`${origin}/?billing=return&status=failed`}},
    })})
    const payment=await paymentResponse.json()
    if(!paymentResponse.ok||!payment.redirectUrl||!payment.id)throw new Error(payment.message||payment.error||'Jèko n’a pas créé la page de paiement.')
    await admin.from('billing_transactions').insert({workspace_id:workspaceId,tx_ref:txRef,provider:'jeko',provider_transaction_id:String(payment.id),plan_code:planCode,billing_cycle:cycle,seats,amount,currency:price.currency,checkout_url:payment.redirectUrl,created_by:user.id})
    return json({ok:true,checkout_url:payment.redirectUrl,tx_ref:txRef,provider:'jeko',payment_method:method})
  }catch(error){return json({error:error instanceof Error?error.message:'Impossible de préparer le paiement.'},500)}
})
