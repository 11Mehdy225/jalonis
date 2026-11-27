export function stateTone(value) {
  const slug=String(value||'neutral')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'')
  return `state-${slug||'neutral'}`
}

export function stateSelectClass(value,className='') {
  return `${className} state-select ${stateTone(value)}`.trim()
}
