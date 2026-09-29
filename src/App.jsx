import React from 'react'
import ViewerPage from './ViewerPage.jsx'
import ScannerPage from './ScannerPage.jsx'

export default function App() {
  const path = window.location.pathname.toLowerCase()
  if (path.startsWith('/scan')) return <ScannerPage />
  return <ViewerPage />
}
