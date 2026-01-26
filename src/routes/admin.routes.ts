import { Router } from "https://deno.land/x/oak/mod.ts";
import { Response } from "../utils/response.ts";
import { ResponseMessages } from "../utils/messages.ts";
import {createMetadataRepository} from "../db/repositories/metadataRepository.ts";
import {EMAIL, QBIN_ENV} from "../config/constants.ts";
import {purgeExpiredCacheEntries, getAllStorage, syncDBToKV, exportEnv} from "../controllers/admin.controller.ts";
import {migrateToV3} from "../db/helpers/migrate.ts";
import {get_env} from "../config/env.ts";


const router = new Router();

router
  .get("/api/admin/storage", getAllStorage)
  .get("/api/admin/env/export", exportEnv)
  .get("/api/admin/sync", async (ctx) => {
    const email = await ctx.state.session?.get("user")?.email;
    if(QBIN_ENV === "dev") return new Response(ctx, 403, ResponseMessages.DEMO_RESTRICTED);
    if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);
    const repo = await createMetadataRepository();
    return await syncDBToKV(ctx, repo);
  })    // kv与pg同步
  .get("/api/database/migrate", async (ctx) => {
    // 旧版本数据迁移至新数据表
    const email = await ctx.state.session?.get("user")?.email;
    if(QBIN_ENV === "dev") return new Response(ctx, 403, ResponseMessages.DEMO_RESTRICTED);
    if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);
    const repo = await createMetadataRepository();
    const {rowCount} = await migrateToV3(repo, get_env("DB_CLIENT", "postgres"));
    return new Response(ctx, 200, ResponseMessages.SUCCESS, {rowCount: rowCount});
  })
  .get("/api/cache/purge", purgeExpiredCacheEntries);   // 清理过期缓存

export default router;
