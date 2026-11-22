import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!serviceKey)return json({error:'Configuration serveur indisponible.'},503)
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(token)
    if(userError||!user)return json({error:'Session invalide ou expirée.'},401)
    const body=await request.json(),workspaceId=String(body.workspace_id||''),planCode=String(body.plan_code||''),methodId=String(body.payment_method_id||'')
    const billingCycle=body.billing_cycle==='annual'?'annual':'monthly',seatsRequested=Math.max(1,Math.floor(Number(body.seats)||1))
    const payerName=String(body.payer_name||'').trim().slice(0,120),paymentReference=String(body.payment_reference||'').trim().slice(0,120)
    if(!payerName||paymentReference.length<3)return json({error:'Le nom du payeur et la référence du dépôt sont obligatoires.'},400)
    const [{data:membership},{data:workspace},{data:plan},{data:method}]=await Promise.all([
      admin.from('workspace_members').select('role,status').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle(),
      admin.from('workspaces').select('id,account_type').eq('id',workspaceId).maybeSingle(),
      admin.from('plan_catalog').select('code,account_type,min_seats').eq('code',planCode).eq('active',true).maybeSingle(),
      admin.from('manual_payment_methods').select('*').eq('id',methodId).eq('active',true).maybeSingle(),
    ])
    if(!membership||membership.status!=='Actif'||!['Propriétaire','Administrateur'].includes(membership.role))return json({error:'Seuls le propriétaire et les administrateurs peuvent gérer la facturation.'},403)
    if(!workspace||!plan||!method)return json({error:'Offre ou moyen de paiement indisponible.'},404)
    if(plan.account_type!==workspace.account_type)return json({error:'Cette offre ne correspond pas au type de compte.'},400)
    const {data:price}=await admin.from('manual_plan_prices').select('unit_amount,currency').eq('plan_code',planCode).eq('billing_cycle',billingCycle).eq('currency',method.currency).eq('active',true).maybeSingle()
    if(!price)return json({error:'Le tarif de cette offre n’est pas encore configuré pour ce moyen de paiement.'},409)
    const seats=Math.max(seatsRequested,Number(plan.min_seats)||1),amount=Math.round(Number(price.unit_amount)*seats*100)/100
    const {data:created,error:insertError}=await admin.from('manual_payment_requests').insert({workspace_id:workspaceId,requested_by:user.id,payment_method_id:methodId,plan_code:planCode,billing_cycle:billingCycle,seats,amount,currency:price.currency,payer_name:payerName,payment_reference:paymentReference}).select('id,status,amount,currency').single()
    if(insertError){if(insertError.code==='23505')return json({error:'Cette référence de paiement a déjà été transmise.'},409);throw insertError}
    await admin.from('audit_log').insert({workspace_id:workspaceId,actor_id:user.id,action:'billing.manual.requested',entity_type:'manual_payment_request',entity_id:created.id,metadata:{plan_code:planCode,amount,currency:price.currency,seats}})
    return json({ok:true,request:created,message:'Demande transmise. Votre abonnement sera activé après vérification du dépôt.'},201)
  }catch(error){return json({error:error instanceof Error?error.message:'Impossible d’enregistrer la demande de paiement.'},500)}
})

