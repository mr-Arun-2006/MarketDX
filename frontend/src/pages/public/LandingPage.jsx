
import React from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="flex justify-between items-center p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Diagnosis Explorer</h1>

        <div className="flex gap-4">
          <Link to="/dashboard" className="px-4 py-2 bg-blue-600 rounded-lg">
            Demo Dashboard
          </Link>

          <Link to="/login/user" className="px-4 py-2 bg-green-600 rounded-lg">
            Login
          </Link>
        </div>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-6 py-24">
        <h2 className="text-5xl font-bold mb-6">
          AI Market Diagnosis Platform
        </h2>

        <p className="max-w-3xl text-lg text-gray-300 mb-8">
          End-to-end financial diagnosis platform with AI analysis,
          technical indicators, intelligent insights, and interactive dashboards.
        </p>

        <div className="flex gap-4">
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-blue-600 rounded-xl font-semibold"
          >
            Explore Demo
          </Link>

          <Link
            to="/signup"
            className="px-6 py-3 bg-purple-600 rounded-xl font-semibold"
          >
            Create Account
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 p-10">
        <div className="bg-gray-900 p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-3">AI Analysis</h3>
          <p className="text-gray-400">
            Generate intelligent market diagnosis and predictions using AI models.
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-3">Technical Indicators</h3>
          <p className="text-gray-400">
            RSI, MACD, EMA, Bollinger Bands and multiple advanced indicators.
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-3">Interactive Dashboard</h3>
          <p className="text-gray-400">
            Real-time visual insights, reports, and financial monitoring.
          </p>
        </div>
      </section>
    </div>
  )
}
