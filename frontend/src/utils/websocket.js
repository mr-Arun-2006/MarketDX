import { useAuthStore } from '../store/authStore'

export function createMarketWebSocket({ onMessage, onOpen, onClose, onError } = {}) {
  const token = useAuthStore.getState().token
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const base = `${protocol}//${window.location.host}/api/v1/ws/market`
  const url = token ? `${base}?token=${encodeURIComponent(token)}` : base

  const socket = new WebSocket(url)
  socket.onopen = onOpen
  socket.onmessage = event => {
    try { onMessage?.(JSON.parse(event.data)) } catch { /* ignore malformed messages */ }
  }
  socket.onerror = onError
  socket.onclose = onClose
  return socket
}
