//--------------------router-----------------------
import { createESRouter, Router } from "@extscreen/es3-router";
import routes from "./routes";
//--------------------ESApp-----------------------
import application from "./App.vue";
import { ESApp } from "@extscreen/es3-vue";
import { createESApp } from "@extscreen/es3-core";
import { ESComponent } from "@extscreen/es3-component";

const routerOptions = {
  main: "home", // 首屏路由
  error: "error",
  limit: 5,
  routes: routes,
};
const router: Router = createESRouter(routerOptions);
const app: ESApp = createESApp(application, router);

app.use(ESComponent);

//---------------------------QuickTVUI + 播放器（投屏接收需要）---------------------------
import "@quicktvui/quicktvui3/dist/index.css";
import { QuickTVUI } from "@quicktvui/quicktvui3";
import { createESPlayer } from "@extscreen/es3-player";
import { createESPlayerManager, ESPlayerManager } from "@extscreen/es3-player-manager";
import { createESVideoPlayer } from "@extscreen/es3-video-player";
app.use(QuickTVUI);
const playerPlugin = createESPlayer();
app.use(playerPlugin);
app.use(createESPlayerManager());
app.use(createESVideoPlayer());
// ESPlayerManager 组件需显式注册：createESPlayerManager() 只 provide 不注册组件
//（真机端未注册时由 Android 原生 ESPlayerManager 组件兜底；web-renderer 无该原生
// 组件，不注册会导致 <ESPlayerManager> 渲染中断 → 播放页挂载失败）。
// 注册 PascalCase 与 kebab-case 双名，兼容 hippy-vue 的大小写解析差异。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const esPlayerManagerComp: any = ESPlayerManager
app.component('ESPlayerManager', esPlayerManagerComp)
app.component('es-player-manager', esPlayerManagerComp)

// web/desktop 兼容：es3-core 3.x 不会主动调用业务插件（createESPlayer）的 init
//（真机由 Android 原生层触发），导致 DefinitionManager/InterceptorManager 等
// 子管理器依赖（SharedPreferences/log/device）未被注入 → playMediaSourceList
// 过程中 setDefinition 等抛 undefined 异常 → 投屏视频无法起播。
// 这里手动补调 init 注入默认依赖（web 端无真实 device/display，传空对象）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const playerPluginAny: any = playerPlugin
try {
  if (playerPluginAny && typeof playerPluginAny.init === 'function') {
    playerPluginAny
      .init({ debug: false, device: {}, display: {} })
      .then(() => console.log('[main] es3-player init OK（SharedPreferences 依赖注入成功，无需 patch）'))
      .catch((e: unknown) =>
        console.warn('[main] es3-player init rejected（部分依赖未注入，播放可能受限）:', e)
      )
  }
} catch (e) {
  console.warn('[main] es3-player init failed:', e)
}
