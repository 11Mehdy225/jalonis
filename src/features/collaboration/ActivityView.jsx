import { useState } from 'react'
import { Activity, CheckCircle2, MessageSquareText, Send, UserRoundCheck, Workflow } from 'lucide-react'

const eventIcon = type => {
  if (type === 'comment.created') return MessageSquareText
  if (type === 'status.changed') return CheckCircle2
  if (type === 'assignment.changed') return UserRoundCheck
  return Workflow
}

const fullDate = value => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

export default function ActivityView({ project, comments, activities, currentUser, onComment }) {
  const [message, setMessage] = useState('')
  const submit = async event => {
    event.preventDefault()
    const body = message.trim()
    if (!body) return
    await onComment({ entity_type: 'project', entity_id: project.id, author_name: currentUser?.full_name || 'Chef de projet', body })
    setMessage('')
  }
  return <div className="collaboration-view">
    <section className="discussion-card card">
      <div className="collaboration-heading"><div className="collaboration-icon"><MessageSquareText size={19}/></div><div><span>DISCUSSION DU PROJET</span><h3>Échanger avec l’équipe</h3><p>Les mentions avec @ et les nouveaux messages alimentent les notifications.</p></div></div>
      <form className="comment-composer" onSubmit={submit}><div className="comment-avatar">{(currentUser?.full_name || 'CP').split(' ').map(part => part[0]).slice(0,2).join('')}</div><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Écrire un message ou mentionner @un-membre…"/><button disabled={!message.trim()} title="Publier"><Send size={16}/>Publier</button></form>
      <div className="comment-list">{comments.length ? comments.map(comment => <article className="comment-item" key={comment.id}><div className="comment-avatar muted">{(comment.author_name || 'CP').split(' ').map(part => part[0]).slice(0,2).join('')}</div><div><header><b>{comment.author_name || 'Chef de projet'}</b><time>{fullDate(comment.created_at)}</time></header><p>{comment.body}</p></div></article>) : <div className="collaboration-empty"><MessageSquareText size={22}/><span>Lancez la première discussion de ce projet.</span></div>}</div>
    </section>
    <section className="activity-card card">
      <div className="collaboration-heading"><div className="collaboration-icon"><Activity size={19}/></div><div><span>JOURNAL D’ACTIVITÉ</span><h3>Ce qui a changé</h3><p>Un historique automatique des actions importantes.</p></div></div>
      <div className="activity-list">{activities.length ? activities.map(item => { const Icon = eventIcon(item.event_type); return <article className="activity-item" key={item.id}><span><Icon size={15}/></span><div><b>{item.title}</b><p>{item.description}</p><small>{item.actor_name || 'Jalonis'} · {fullDate(item.created_at)}</small></div></article> }) : <div className="collaboration-empty"><Activity size={22}/><span>Les prochaines actions apparaîtront ici.</span></div>}</div>
    </section>
  </div>
}
