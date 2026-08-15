import { useAuthStore } from '../store/authStore'

let socket = null
let reconnectTimer = null
let stopped = false

function websocketUrl() {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  const url = new URL('/api/v1/ws/market', base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = useAuthStore.getState().token
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export function connectMarketWebSocket({ onMessage, onOpen, onClose, onError } = {}) {
  disconnectMarketWebSocket()
  stopped = false
  socket = new WebSocket(websocketUrl())

  socket.onopen = () => onOpen?.()
  socket.onmessage = event => {
    try { onMessage?.(JSON.parse(event.data)) } catch { /* ignore malformed frames */ }
  }
  socket.onerror = onError
  socket.onclose = () => {
    onClose?.()
    if (!stopped && reconnectTimer === null) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connectMarketWebSocket({ onMessage, onOpen, onClose, onError })
      }, 3000)
    }
  }
  return socket
}

export function disconnectMarketWebSocket() {
  stopped = true
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    socket.close()
    socket = null
  }
}
