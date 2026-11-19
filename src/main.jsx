import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AuthGate from './features/auth/AuthGate'
import './styles/styles.css'
import './styles/calendar.css'
import './styles/gantt.css'
import './styles/relations.css'
import './styles/scrum.css'
import './styles/suppliers.css'
import './styles/project-shell.css'

createRoot(document.getElementById('root')).render(<React.StrictMode><AuthGate><App /></AuthGate></React.StrictMode>)
