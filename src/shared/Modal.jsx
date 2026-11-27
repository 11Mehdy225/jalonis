import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, children, onClose }) {
  const titleId=useId(),dialogRef=useRef(null),closeRef=useRef(null),closeHandler=useRef(onClose)
  closeHandler.current=onClose

  useEffect(()=>{
    const previousFocus=document.activeElement
    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    closeRef.current?.focus()
    const onKeyDown=event=>{
      if(event.key==='Escape'){event.preventDefault();closeHandler.current()}
      if(event.key!=='Tab')return
      const focusable=[...dialogRef.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      if(!focusable.length)return
      const first=focusable[0],last=focusable[focusable.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',onKeyDown)
    return()=>{
      document.removeEventListener('keydown',onKeyDown)
      document.body.style.overflow=previousOverflow
      previousFocus?.focus?.()
    }
  },[])

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">Kavelyo</span><h2 id={titleId}>{title}</h2></div><button ref={closeRef} type="button" className="icon-btn modal-close" aria-label="Fermer la fenêtre" onClick={onClose}><X size={19}/></button></div>
      {children}
    </div>
  </div>
}
