const SCHEME = import.meta.env.VITE_PUBLIC_SCHEME || 'http'
const VPS_IP = import.meta.env.VITE_VPS_IP || '127.0.0.1'
const PREFIX = import.meta.env.VITE_PHISHLET_URL_PREFIX || 'path'
const ROUTER_PORT = import.meta.env.VITE_PHISHLET_ROUTER_PORT || '80'

export function phishletUrl(key, port) {
  if (PREFIX === 'port') {
    return `${SCHEME}://${VPS_IP}:${port}`
  }
  if (ROUTER_PORT === '80') {
    return `${SCHEME}://${VPS_IP}/${key}/`
  }
  return `${SCHEME}://${VPS_IP}:${ROUTER_PORT}/${key}/`
}

export function getVpsIp() {
  return VPS_IP
}

export function getPhishletPrefix() {
  return PREFIX
}

export function getRouterPort() {
  return ROUTER_PORT
}

export function getScheme() {
  return SCHEME
}
