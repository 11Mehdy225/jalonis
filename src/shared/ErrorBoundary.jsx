import React from 'react'
import { trackTelemetry } from '../services/telemetry'

export default class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  componentDidCatch(error,details){console.error('Kavelyo UI error',error,details);trackTelemetry('client_error',{severity:'critical',message:error?.message||'Erreur React',fingerprint:`react:${details?.componentStack?.split('\n')[1]||error?.name||'boundary'}`})}
  render(){
    if(!this.state.error)return this.props.children
    return <main className="fatal-error-page"><section><img src="./assets/kavelyo-logo.png" alt="Logo Kavelyo"/><span>INCIDENT D’AFFICHAGE</span><h1>Kavelyo n’a pas pu ouvrir cet écran.</h1><p>Vos données n’ont pas été supprimées. Rechargez l’application ; si le problème persiste, transmettez l’heure de l’incident au support.</p><button onClick={()=>window.location.reload()}>Recharger Kavelyo</button></section></main>
  }
}
