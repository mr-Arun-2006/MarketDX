import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    token: null,
    role: null,

    login: (data) => set({
      user: { full_name: data.full_name, email: data.email },
      token: data.access_token,
      role: data.role,
    }),

    logout: () => set({ user: null, token: null, role: null }),

    isLoggedIn: () => !!get().token,
    isAdmin: () => get().role === 'admin',
    isUser: () => get().role === 'user',
  }),
  { name: 'mdp-auth' }
))
