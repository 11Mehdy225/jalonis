import { useState } from 'react'
import { MessageSquareText, Send } from 'lucide-react'

const stamp = value => new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value))

export default function EntityDiscussion({ entity, entityType, comments, currentUser, onComment }) {
  const [body,setBody]=useState('')
  const rows=comments.filter(item=>item.entity_type===entityType&&item.entity_id===entity.id)
  const submit=async event=>{event.preventDefault();const message=body.trim();if(!message)return;await onComment({entity_type:entityType,entity_id:entity.id,author_name:currentUser?.full_name||'Chef de projet',body:message});setBody('')}
  return <div className="entity-discussion"><div className="entity-discussion-title"><MessageSquareText size={17}/><div><b>{entity.title||entity.name}</b><small>{rows.length} message{rows.length>1?'s':''}</small></div></div><div className="entity-comment-list">{rows.length?rows.map(item=><article key={item.id}><span className="comment-avatar muted">{(item.author_name||'CP').split(' ').map(part=>part[0]).slice(0,2).join('')}</span><div><header><b>{item.author_name||'Chef de projet'}</b><time>{stamp(item.created_at)}</time></header><p>{item.body}</p></div></article>):<div className="collaboration-empty"><MessageSquareText size={22}/><span>Aucun message sur cet élément.</span></div>}</div><form className="entity-comment-form" onSubmit={submit}><textarea autoFocus value={body} onChange={event=>setBody(event.target.value)} placeholder="Écrire un commentaire ou mentionner @un-membre…"/><button className="btn primary" disabled={!body.trim()}><Send size={15}/>Publier</button></form></div>
}
