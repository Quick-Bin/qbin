import {AppState, KVMeta} from "../utils/types.ts";
import {kv} from "../utils/cache.ts";
import {EMAIL, QBIN_ENV, PASTE_STORE} from "../config/constants.ts";
import {PasteError, Response} from "../utils/response.ts";
import {ResponseMessages} from "../utils/messages.ts";
import {parsePagination} from "../utils/validator.ts";
import {createMetadataRepository} from "../db/repositories/metadataRepository.ts";
import {getTimestamp} from "../utils/common.ts";
import { get_all_env } from "../config/env.ts";


export async function syncDBToKV(ctx: Context<AppState>, repo) {
  try {
    const now = getTimestamp();
    const rows = await repo.getActiveMetas();
    const dbMap = new Map<string, Omit<KVMeta, "fkey">>();
    for (const r of rows) {
      dbMap.set(r.fkey, {
        email: r.email,
        title: r.title,
        name: r.uname,
        ip: r.ip,
        len: r.len,
        expire: r.expire,
        hash: r.hash,
        pwd: r.pwd,
      });
    }

    const toRemove = [];
    const kvFkeys = new Set<string>();
    let removed = 0, added = 0, unchanged = 0;

    for await (const entry of kv.list({ prefix: [PASTE_STORE] })) {
      const fkey = entry.key[1] as string;
      const kvVal: { expire?: number } = entry.value ?? {};

      // 1. KV 中条目已过期   2. 不存在于数据库（被删除或已过期）
      if (
        (kvVal.expire !== undefined && kvVal.expire <= now) ||
        !dbMap.has(fkey)
      ) {
        toRemove.push(entry.key);
      } else {
        kvFkeys.add(fkey);
        unchanged++;
      }
    }

    const batchSize = 100;
    for (let i = 0; i < toRemove.length; i += batchSize) {
      const atomic = kv.atomic();
      for (const key of toRemove.slice(i, i + batchSize)) atomic.delete(key);
      await atomic.commit();
      removed += Math.min(batchSize, toRemove.length - i);
    }

    const toAdd: [string, ReturnType<typeof dbMap.get>] [] = [];
    for (const [fkey, meta] of dbMap) {
      if (!kvFkeys.has(fkey)) toAdd.push([fkey, meta]);
    }

    for (let i = 0; i < toAdd.length; i += batchSize) {
      const atomic = kv.atomic();
      for (const [fkey, meta] of toAdd.slice(i, i + batchSize)) {
        atomic.set([PASTE_STORE, fkey], meta);
      }
      await atomic.commit();
      added += Math.min(batchSize, toAdd.length - i);
    }

    return new Response(ctx, 200, ResponseMessages.SUCCESS, {
      stats: { added, removed, unchanged, total: rows.length },
    });
  } catch (error) {
    console.error("同步数据库到 KV 时出错: ", error);
    throw new PasteError(500, ResponseMessages.SERVER_ERROR);
  }
}

export async function getAllStorage(ctx) {
  if(QBIN_ENV === "dev") return new Response(ctx, 403, ResponseMessages.DEMO_RESTRICTED);
  const email = await ctx.state.session?.get("user")?.email;
  if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);

  const { page, pageSize } = parsePagination(new URL(ctx.request.url));
  const offset = (page - 1) * pageSize;

  const repo = await createMetadataRepository();
  const { items, total } = await repo.listAlive(pageSize, offset);
  const totalPages = Math.ceil(total / pageSize);

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    items,
    pagination: { total, page, pageSize, totalPages },
  });
}

export async function purgeExpiredCacheEntries(ctx){
  const now      = getTimestamp();
  let removed    = 0;   // 被删除的条目
  let kept       = 0;   // 保留下来的条目
  const BATCH_SZ = 100;
  let batch   = kv.atomic();
  let counter = 0;
  for await (const { key, value } of kv.list({ prefix: [] })) {
    const isPasteStore = key[0] === PASTE_STORE;
    const isExpired    = isPasteStore && value?.expire && value.expire < now;
    if (!isPasteStore || isExpired) {
      batch = batch.delete(key);
      removed++;
      counter++;
      if (counter === BATCH_SZ) {
        await batch.commit();
        batch   = kv.atomic();
        counter = 0;
      }
    } else {
      kept++;
    }
  }
  if (counter) {
    await batch.commit();
  }
  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    removed,
    kept,
  });
}

export async function exportEnv(ctx) {
  if (QBIN_ENV !== "dev") return new Response(ctx, 403, ResponseMessages.FORBIDDEN);
  const email = await ctx.state.session?.get("user")?.email;
  if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    env: get_all_env(),
  });
}
