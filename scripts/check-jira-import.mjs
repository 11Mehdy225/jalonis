import {jiraTargets,parseJiraCsv} from '../src/services/jiraImport.js'

const assert=(condition,message)=>{if(!condition)throw new Error(message)}
const csv=`Issue key,Summary,Issue Type,Status,Priority,Assignee,Due date,Story Points,Sprint,Epic Link\nKAV-1,"Portail client, version 1",Epic,To Do,Highest,Awa,30/11/2026,8,Sprint 1,\nKAV-2,Connexion utilisateur,Story,In Progress,High,Koffi,2026-12-03,5,Sprint 1,KAV-1\nKAV-3,Corriger le profil,Bug,Done,Medium,Awa,2026-11-25,3,Sprint 1,KAV-1`
const parsed=parseJiraCsv(csv)
assert(parsed.issues.length===3,'Le nombre de tickets Jira est incorrect.')
assert(parsed.prefix==='KAV','Le préfixe du projet Jira est incorrect.')
assert(parsed.stats.epics===1&&parsed.stats.done===1&&parsed.stats.sprints===1,'La prévisualisation Jira est incorrecte.')
assert(parsed.issues[0].due_date==='2026-11-30','La date Jira française est mal convertie.')
assert(parsed.issues[1].status==='En cours'&&parsed.issues[2].status==='Terminé','Les statuts Jira sont mal convertis.')
assert(jiraTargets(parsed.issues[0],'Hybride')==='backlog_items','Un epic Jira hybride doit rejoindre le backlog.')
assert(jiraTargets({...parsed.issues[0],type:'Tâche'},'Hybride')==='tasks','Une tâche Jira hybride doit rejoindre le planning.')
console.log('Import Jira validé : CSV, aperçu, statuts, dates et cibles Kavelyo.')
