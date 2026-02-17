import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './hooks/use-theme.tsx' // Import the new ThemeProvider

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <App />
      </ThemeProvider>
    </Router>
  </React.StrictMode>,
)
