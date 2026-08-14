import { useEffect, useState } from 'react'
import { createMarketWebSocket } from '../../utils/websocket'

export default function LivePrice({ symbol = 'NIFTY' }) {
  const [tick, setTick] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = createMarketWebSocket({
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: message => {
        if (message.type === 'market_tick' && message.data?.symbol === symbol) {
          setTick(message.data)
        }
      },
    })
    return () => socket.close()
  }, [symbol])

  return (
    <div>
      <div>{symbol}</div>
      <strong>{tick ? `₹${Number(tick.price).toLocaleString('en-IN')}` : 'Waiting for live data...'}</strong>
      <small>{connected ? ' Live' : ' Connecting...'}</small>
    </div>
  )
}
