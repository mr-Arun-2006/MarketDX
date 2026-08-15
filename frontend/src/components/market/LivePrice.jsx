import { useEffect, useState } from 'react'
import { connectMarketWebSocket, disconnectMarketWebSocket } from '../../services/websocket'

export default function LivePrice({ symbol = 'NIFTY' }) {
  const [tick, setTick] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    connectMarketWebSocket({
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: message => {
        if (message.type === 'market_tick' && message.data?.symbol === symbol) {
          setTick(message.data)
        }
      },
    })
    return () => disconnectMarketWebSocket()
  }, [symbol])

  return (
    <div>
      <div>{symbol}</div>
      <strong>{tick ? `₹${Number(tick.price).toLocaleString('en-IN')}` : 'Waiting for live data...'}</strong>
      <small>{connected ? ' Live' : ' Connecting...'}</small>
    </div>
  )
}
