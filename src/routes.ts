import { ESRouteLaunchMode, ESRouteType } from '@extscreen/es3-router'
import home from './pages/launcher/index.vue'
import casting from './pages/casting/index.vue'
import settings from './pages/settings/index.vue'
import guide from './pages/guide/index.vue'

const routes = [
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
]

export default routes
