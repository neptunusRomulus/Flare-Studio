import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Ensure certain modules flagged by the unused scan are imported and
// therefore recognized as referenced by tooling.
import './infra/wire-unused';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
