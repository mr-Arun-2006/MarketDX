
import React from 'react'
import { Link } from 'react-router-dom'

export default function PublicDashboard() {
  const cards = [
    { title: 'NIFTY 50', value: '+1.8%' },
    { title: 'BANK NIFTY', value: '+0.9%' },
    { title: 'AI Confidence', value: '87%' },
    { title: 'Market Sentiment', value: 'Bullish' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold">Public Demo Dashboard</h1>

        <div className="flex gap-4">
          <Link
            to="/login/user"
            className="px-4 py-2 bg-green-600 rounded-lg"
          >
            Login
          </Link>

          <Link
            to="/signup"
            className="px-4 py-2 bg-purple-600 rounded-lg"
          >
            Register
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-gray-900 p-6 rounded-2xl shadow-lg"
          >
            <h2 className="text-lg text-gray-400">{card.title}</h2>
            <p className="text-3xl font-bold mt-3">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 p-8 rounded-2xl">
        <h2 className="text-2xl font-bold mb-4">AI Diagnosis Preview</h2>

        <p className="text-gray-300 leading-8">
          Current market conditions indicate positive momentum with moderate volatility.
          AI diagnosis suggests continuation trends in major indices with strong sector rotation.
        </p>

        <div className="mt-8">
          <Link
            to="/login/user"
            className="px-6 py-3 bg-blue-600 rounded-xl"
          >
            Unlock Full Platform
          </Link>
        </div>
      </div>
    </div>
  )
}
