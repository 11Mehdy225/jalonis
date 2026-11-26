const clean=value=>String(value??'').replace(/^\uFEFF/,'').trim()
const normalized=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ' ).trim()

const countDelimiter=(line,delimiter)=>{let quoted=false,count=0;for(let i=0;i<line.length;i++){if(line[i]==='"'&&line[i+1]==='"'){i++;continue}if(line[i]==='"')quoted=!quoted;else if(!quoted&&line[i]===delimiter)count++}return count}
const detectDelimiter=text=>{const header=String(text).split(/\r?\n/,1)[0]||'';return [',',';','\t'].sort((a,b)=>countDelimiter(header,b)-countDelimiter(header,a))[0]}
const parseRows=(text,delimiter)=>{const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(char===delimiter&&!quoted){row.push(cell);cell=''}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>clean(value)))rows.push(row);row=[];cell=''}else cell+=char}row.push(cell);if(row.some(value=>clean(value)))rows.push(row);return rows}
const aliases={
  key:['issue key','key','cle du ticket','clé du ticket'],summary:['summary','resume','résumé','titre'],type:['issue type','type de ticket','type'],status:['status','statut'],priority:['priority','priorite','priorité'],assignee:['assignee','assignee name','responsable'],reporter:['reporter','rapporteur'],description:['description'],created:['created','cree','créé'],updated:['updated','mis a jour','mis à jour'],due:['due date','date d echeance','date échéance'],storyPoints:['story points','story point estimate','points'],sprint:['sprint'],epic:['epic link','epic name','epic'],parent:['parent','parent key','parent issue key'],estimate:['original estimate','original estimate seconds','estimation originale'],labels:['labels','etiquettes','étiquettes'],
}
const dateValue=value=>{const input=clean(value);if(!input)return null;const french=input.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);if(french)return `${french[3]}-${french[2].padStart(2,'0')}-${french[1].padStart(2,'0')}`;const parsed=new Date(input);return Number.isNaN(parsed.getTime())?null:parsed.toISOString().slice(0,10)}
const sprintName=value=>{const input=clean(value);if(!input)return '';const match=input.match(/name=([^,\]]+)/i);return clean(match?.[1]||input.split(',').pop())}
const status=value=>{const source=normalized(value);if(/done|closed|resolved|termine|ferme/.test(source))return 'Terminé';if(/progress|cours|developpement|review|test/.test(source))return 'En cours';if(/block|bloque|impediment/.test(source))return 'Bloqué';return 'À faire'}
const priority=value=>{const source=normalized(value);if(/highest|critique|urgent/.test(source))return 'Critique';if(/high|haute/.test(source))return 'Haute';if(/low|lowest|basse|faible/.test(source))return 'Faible';return 'Moyenne'}
const issueType=value=>{const source=normalized(value);if(source.includes('epic'))return 'Epic';if(/bug|defect|anomalie/.test(source))return 'Bug';if(/story|user story|recit/.test(source))return 'User Story';if(/sub task|sous tache/.test(source))return 'Sous-tâche';return 'Tâche'}

export function parseJiraCsv(text){
  const rows=parseRows(String(text||''),detectDelimiter(text));if(rows.length<2)throw new Error('Le fichier Jira ne contient aucune ligne exploitable.')
  const headers=rows[0].map(normalized),index=Object.fromEntries(Object.entries(aliases).map(([name,names])=>[name,headers.findIndex(header=>names.map(normalized).includes(header))]))
  if(index.summary<0)throw new Error('La colonne « Summary » ou « Résumé » est introuvable dans cet export Jira.')
  const value=(row,name)=>index[name]>=0?clean(row[index[name]]):''
  const issues=rows.slice(1).filter(row=>value(row,'summary')).map((row,position)=>({key:value(row,'key')||`JIRA-${position+1}`,summary:value(row,'summary'),type:issueType(value(row,'type')),status:status(value(row,'status')),priority:priority(value(row,'priority')),assignee:value(row,'assignee'),reporter:value(row,'reporter'),description:value(row,'description'),created:dateValue(value(row,'created')),updated:dateValue(value(row,'updated')),due_date:dateValue(value(row,'due')),story_points:Number(String(value(row,'storyPoints')).replace(',','.'))||0,sprint:sprintName(value(row,'sprint')),epic_key:value(row,'epic'),parent_key:value(row,'parent'),estimate_hours:Math.round((Number(value(row,'estimate'))||0)/3600*10)/10,labels:value(row,'labels')}))
  const prefix=issues[0]?.key?.split('-')[0]||'JIRA'
  return {issues,prefix,stats:{total:issues.length,epics:issues.filter(row=>row.type==='Epic').length,done:issues.filter(row=>row.status==='Terminé').length,sprints:new Set(issues.map(row=>row.sprint).filter(Boolean)).size,assignees:new Set(issues.map(row=>row.assignee).filter(Boolean)).size}}
}

export const jiraTargets=(issue,methodology)=>methodology==='Scrum'?'backlog_items':methodology==='Prédictif'?'tasks':['Epic','User Story','Bug'].includes(issue.type)?'backlog_items':'tasks'
