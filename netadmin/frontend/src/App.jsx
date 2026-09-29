import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Config from './pages/Config'
import Console from './pages/Console'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import { Interfaces, Neighbors, Routing, Tables, Vlans } from './pages/Data'
import Journal from './pages/Journal'
import Login from './pages/Login'
import Settings from './pages/Settings'
import System from './pages/System'
import Topology from './pages/Topology'
import { useApp } from './store'

export default function App() {
  const { authed } = useApp()
  if (!authed) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="topologie" element={<Topology />} />
        <Route path="appareils" element={<Devices />} />
        <Route path="interfaces" element={<Interfaces />} />
        <Route path="vlans" element={<Vlans />} />
        <Route path="routage" element={<Routing />} />
        <Route path="voisins" element={<Neighbors />} />
        <Route path="tables" element={<Tables />} />
        <Route path="systeme" element={<System />} />
        <Route path="config" element={<Config />} />
        <Route path="console" element={<Console />} />
        <Route path="journal" element={<Journal />} />
        <Route path="reglages" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
