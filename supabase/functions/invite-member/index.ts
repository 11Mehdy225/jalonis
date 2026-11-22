import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const roles=['Administrateur','Chef de projet','Scrum Master','Product Owner','Membre','Observateur','Fournisseur externe']

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const url=Deno.env.get('SUPABASE_URL')
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!serviceKey)return json({error:'Configuration serveur Supabase incomplète.'},500)
    const authorization=request.headers.get('Authorization')||''
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=authorization.replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(token)
    if(userError||!user)return json({error:'Session invalide ou expirée.'},401)

    const body=await request.json()
    const workspaceId=String(body.workspace_id||'')
    const email=String(body.email||'').trim().toLowerCase()
    const role=roles.includes(body.role)?body.role:'Membre'
    if(!workspaceId||!email)return json({error:'L’espace et l’adresse e-mail sont obligatoires.'},400)

    const {data:caller}=await admin.from('workspace_members').select('role,status').eq('workspace_id',workspaceId).eq('user_id',user.id).maybeSingle()
    if(!caller||caller.status!=='Actif'||!['Propriétaire','Administrateur','Chef de projet'].includes(caller.role))return json({error:'Vous ne pouvez pas inviter de membre dans cet espace.'},403)

    const [{data:workspace},{data:activeMembers}]=await Promise.all([
      admin.from('workspaces').select('seat_limit').eq('id',workspaceId).single(),
      admin.from('workspace_members').select('role').eq('workspace_id',workspaceId).eq('status','Actif'),
    ])
    if(!workspace)return json({error:'Espace de travail introuvable.'},404)
    const {data:existingProfile}=await admin.from('profiles').select('id').eq('email',email).maybeSingle()
    if(existingProfile){const {data:alreadyMember}=await admin.from('workspace_members').select('id').eq('workspace_id',workspaceId).eq('user_id',existingProfile.id).maybeSingle();if(alreadyMember)return json({error:'Cette personne appartient déjà à cet espace.'},409)}
    const billableRoles=(activeMembers||[]).filter(member=>!['Observateur','Fournisseur externe'].includes(member.role)).length
    const invitationUsesSeat=!['Observateur','Fournisseur externe'].includes(role)
    if(invitationUsesSeat&&billableRoles>=Number(workspace.seat_limit))return json({error:`La limite de ${workspace.seat_limit} siège(s) actif(s) est atteinte pour cet abonnement.`},409)

    const {data:invitation,error:inviteError}=await admin.from('workspace_invitations').insert({workspace_id:workspaceId,email,full_name:body.full_name||null,phone:body.phone||null,role,invited_by:user.id}).select().single()
    if(inviteError){
      if(inviteError.code==='23505')return json({error:'Une invitation est déjà en attente pour cette adresse.'},409)
      throw inviteError
    }

    if(existingProfile){
      const {error:memberError}=await admin.from('workspace_members').upsert({workspace_id:workspaceId,user_id:existingProfile.id,role,status:'Actif'},{onConflict:'workspace_id,user_id'})
      if(memberError){await admin.from('workspace_invitations').delete().eq('id',invitation.id);throw memberError}
      await admin.from('workspace_invitations').update({status:'Acceptée'}).eq('id',invitation.id)
      return json({ok:true,status:'member_added',message:'Le compte existant a été ajouté à l’organisation.'})
    }

    const configuredSite=Deno.env.get('SITE_URL')
    const origin=request.headers.get('origin')
    const redirectTo=`${(configuredSite||origin||'').replace(/\/$/,'')}/?invited=1`
    const {error:emailError}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{full_name:body.full_name||'',invited_workspace_id:workspaceId}})
    if(emailError){
      await admin.from('workspace_invitations').delete().eq('id',invitation.id)
      throw emailError
    }
    return json({ok:true,status:'email_sent',message:'Invitation envoyée par e-mail.'})
  }catch(error){
    return json({error:error instanceof Error?error.message:'Impossible d’envoyer cette invitation.'},500)
  }
})
