import { ESRouteLaunchMode, ESRouteType } from '@extscreen/es3-router'
import home from './pages/launcher/index.vue'
import casting from './pages/casting/index.vue'
import settings from './pages/settings/index.vue'
import guide from './pages/guide/index.vue'

const routes = [
  // 根路径 / 也指向 launcher：desktop devUrl（http://localhost:1420/）等根路径场景下
  // 没有 / 路由会导致 es3-router "No match for /" 白屏（error 路由也缺失时直接挂掉）
  {
    path: '/',
    name: 'homeRoot',
    component: home,
    launchMode: ESRouteLaunchMode.ES_ROUTE_LAUNCH_MODE_CLEAR_TASK,
  },
  {
    path: '/home',
    name: 'home',
    component: home,
    launchMode: ESRouteLaunchMode.ES_ROUTE_LAUNCH_MODE_CLEAR_TASK,
  },
  {
    path: '/casting',
    name: 'casting',
    component: casting,
    launchMode: ESRouteLaunchMode.ES_ROUTE_LAUNCH_MODE_SINGLE_TASK,
  },
  {
    path: '/settings',
    name: 'settings',
    component: settings,
    launchMode: ESRouteLaunchMode.ES_ROUTE_LAUNCH_MODE_SINGLE_TASK,
  },
  {
    path: '/guide',
    name: 'guide',
    component: guide,
    launchMode: ESRouteLaunchMode.ES_ROUTE_LAUNCH_MODE_SINGLE_TASK,
    type: ESRouteType.ES_ROUTE_TYPE_DIALOG,
  },
  // error 兜底：任意未匹配路径（如 /index.html）都渲染 launcher，避免 "No match" 白屏
  {
    path: '/error',
    name: 'error',
    component: home,
    launchMode: ESRouteLaunchMode.ES_ROUTE_LAUNCH_MODE_CLEAR_TASK,
  },
]

export default routes
