import { X } from 'lucide-react'

export default function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">Jalonis</span><h2>{title}</h2></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
      {children}
    </div>
  </div>
}
