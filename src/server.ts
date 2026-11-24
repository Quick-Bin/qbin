import { Application } from "https://deno.land/x/oak/mod.ts";
import { AppState } from "./utils/types.ts";
import router from "./routes/index.ts";
import { errorMiddleware } from "./middlewares/error.ts";
import { authMiddleware } from "./middlewares/auth.ts";
import { etagMiddleware } from "./middlewares/etag.ts";
import { loggerMiddleware } from "./middlewares/logger.ts";
import {initializeServices} from "./db/db.ts";

/**
 * 创建并配置应用服务器
 * @returns 配置好的Application实例
 */
export function createServer(): Application<AppState> {
  initializeServices().catch(console.error);  // 预热数据库连接

  // Request state must not live in Application.state: Oak inherits the
  // application state into every ctx.state, so a Map here would be shared by
  // all requests and one user's identity would leak into everyone else's.
  const app = new Application<AppState>({
    state: {},
  });

  app.use(errorMiddleware);
  app.use(etagMiddleware);
  app.use(authMiddleware);
  app.use(loggerMiddleware);
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}