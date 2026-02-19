import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/add', name: 'add', component: () => import('../views/AddView.vue') },
  { path: '/add/:id', name: 'edit', component: () => import('../views/AddView.vue') },
  { path: '/report', name: 'report', component: () => import('../views/ReportView.vue') },
  { path: '/cards', name: 'cards', component: () => import('../views/CardsView.vue') },
  { path: '/reconcile', name: 'reconcile', component: () => import('../views/ReconcileView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
