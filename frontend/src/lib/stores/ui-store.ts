import { create } from 'zustand'
import { notificationService } from '../services/notifications'
import type { NotificationResponse } from '../api-types'

interface UiState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  commandOpen: boolean
  setCommandOpen: (open: boolean) => void

  notifications: NotificationResponse[]
  notificationsLoaded: boolean
  fetchNotifications: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),


  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  notifications: [],
  notificationsLoaded: false,

  async fetchNotifications() {
    try {
      const notifications = await notificationService.list()
      set({ notifications, notificationsLoaded: true })
    } catch {
      set({ notificationsLoaded: true })
    }
  },

  async markRead(id) {
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }))
    try {
      await notificationService.read(id)
    } catch {
      // optimistic — revert on failure is not critical
    }
  },

  async markAllRead() {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
    try {
      await notificationService.readAll()
    } catch {
      // optimistic
    }
  },
}))

export const useUnreadCount = () =>
  useUiStore((s) => s.notifications.filter((n) => !n.read).length)
