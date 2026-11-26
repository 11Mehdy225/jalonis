const addDays=(value,days)=>{const date=value?new Date(`${value}T12:00:00`):new Date();date.setDate(date.getDate()+days);return date.toISOString().slice(0,10)}

export const PROJECT_TEMPLATES=[
  {id:'blank',name:'Projet vide',description:'Démarrez avec un espace entièrement libre.',methodology:'Hybride'},
  {id:'predictive',name:'Projet prédictif',description:'Cadrage, planification, exécution et clôture.',methodology:'Prédictif'},
  {id:'scrum',name:'Produit Scrum',description:'Backlog initial, premier sprint et rituels.',methodology:'Scrum'},
  {id:'hybrid',name:'Transformation hybride',description:'Jalons directeurs et réalisation par sprints.',methodology:'Hybride'},
  {id:'audit',name:'Audit / Diagnostic',description:'Préparation, collecte, analyse et restitution.',methodology:'Prédictif'},
  {id:'supplier',name:'Projet avec fournisseurs',description:'Expression du besoin, consultation et suivi contractuel.',methodology:'Hybride'},
]

const task=(title,start,due,extra={})=>({title,status:'À faire',priority:'Moyenne',start_date:start,due_date:due,progress:0,...extra})

export async function seedProjectTemplate(templateId,project,api){
  if(!templateId||templateId==='blank')return
  const start=project.start_date||new Date().toISOString().slice(0,10)
  const definitions={
    predictive:[task('Cadrer le projet',start,addDays(start,7),{priority:'Haute',wbs_code:'1'}),task('Planifier les travaux',addDays(start,8),addDays(start,18),{wbs_code:'2'}),task('Exécuter le plan',addDays(start,19),addDays(start,55),{wbs_code:'3'}),task('Valider et clôturer',addDays(start,56),addDays(start,65),{priority:'Haute',wbs_code:'4',is_milestone:true})],
    hybrid:[task('Aligner la vision et les jalons',start,addDays(start,8),{priority:'Haute',wbs_code:'1'}),task('Préparer le backlog de réalisation',addDays(start,5),addDays(start,12),{wbs_code:'2'}),task('Piloter les lots et sprints',addDays(start,13),addDays(start,55),{wbs_code:'3'}),task('Déployer et mesurer les résultats',addDays(start,56),addDays(start,70),{wbs_code:'4',is_milestone:true})],
    audit:[task('Préparer la mission',start,addDays(start,5),{priority:'Haute',wbs_code:'1'}),task('Collecter les preuves',addDays(start,6),addDays(start,15),{wbs_code:'2'}),task('Analyser les constats',addDays(start,16),addDays(start,24),{wbs_code:'3'}),task('Restituer le rapport',addDays(start,25),addDays(start,30),{priority:'Haute',wbs_code:'4',is_milestone:true})],
    supplier:[task('Formaliser le besoin',start,addDays(start,7),{priority:'Haute',wbs_code:'1'}),task('Consulter les fournisseurs',addDays(start,8),addDays(start,20),{wbs_code:'2'}),task('Évaluer et contractualiser',addDays(start,21),addDays(start,32),{wbs_code:'3'}),task('Suivre les livrables',addDays(start,33),addDays(start,65),{wbs_code:'4'})],
  }
  if(templateId==='scrum'){
    const sprint=await api.entities.create('sprints',{project_id:project.id,name:'Sprint 1',goal:'Livrer un premier incrément utile',start_date:start,end_date:addDays(start,13),status:'Planifié',capacity_points:20})
    for(const [index,title] of ['Définir la vision produit','Identifier les premiers utilisateurs','Livrer le premier incrément','Recueillir les retours'].entries())await api.entities.create('backlog_items',{project_id:project.id,title,item_type:'User Story',priority:index<2?'Haute':'Moyenne',story_points:[3,5,8,3][index],status:'À faire',sprint_id:index>1?sprint.id:null,rank:index+1})
    await api.entities.create('action_items',{project_id:project.id,title:'Préparer le Sprint Planning',source_type:'Scrum',owner:project.manager||'',due_date:start,priority:'Haute',status:'À faire',progress:0})
    return
  }
  const created=[]
  for(const definition of definitions[templateId]||definitions.hybrid)created.push(await api.entities.create('tasks',{...definition,project_id:project.id}))
  for(let index=1;index<created.length;index++)await api.entities.create('task_dependencies',{project_id:project.id,task_id:created[index].id,predecessor_task_id:created[index-1].id,dependency_type:'FS',lag_days:0})
  await api.entities.create('risks',{project_id:project.id,title:templateId==='supplier'?'Retard ou défaillance fournisseur':'Dérive du délai cible',category:templateId==='supplier'?'Fournisseur':'Planning',probability:3,impact:4,owner:project.manager||'',response:'Définir les mesures préventives et le plan de repli.',status:'Ouvert',linked_task_id:created[1]?.id})
  await api.entities.create('action_items',{project_id:project.id,title:'Valider le cadrage de démarrage',source_type:'Modèle',source_label:PROJECT_TEMPLATES.find(item=>item.id===templateId)?.name,owner:project.manager||'',due_date:addDays(start,7),priority:'Haute',status:'À faire',progress:0,linked_task_id:created[0]?.id})
}
