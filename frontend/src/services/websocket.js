import { useAuthStore } from '../store/authStore'

let socket = null
let reconnectTimer = null

function websocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
  const url = new URL('/api/v1/ws/market', apiUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export function connectMarketWebSocket({ onMessage, onOpen, onClose } = {}) {
  disconnectMarketWebSocket()

  socket = new WebSocket(websocketUrl())

  socket.onopen = () => {
    const token = useAuthStore.getState().token
    if (token) socket.send(JSON.stringify({ type: 'auth', token }))
    onOpen?.()
  }

  socket.onmessage = (event) => {
    try {
      onMessage?.(JSON.parse(event.data))
    } catch {
      // Ignore malformed frames.
    }
  }

  socket.onclose = () => {
    onClose?.()
    if (reconnectTimer === null) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connectMarketWebSocket({ onMessage, onOpen, onClose })
      }, 3000)
    }
  }

  return socket
}

export function disconnectMarketWebSocket() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    socket.close()
    socket = null
  }
}
