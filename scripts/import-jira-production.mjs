import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { jiraTargets, parseJiraCsv } from '../src/services/jiraImport.js'

const args=process.argv.slice(2)
const valueOf=flag=>{const index=args.indexOf(flag);return index>=0?args[index+1]:null}
const commit=args.includes('--commit')
const email=valueOf('--email')
const csvPath=valueOf('--file')
const projectName=valueOf('--name')||'Migration Jira GV'
const methodology=valueOf('--methodology')||'Hybride'

assert(email,'Argument --email requis.')
assert(csvPath&&fs.existsSync(csvPath),'Argument --file invalide.')
assert(['Hybride','Scrum','Prédictif'].includes(methodology),'Méthodologie invalide.')

const env=fs.readFileSync('.env.local','utf8')
const envValue=name=>process.env[name]||env.match(new RegExp(`^${name}=(.+)$`,'m'))?.[1]?.trim()
const supabaseUrl=envValue('VITE_SUPABASE_URL')
const projectRef=process.env.SUPABASE_PROJECT_REF||'kevqvphmobkjzzkkbbqw'
assert(supabaseUrl,'Configuration Supabase absente.')

function serviceKeyFromCli(){
  const raw=execFileSync('./node_modules/.bin/supabase',['projects','api-keys',`--remote=${projectRef}`,'--reveal','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
  const parsed=JSON.parse(raw)
  const rows=Array.isArray(parsed)?parsed:[]
  const direct=rows.find(item=>item?.type==='secret'&&item?.secret_jwt_template?.role==='service_role')||rows.find(item=>item?.id==='service_role'||item?.name==='service_role')
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
  assert(candidates[0]?.value,'Clé serveur Supabase introuvable.')
  return candidates[0].value
}

const db=createClient(supabaseUrl,serviceKeyFromCli(),{auth:{persistSession:false,autoRefreshToken:false}})
const unwrap=({data,error},label)=>{if(error)throw new Error(`${label}: ${error.message}`);return data}

async function findUser(targetEmail){
  for(let page=1;page<=20;page++){
    const result=unwrap(await db.auth.admin.listUsers({page,perPage:100}),'Lecture des comptes')
    const user=result.users.find(row=>(row.email||'').toLowerCase()===targetEmail.toLowerCase())
    if(user)return user
    if(result.users.length<100)break
  }
  throw new Error(`Compte introuvable : ${targetEmail}`)
}

async function main(){
  const parsed=parseJiraCsv(fs.readFileSync(csvPath,'utf8'))
  const user=await findUser(email)
  const owned=unwrap(await db.from('workspaces').select('id,name,created_at').eq('created_by',user.id).order('created_at',{ascending:false}),'Lecture des espaces administrés')
  const memberships=unwrap(await db.from('workspace_members').select('workspace_id,role,status,created_at').eq('user_id',user.id).eq('status','Actif').order('created_at',{ascending:false}),'Lecture des accès')
  const workspace=owned[0]||unwrap(await db.from('workspaces').select('id,name,created_at').in('id',memberships.map(row=>row.workspace_id)).order('created_at',{ascending:false}).limit(1).single(),'Sélection de l’espace')
  assert(workspace,'Aucun espace de travail actif.')
  const duplicate=unwrap(await db.from('projects').select('id,name,code').eq('workspace_id',workspace.id).eq('name',projectName).maybeSingle(),'Contrôle des doublons')
  const targets=parsed.issues.reduce((count,issue)=>{const target=jiraTargets(issue,methodology);count[target]=(count[target]||0)+1;return count},{})
  console.log(JSON.stringify({mode:commit?'import':'vérification',account:email,workspace:workspace.name,project:projectName,prefix:parsed.prefix,...parsed.stats,distribution:{planning:targets.tasks||0,backlog:targets.backlog_items||0},duplicate:Boolean(duplicate)},null,2))
  if(!commit)return
  if(duplicate)throw new Error(`Le projet « ${projectName} » existe déjà (${duplicate.id}).`)

  const projectId=crypto.randomUUID()
  let created=false
  try{
    unwrap(await db.from('projects').insert({id:projectId,workspace_id:workspace.id,created_by:user.id,name:projectName,code:parsed.prefix||'JIRA',description:'Projet migré depuis un export CSV Jira.',methodology,status:'Initialisation',health:'good',budget:0}),'Création du projet')
    created=true

    const assignees=[...new Set(parsed.issues.map(row=>row.assignee).filter(Boolean))]
    if(assignees.length)unwrap(await db.from('team').insert(assignees.map(name=>({project_id:projectId,name,role:'Membre importé depuis Jira',availability:100}))),'Importation de l’équipe')

    const sprintIds=new Map([...new Set(parsed.issues.map(row=>row.sprint).filter(Boolean))].map(name=>[name,crypto.randomUUID()]))
    if(sprintIds.size)unwrap(await db.from('sprints').insert([...sprintIds].map(([name,id])=>({id,project_id:projectId,name,status:'Planifié',capacity_points:0}))),'Importation des sprints')

    const ordered=[...parsed.issues].sort((a,b)=>(a.type==='Epic'?-1:1)-(b.type==='Epic'?-1:1))
    const createdByKey=new Map(ordered.map(issue=>[issue.key,{id:crypto.randomUUID(),target:jiraTargets(issue,methodology)}]))
    const backlog=[],tasks=[]
    ordered.forEach((issue,rank)=>{
      const record=createdByKey.get(issue.key)
      const title=`${issue.key} · ${issue.summary}`
      const trace=[issue.description,issue.reporter&&`Rapporteur Jira : ${issue.reporter}`,issue.labels&&`Étiquettes Jira : ${issue.labels}`,issue.parent_key&&`Parent Jira : ${issue.parent_key}`].filter(Boolean).join('\n\n')
      if(record.target==='backlog_items'){
        const parent=createdByKey.get(issue.epic_key||issue.parent_key)
        backlog.push({id:record.id,project_id:projectId,title,item_type:issue.type,status:issue.status==='À faire'?'Backlog':issue.status,priority:issue.priority,description:trace,story_points:issue.story_points,sprint_id:sprintIds.get(issue.sprint)||null,assignee:issue.assignee||null,epic:issue.epic_key||null,parent_epic_id:parent?.target==='backlog_items'&&parent.id!==record.id?parent.id:null,rank})
      }else tasks.push({id:record.id,project_id:projectId,title,wbs_code:issue.key,status:issue.status,priority:issue.priority,assignee:issue.assignee||null,start_date:issue.created,due_date:issue.due_date,work_hours:issue.estimate_hours,progress:issue.status==='Terminé'?100:issue.status==='En cours'?50:0,notes:trace})
    })
    if(backlog.length)unwrap(await db.from('backlog_items').insert(backlog),'Importation du backlog')
    if(tasks.length)unwrap(await db.from('tasks').insert(tasks),'Importation du planning')

    const [projectRows,teamRows,sprintRows,backlogRows,taskRows]=await Promise.all([
      db.from('projects').select('id,name,code,status').eq('id',projectId).single(),
      db.from('team').select('id',{count:'exact',head:true}).eq('project_id',projectId),
      db.from('sprints').select('id',{count:'exact',head:true}).eq('project_id',projectId),
      db.from('backlog_items').select('id',{count:'exact',head:true}).eq('project_id',projectId),
      db.from('tasks').select('id',{count:'exact',head:true}).eq('project_id',projectId),
    ])
    const project=unwrap(projectRows,'Vérification du projet')
    for(const [result,label] of [[teamRows,'équipe'],[sprintRows,'sprints'],[backlogRows,'backlog'],[taskRows,'planning']])if(result.error)throw new Error(`Vérification ${label}: ${result.error.message}`)
    const counts={team:teamRows.count||0,sprints:sprintRows.count||0,backlog:backlogRows.count||0,planning:taskRows.count||0}
    assert.equal(counts.backlog+counts.planning,parsed.issues.length,'Le nombre de tickets importés ne correspond pas au CSV.')
    console.log(JSON.stringify({success:true,project,counts,total:counts.backlog+counts.planning},null,2))
  }catch(error){
    if(created)await db.from('projects').delete().eq('id',projectId)
    throw error
  }
}

await main()
