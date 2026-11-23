import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

if(process.env.JALONIS_ALLOW_LIVE_TEST!=='1')throw new Error('Ajoutez JALONIS_ALLOW_LIVE_TEST=1 pour autoriser ce test temporaire.')

const projectRef=process.env.SUPABASE_PROJECT_REF||'kevqvphmobkjzzkkbbqw'
const env=fs.readFileSync('.env.local','utf8')
const value=name=>process.env[name]||env.match(new RegExp(`^${name}=(.+)$`,'m'))?.[1]?.trim()
const supabaseUrl=value('VITE_SUPABASE_URL')
const anonKey=value('VITE_SUPABASE_ANON_KEY')
assert(supabaseUrl&&anonKey,'Configuration publique Supabase absente.')

function serviceKeyFromCli(){
  let raw
  try{
    raw=execFileSync('./node_modules/.bin/supabase',['projects','api-keys',`--remote=${projectRef}`,'--reveal','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
  }catch{
    throw new Error('Connexion Supabase CLI requise. Exécutez « npx supabase login --token VOTRE_TOKEN » dans votre terminal.')
  }
  const parsed=JSON.parse(raw)
  const direct=Array.isArray(parsed)?parsed.find(item=>item?.type==='secret'&&item?.secret_jwt_template?.role==='service_role')||parsed.find(item=>item?.id==='service_role'||item?.name==='service_role'):null
  if(direct?.api_key)return direct.api_key
  const candidates=[]
  const visit=(node,path='')=>{
    if(Array.isArray(node))return node.forEach((item,index)=>visit(item,`${path}.${index}`))
    if(!node||typeof node!=='object')return
    const context=`${path} ${node.name||''} ${node.type||''} ${node.role||''}`.toLowerCase()
    for(const [key,item] of Object.entries(node)){
      if(typeof item==='string'&&(item.startsWith('sb_secret_')||item.startsWith('eyJ'))){
        const label=`${context} ${key}`.toLowerCase()
        if(!/anon|publishable/.test(label))candidates.push({value:item,score:(/service[_ -]?role/.test(label)?20:0)+(/secret/.test(label)?5:0)})
      }else visit(item,`${path}.${key}`)
    }
  }
  visit(parsed)
  candidates.sort((a,b)=>b.score-a.score)
  if(!candidates[0]?.value)throw new Error('Clé serveur Supabase introuvable dans le profil connecté.')
  return candidates[0].value
}

const admin=createClient(supabaseUrl,serviceKeyFromCli(),{auth:{persistSession:false,autoRefreshToken:false}})
const browserClient=()=>createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
const stamp=`${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
const ownerEmail=`jalonis.owner.${stamp}@example.com`
const memberEmail=`jalonis.member.${stamp}@example.com`
const password=()=>`Jal!${crypto.randomBytes(20).toString('base64url')}9a`
const ownerPassword=password(),memberPassword=password()
let ownerId,memberId,ownerWorkspaceId,memberWorkspaceId

const unwrap=({data,error},label)=>{if(error)throw new Error(`${label}: ${error.message}`);return data}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))

async function cleanupTestUsers(){
  const users=[]
  for(let page=1;page<=10;page++){
    const result=unwrap(await admin.auth.admin.listUsers({page,perPage:100}),'Lecture des comptes de test')
    users.push(...result.users)
    if(result.users.length<100)break
  }
  const targets=users.filter(user=>/^jalonis\.(owner|member)\..+@example\.com$/i.test(user.email||''))
  if(!targets.length)return 0
  const ids=targets.map(user=>user.id)
  unwrap(await admin.from('workspaces').delete().in('created_by',ids),'Nettoyage des espaces de test')
  for(const user of targets)unwrap(await admin.auth.admin.deleteUser(user.id),'Suppression d’un compte de test')
  return targets.length
}

async function waitForProfile(userId){
  for(let attempt=0;attempt<20;attempt++){
    const profile=unwrap(await admin.from('profiles').select('id').eq('id',userId).maybeSingle(),'Lecture du profil de test')
    if(profile)return
    await wait(150)
  }
  throw new Error('Le profil de test n’a pas été créé par le déclencheur Supabase.')
}

async function main(){
  await cleanupTestUsers()
  const owner=unwrap(await admin.auth.admin.createUser({email:ownerEmail,password:ownerPassword,email_confirm:true,user_metadata:{full_name:'Propriétaire automatisé',account_type:'Organisation',workspace_name:'Organisation test automatisée'}}),'Création du propriétaire')
  ownerId=owner.user.id
  const member=unwrap(await admin.auth.admin.createUser({email:memberEmail,password:memberPassword,email_confirm:true,user_metadata:{full_name:'Collaborateur automatisé',account_type:'Personnel'}}),'Création du collaborateur')
  memberId=member.user.id
  await Promise.all([waitForProfile(ownerId),waitForProfile(memberId)])

  ownerWorkspaceId=unwrap(await admin.from('workspaces').select('id').eq('created_by',ownerId).single(),'Espace du propriétaire').id
  memberWorkspaceId=unwrap(await admin.from('workspaces').select('id').eq('created_by',memberId).single(),'Espace privé du collaborateur').id
  const ownerClient=browserClient(),memberClient=browserClient()
  unwrap(await ownerClient.auth.signInWithPassword({email:ownerEmail,password:ownerPassword}),'Connexion du propriétaire')
  unwrap(await memberClient.auth.signInWithPassword({email:memberEmail,password:memberPassword}),'Connexion du collaborateur')

  const invitation=unwrap(await ownerClient.functions.invoke('invite-member',{body:{workspace_id:ownerWorkspaceId,email:memberEmail,full_name:'Collaborateur automatisé',role:'Membre'}}),'Invitation du collaborateur')
  assert.equal(invitation.status,'member_added','Le compte existant doit être ajouté immédiatement.')
  const membership=unwrap(await memberClient.from('workspace_members').select('role,status').eq('workspace_id',ownerWorkspaceId).eq('user_id',memberId).single(),'Accès du collaborateur')
  assert.deepEqual(membership,{role:'Membre',status:'Actif'})

  const project=unwrap(await ownerClient.from('projects').insert({workspace_id:ownerWorkspaceId,name:'Projet collaboratif automatisé',code:'AUTO-COLLAB',methodology:'Hybride',budget:100000,start_date:'2026-11-22',end_date:'2026-11-30'}).select().single(),'Création du projet partagé')
  const privateProject=unwrap(await memberClient.from('projects').insert({workspace_id:memberWorkspaceId,name:'Projet privé du collaborateur',code:'AUTO-PRIVATE',budget:0}).select().single(),'Création du projet privé')
  const hidden=unwrap(await ownerClient.from('projects').select('id').eq('id',privateProject.id).maybeSingle(),'Contrôle d’isolation')
  assert.equal(hidden,null,'Le propriétaire ne doit pas voir le projet privé du collaborateur.')

  let realtimeResolve,realtimeReject
  const realtimeEvent=new Promise((resolve,reject)=>{realtimeResolve=resolve;realtimeReject=reject})
  const channel=memberClient.channel(`collaboration-test-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'tasks',filter:`project_id=eq.${project.id}`},payload=>realtimeResolve(payload.new))
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Abonnement Realtime non établi.')),10000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve()}else if(['CHANNEL_ERROR','TIMED_OUT'].includes(status)){clearTimeout(timer);reject(new Error(`Realtime ${status}`))}})})

  const task=unwrap(await ownerClient.from('tasks').insert({project_id:project.id,title:'Tâche partagée',assignee_id:memberId,status:'À faire',progress:0}).select().single(),'Création de la tâche partagée')
  const received=await Promise.race([realtimeEvent,new Promise((_,reject)=>setTimeout(()=>{realtimeReject?.(new Error('Événement Realtime absent.'));reject(new Error('Événement Realtime absent.'))},10000))])
  assert.equal(received.id,task.id,'Le collaborateur reçoit une mauvaise tâche en temps réel.')
  unwrap(await memberClient.from('tasks').update({status:'Terminé',progress:100}).eq('id',task.id),'Mise à jour par le collaborateur')
  const ownerTask=unwrap(await ownerClient.from('tasks').select('status,progress').eq('id',task.id).single(),'Lecture de la mise à jour')
  assert.deepEqual(ownerTask,{status:'Terminé',progress:100})

  const comment=unwrap(await memberClient.from('comments').insert({project_id:project.id,entity_type:'tasks',entity_id:task.id,body:'Travail terminé. @Propriétaire automatisé',author_name:'Collaborateur automatisé',mentioned_user_ids:[ownerId]}).select().single(),'Ajout du commentaire')
  unwrap(await memberClient.from('notifications').insert({project_id:project.id,recipient_id:ownerId,event_type:'mention.created',entity_type:'tasks',entity_id:task.id,title:'Vous avez été mentionné',body:comment.body}),'Création de la notification')
  const notification=unwrap(await ownerClient.from('notifications').select('event_type,is_read').eq('project_id',project.id).eq('recipient_id',ownerId).single(),'Lecture de la notification')
  assert.deepEqual(notification,{event_type:'mention.created',is_read:false})

  await memberClient.removeChannel(channel)
  await Promise.all([ownerClient.auth.signOut(),memberClient.auth.signOut()])
  console.log('Collaboration réelle validée : 2 comptes, invitation, RLS, tâche temps réel, mise à jour, mention et notification.')
}

try{
  await main()
}finally{
  const removed=await cleanupTestUsers()
  console.log(`Nettoyage terminé : ${removed} compte(s) temporaire(s) supprimé(s).`)
}
