import { useMemo, useRef, useState } from 'react'
import { Send, UserRound } from 'lucide-react'

const activeMembers = members => members.filter(member => !member.invitation && member.membership_status !== 'Invitation en attente')

export const mentionIds = value => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try { return JSON.parse(value) } catch { return String(value).split(',').filter(Boolean) }
}

export function CommentBody({ body, members=[] }) {
  const names=activeMembers(members).map(member=>member.full_name||member.name).filter(Boolean).sort((a,b)=>b.length-a.length)
  if (!names.length) return <>{body}</>
  const escaped=names.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
  const parts=String(body||'').split(new RegExp(`(@(?:${escaped.join('|')}))`,'gi'))
  return <>{parts.map((part,index)=>part.startsWith('@')?<mark className="comment-mention" key={`${part}-${index}`}>{part}</mark>:part)}</>
}

export default function MentionComposer({ members=[], currentUser, onSubmit, compact=false, autoFocus=false }) {
  const [body,setBody]=useState('')
  const [selectedIds,setSelectedIds]=useState([])
  const [query,setQuery]=useState(null)
  const textareaRef=useRef(null)
  const candidates=useMemo(()=>activeMembers(members).filter(member=>member.id!==currentUser?.id),[members,currentUser?.id])
  const suggestions=query===null?[]:candidates.filter(member=>`${member.full_name||member.name||''} ${member.email||''}`.toLowerCase().includes(query.toLowerCase())).slice(0,6)

  const change=event=>{
    const value=event.target.value
    const cursor=event.target.selectionStart
    const before=value.slice(0,cursor)
    const match=before.match(/(?:^|\s)@([^@\n]*)$/)
    setBody(value)
    setQuery(match?match[1]:null)
  }
  const choose=member=>{
    const textarea=textareaRef.current
    const cursor=textarea?.selectionStart??body.length
    const before=body.slice(0,cursor)
    const match=before.match(/(?:^|\s)@([^@\n]*)$/)
    if(!match)return
    const at=before.lastIndexOf('@')
    const name=member.full_name||member.name
    const next=`${body.slice(0,at)}@${name} ${body.slice(cursor)}`
    setBody(next)
    setSelectedIds(ids=>[...new Set([...ids,member.id])])
    setQuery(null)
    requestAnimationFrame(()=>{const position=at+name.length+2;textarea?.focus();textarea?.setSelectionRange(position,position)})
  }
  const submit=async event=>{
    event.preventDefault()
    const message=body.trim()
    if(!message)return
    const retained=selectedIds.filter(id=>{const member=candidates.find(item=>item.id===id);return member&&message.includes(`@${member.full_name||member.name}`)})
    await onSubmit(message,retained)
    setBody('');setSelectedIds([]);setQuery(null)
  }
  return <form className={compact?'entity-comment-form mention-composer':'comment-composer mention-composer'} onSubmit={submit}>
    {!compact&&<div className="comment-avatar">{(currentUser?.full_name||'CP').split(' ').map(part=>part[0]).slice(0,2).join('')}</div>}
    <div className="mention-input"><textarea ref={textareaRef} autoFocus={autoFocus} value={body} onChange={change} onKeyDown={event=>{if(event.key==='Escape')setQuery(null)}} placeholder="Écrire un message ou mentionner @un-membre…"/>{query!==null&&<div className="mention-menu">{suggestions.length?suggestions.map(member=><button type="button" key={member.id} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(member)}><span className="mention-avatar"><UserRound size={14}/></span><span><b>{member.full_name||member.name}</b><small>{member.role||member.email||'Membre'}</small></span></button>):<p>Aucun membre correspondant</p>}</div>}</div>
    <button className={compact?'btn primary':''} disabled={!body.trim()} title="Publier"><Send size={compact?15:16}/>Publier</button>
  </form>
}
