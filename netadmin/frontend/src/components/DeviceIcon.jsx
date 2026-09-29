import { Box, Cloud, Monitor, Network, Phone, Printer, Router, Server, ShieldCheck, Wifi } from 'lucide-react'

const MAP = { router: Router, switch: Network, firewall: ShieldCheck, ap: Wifi, server: Server, pc: Monitor, printer: Printer, phone: Phone, cloud: Cloud, other: Box }
export const KIND_LABEL = { router: 'Routeur', switch: 'Switch', firewall: 'Pare-feu', ap: 'Borne Wi-Fi', server: 'Serveur', pc: 'PC utilisateur', printer: 'Imprimante', phone: 'Téléphone', cloud: 'Internet / Cloud', other: 'Autre' }

export default function DeviceIcon({ kind, size = 16, className }) {
  const I = MAP[kind] || Box
  return <I size={size} className={className} />
}
