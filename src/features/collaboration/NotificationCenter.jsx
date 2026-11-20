import { Bell, CheckCheck, CircleAlert, MessageSquareText, UserRoundCheck, Workflow, X } from 'lucide-react'

const iconFor = type => {
  if (type === 'comment.created') return MessageSquareText
  if (type === 'assignment.changed') return UserRoundCheck
  if (type === 'risk.critical') return CircleAlert
  return Workflow
}

const relativeTime = value => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'À l’instant'
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(value))
}

export default function NotificationCenter({ notifications, onRead, onReadAll, onClose }) {
  const unread = notifications.filter(item => !Number(item.is_read)).length
  return <aside className="notification-center">
    <div className="notification-head"><div><span>NOTIFICATIONS</span><h3>{unread ? `${unread} nouvelle${unread > 1 ? 's' : ''}` : 'Vous êtes à jour'}</h3></div><button onClick={onClose} title="Fermer"><X size={17}/></button></div>
    {unread > 0 && <button className="notification-read-all" onClick={onReadAll}><CheckCheck size={15}/>Tout marquer comme lu</button>}
    <div className="notification-list">{notifications.length ? notifications.slice(0, 30).map(item => {
      const Icon = iconFor(item.event_type)
      return <button className={`notification-item${Number(item.is_read) ? '' : ' unread'}`} key={item.id} onClick={() => onRead(item.id)}>
        <span className="notification-icon"><Icon size={16}/></span><span><b>{item.title}</b><small>{item.body}</small><em>{relativeTime(item.created_at)}</em></span>{!Number(item.is_read) && <i/>}
      </button>
    }) : <div className="notification-empty"><Bell size={25}/><b>Aucune notification</b><span>Les changements importants du projet apparaîtront ici.</span></div>}</div>
  </aside>
}
