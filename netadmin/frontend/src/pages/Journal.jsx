import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge, Empty, Page } from '../components/ui'

export default function Journal() {
  const [rows, setRows] = useState(null)
  useEffect(() => { api('/changelog').then(setRows).catch(() => setRows([])) }, [])
  return (
    <Page title="Journal" subtitle="Dernières modifications envoyées aux appareils">
      {!rows ? null : !rows.length ? <Empty>Aucune modification pour l'instant</Empty> : (
        <div className="card divide-y divide-line">
          {rows.map((r) => (
            <details key={r.id} className="px-4 py-2.5">
              <summary className="flex cursor-pointer items-center gap-3">
                <Badge tone={r.ok ? 'ok' : 'err'}>{r.ok ? 'OK' : 'Échec'}</Badge>
                <span className="font-medium">{r.device}</span>
                <span className="truncate text-mute">{r.commands.split('\n')[0]}{r.commands.includes('\n') ? ' …' : ''}</span>
                <span className="ml-auto whitespace-nowrap text-mute">{new Date(r.at + 'Z').toLocaleString()}</span>
              </summary>
              <pre className="mt-2 overflow-auto font-mono text-[12px]">{r.commands}{r.output ? '\n\n' + r.output : ''}</pre>
            </details>
          ))}
        </div>
      )}
    </Page>
  )
}
