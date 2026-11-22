import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const planEnv=(plan:string,cycle:string)=>`FLW_PLAN_${plan.replace(/[^a-z0-9]/gi,'_').toUpperCase()}_${cycle.toUpperCase()}`

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),secretKey=Deno.env.get('FLW_SECRET_KEY')
    if(!url||!serviceKey||!secretKey)return json({error:'Le paiement Flutterwave n’est pas encore configuré.'},503)
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(token)
    if(userError||!user)return json({error:'Session invalide ou expirée.'},401)
    const body=await request.json(),workspaceId=String(body.workspace_id||''),planCode=String(body.plan_code||''),cycle=body.billing_cycle==='annual'?'annual':'monthly'
    const requestedSeats=Math.max(1,Math.floor(Number(body.seats)||1))
    const [{data:membership},{data:workspace},{data:plan}]=await Promise.all([
      admin.from('workspace_members').select('role,status').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle(),
      admin.from('workspaces').select('id,name,account_type').eq('id',workspaceId).maybeSingle(),
      admin.from('plan_catalog').select('*').eq('code',planCode).eq('active',true).maybeSingle(),
    ])
    if(!membership||membership.status!=='Actif'||!['Propriétaire','Administrateur'].includes(membership.role))return json({error:'Seuls le propriétaire et les administrateurs peuvent gérer la facturation.'},403)
    if(!workspace||!plan)return json({error:'Espace ou offre introuvable.'},404)
    if(plan.account_type!==workspace.account_type)return json({error:'Cette offre ne correspond pas au type de compte.'},400)
    if(planCode==='discovery'||planCode==='enterprise')return json({error:'Cette offre ne passe pas par le paiement automatique.'},400)
    const seats=Math.max(requestedSeats,Number(plan.min_seats)||1)
    const unitPrice=Number(cycle==='annual'?plan.annual_price_eur:plan.monthly_price_eur)
    const amount=Math.round(unitPrice*seats*100)/100
    const paymentPlan=Deno.env.get(planEnv(planCode,cycle))
    if(!paymentPlan)return json({error:`Le plan de paiement ${plan.name} n’est pas encore relié à Flutterwave.`},503)
    const txRef=`jalonis-${workspaceId.slice(0,8)}-${crypto.randomUUID()}`
    const origin=String(Deno.env.get('SITE_URL')||request.headers.get('origin')||'').replace(/\/$/,'')
    const redirectUrl=`${origin}/?billing=return`
    const {data:profile}=await admin.from('profiles').select('full_name,email,phone').eq('id',user.id).single()
    const paymentResponse=await fetch('https://api.flutterwave.com/v3/payments',{method:'POST',headers:{Authorization:`Bearer ${secretKey}`,'Content-Type':'application/json'},body:JSON.stringify({
      tx_ref:txRef,amount,currency:'EUR',redirect_url:redirectUrl,payment_plan:Number(paymentPlan),payment_options:'card',
      customer:{email:profile?.email||user.email,name:profile?.full_name||workspace.name,phone_number:profile?.phone||undefined},
      customizations:{title:'Jalonis',description:`Abonnement ${plan.name} · ${seats} siège(s)`},
      configurations:{session_duration:30,max_retry_attempt:5},meta:{workspace_id:workspaceId,plan_code:planCode,billing_cycle:cycle,seats},
    })})
    const payment=await paymentResponse.json()
    if(!paymentResponse.ok||payment.status!=='success'||!payment.data?.link)throw new Error(payment.message||'Flutterwave n’a pas créé la page de paiement.')
    await admin.from('billing_transactions').insert({workspace_id:workspaceId,tx_ref:txRef,plan_code:planCode,billing_cycle:cycle,seats,amount,currency:'EUR',checkout_url:payment.data.link,created_by:user.id})
    return json({ok:true,checkout_url:payment.data.link,tx_ref:txRef})
  }catch(error){return json({error:error instanceof Error?error.message:'Impossible de préparer le paiement.'},500)}
})
