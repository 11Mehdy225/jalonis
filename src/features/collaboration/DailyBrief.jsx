import { CalendarClock, CheckCircle2, CircleAlert, Clock3, Sparkles } from 'lucide-react'

const dayKey = value => value ? String(value).slice(0, 10) : ''
const todayKey = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }

export default function DailyBrief({ entities, onOpenTasks, onOpenRisks }) {
  const today = todayKey()
  const activeTasks = entities.tasks.filter(item => item.status !== 'Terminé')
  const overdue = activeTasks.filter(item => item.due_date && dayKey(item.due_date) < today)
  const dueToday = activeTasks.filter(item => dayKey(item.due_date) === today)
  const blocked = activeTasks.filter(item => ['Bloqué','En attente'].includes(item.status))
  const meetings = entities.meetings.filter(item => dayKey(item.meeting_date) === today)
  const critical = entities.risks.filter(item => item.status !== 'Fermé' && Number(item.probability) * Number(item.impact) >= 15)
  const completed = entities.tasks.filter(item => item.status === 'Terminé').length
  const quiet = !overdue.length && !dueToday.length && !blocked.length && !critical.length
  return <section className="daily-brief card"><div className="daily-brief-intro"><span><Sparkles size={17}/></span><div><small>BRIEF DU JOUR</small><h3>{quiet ? 'La trajectoire est sous contrôle.' : 'Voici les points qui demandent votre attention.'}</h3><p>{new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date())}</p></div></div><div className="daily-brief-signals"><button className={overdue.length?'alert':''} onClick={onOpenTasks}><Clock3 size={16}/><span><b>{overdue.length}</b>en retard</span></button><button className={blocked.length?'warning':''} onClick={onOpenTasks}><CircleAlert size={16}/><span><b>{blocked.length}</b>bloquée(s)</span></button><button onClick={onOpenTasks}><CalendarClock size={16}/><span><b>{dueToday.length + meetings.length}</b>aujourd’hui</span></button><button onClick={onOpenRisks}><CircleAlert size={16}/><span><b>{critical.length}</b>risque(s)</span></button><div><CheckCircle2 size={16}/><span><b>{completed}</b>terminée(s)</span></div></div></section>
}
