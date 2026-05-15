import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 25000,
})

API.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

API.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login/user'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  userSignup: (d) => API.post('/api/v1/auth/user/signup', d),
  userLogin:  (d) => API.post('/api/v1/auth/user/login', d),
  adminLogin: (d) => API.post('/api/v1/auth/admin/login', d),
  me:         ()  => API.get('/api/v1/auth/me'),
}

export const marketAPI = {
  getEOD:        () => API.get('/api/v1/market/eod'),
  getReport:     () => API.get('/api/v1/market/report'),
  getChart:      () => API.get('/api/v1/market/chart'),
  getIndicators: () => API.get('/api/v1/market/indicators'),
  getSummary:    () => API.get('/api/v1/market/summary'),
}

export const aiAPI = {
  chat: (msg, history) => API.post('/api/v1/ai/chat', { message: msg, history }),
}

export const adminAPI = {
  getUsers:   () => API.get('/api/v1/admin/users'),
  getStats:   () => API.get('/api/v1/admin/stats'),
  toggleUser: (id, is_active) => API.patch(`/api/v1/admin/users/${id}/toggle`, { is_active }),
}

export default API
