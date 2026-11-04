import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AdminDashboard } from './admin/AdminDashboard'
import './styles.css'

const isAdminRoute =
  typeof window !== 'undefined' &&
  (window.location.pathname.startsWith('/admin') || window.location.hash.startsWith('#admin'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminDashboard /> : <App />}
  </React.StrictMode>,
)
