import { useApp } from '../store'
import { StatusDot } from './ui'

export default function DevicePicker() {
  const { managed, selected, setSelectedId } = useApp()
  if (!managed.length) return null
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={selected?.status} />
      <select className="input !w-52" value={selected?.id || ''} onChange={(e) => setSelectedId(Number(e.target.value))}>
        {managed.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </div>
  )
}
