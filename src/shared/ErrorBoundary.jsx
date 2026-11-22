import React from 'react'

export default class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  componentDidCatch(error,details){console.error('Jalonis UI error',error,details)}
  render(){
    if(!this.state.error)return this.props.children
    return <main className="fatal-error-page"><section><img src="./assets/jalonis-logo.png" alt="Logo Jalonis"/><span>INCIDENT D’AFFICHAGE</span><h1>Jalonis n’a pas pu ouvrir cet écran.</h1><p>Vos données n’ont pas été supprimées. Rechargez l’application ; si le problème persiste, transmettez l’heure de l’incident au support.</p><button onClick={()=>window.location.reload()}>Recharger Jalonis</button></section></main>
  }
}
