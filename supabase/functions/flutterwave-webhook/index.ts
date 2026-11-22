import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let difference=0;for(let index=0;index<a.length;index++)difference|=a.charCodeAt(index)^b.charCodeAt(index);return difference===0}

Deno.serve(async request=>{
  const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),secretKey=Deno.env.get('FLW_SECRET_KEY'),webhookHash=Deno.env.get('FLW_WEBHOOK_HASH')
  if(!url||!serviceKey||!secretKey||!webhookHash)return new Response('Configuration incomplète',{status:503})
  const signature=request.headers.get('verif-hash')||''
  if(!safeEqual(signature,webhookHash))return new Response('Signature invalide',{status:401})
  try{
    const payload=await request.json(),eventType=String(payload.event||''),transactionId=String(payload.data?.id||'')
    if(!transactionId)return new Response('ok',{status:200})
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const eventKey=`${eventType}:${transactionId}`
    const {error:eventError}=await admin.from('billing_events').insert({provider:'flutterwave',event_key:eventKey,event_type:eventType,payload})
    if(eventError?.code==='23505')return new Response('ok',{status:200})
    if(eventError)throw eventError
    if(eventType!=='charge.completed')return new Response('ok',{status:200})
    const verifyResponse=await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,{headers:{Authorization:`Bearer ${secretKey}`}})
    const verified=await verifyResponse.json(),transaction=verified.data
    const txRef=String(transaction?.tx_ref||payload.data?.tx_ref||'')
    const {data:attempt}=await admin.from('billing_transactions').select('*').eq('tx_ref',txRef).maybeSingle()
    if(!attempt)return new Response('ok',{status:200})
    const valid=verifyResponse.ok&&verified.status==='success'&&transaction?.status==='successful'&&transaction.currency===attempt.currency&&Number(transaction.amount)>=Number(attempt.amount)
    if(!valid){await admin.from('billing_transactions').update({status:'failed',provider_transaction_id:transactionId}).eq('id',attempt.id);return new Response('ok',{status:200})}
    const periodEnd=new Date();if(attempt.billing_cycle==='annual')periodEnd.setFullYear(periodEnd.getFullYear()+1);else periodEnd.setMonth(periodEnd.getMonth()+1)
    await admin.from('billing_transactions').update({status:'successful',provider_transaction_id:transactionId,paid_at:new Date().toISOString()}).eq('id',attempt.id)
    await admin.from('subscriptions').update({plan_code:attempt.plan_code,status:'active',seats:attempt.seats,provider:'flutterwave',provider_customer_id:String(transaction.customer?.id||''),provider_subscription_id:String(transaction.payment_plan||''),current_period_start:new Date().toISOString(),current_period_end:periodEnd.toISOString(),cancel_at_period_end:false}).eq('workspace_id',attempt.workspace_id)
    return new Response('ok',{status:200})
  }catch{return new Response('Erreur de traitement',{status:500})}
})
