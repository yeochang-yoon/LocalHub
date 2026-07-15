import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/board',
    name: 'board-list',
    component: () => import('@/features/board/views/BoardListView.vue'),
  },
  {
    path: '/board/new',
    name: 'board-new',
    component: () => import('@/features/board/views/BoardFormView.vue'),
  },
  {
    path: '/board/bookmarks',
    name: 'board-bookmarks',
    component: () => import('@/features/board/views/BoardListView.vue'),
    props: { showBookmarks: true },
  },
  {
    path: '/board/:id',
    name: 'board-detail',
    component: () => import('@/features/board/views/BoardDetailView.vue'),
  },
  {
    path: '/board/:id/edit',
    name: 'board-edit',
    component: () => import('@/features/board/views/BoardFormView.vue'),
  },
  {
    path: '/regions',
    name: 'regions',
    component: () => import('@/features/regions/views/RegionView.vue'),
  },
  {
    path: '/regions/:contentId',
    name: 'region-detail',
    component: () => import('@/features/regions/views/RegionDetailView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/features/dashboard/views/DashboardView.vue'),
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('@/features/calendar/views/CalendarView.vue'),
  },
  {
    path: '/trip-planner',
    name: 'trip-planner',
    component: () => import('@/features/trip/views/TripPlannerView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
