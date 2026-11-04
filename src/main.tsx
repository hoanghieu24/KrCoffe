import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AdminDashboard } from './admin/AdminDashboard'
import './styles.css'

const isAdminRoute =
  typeof window !== 'undefined' &&
  (window.location.pathname.startsWith('/hieuadmin') || window.location.hash.startsWith('#hieuadmin'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminDashboard /> : <App />}
  </React.StrictMode>,
)
