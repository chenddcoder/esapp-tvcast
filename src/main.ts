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
import { createESPlayerManager } from "@extscreen/es3-player-manager";
import { createESVideoPlayer } from "@extscreen/es3-video-player";
app.use(QuickTVUI);
app.use(createESPlayer());
app.use(createESPlayerManager());
app.use(createESVideoPlayer());
