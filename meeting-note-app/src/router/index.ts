import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'calendar',
      component: () => import('@/views/CalendarPage.vue')
    },
    {
      path: '/meeting/:id',
      name: 'meeting-detail',
      component: () => import('@/views/MeetingDetailPage.vue'),
      props: true
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue')
    }
  ]
})

export default router
