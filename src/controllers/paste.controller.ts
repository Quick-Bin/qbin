import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  getCachedContent,
  isCached,
  updateCache,
  kv,
  cacheBroadcast,
  deleteCache,
} from "../utils/cache.ts";
import {
  getTimestamp,
  cyrb53,
} from "../utils/common.ts";
import { Response } from "../utils/response.ts";
import { ResponseMessages } from "../utils/messages.ts";
import { checkPassword, parsePathParams } from "../utils/validator.ts";
import {
  PASTE_STORE,
  MAX_UPLOAD_FILE_SIZE,
  mimeTypeRegex,
  reservedPaths,
  EMAIL,
} from "../config/constants.ts";
import { createMetadataRepository } from "../db/db.ts";
import { Metadata, AppState } from "../utils/types.ts";

/** GET /r/:key/:pwd? 原始内容输出 */
export async function getRaw(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params);
  const repo = await createMetadataRepository();

  // 只查 meta，作用：无权限时提前返回 403/404
  const meta = await isCached(key, pwd, repo);
  if (meta?.email === undefined || (meta.expire ?? 0) < getTimestamp()) {
    throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  }
  if (meta.pwd && !checkPassword(meta.pwd, pwd)) {
    throw new Response(ctx, 403, ResponseMessages.PASSWORD_INCORRECT);
  }

  const full = await getCachedContent(key, pwd, repo);
  if (!(full && "content" in full)) {
    throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  }

  ctx.state.metadata = { etag: full.hash, time: full.time };
  ctx.response.headers.set("Pragma", "no-cache");
  ctx.response.headers.set("Cache-Control", "no-cache, must-revalidate");  // private , must-revalidate | , max-age=3600
  ctx.response.headers.set("Content-Type", full.mime);
  ctx.response.headers.set("Content-Length", full.len.toString());
  if(full.title) ctx.response.headers.set("Content-Disposition", `inline; filename="${full.title}"`);
  ctx.response.body = full.content;
}

export async function queryRaw(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params);
  const repo = await createMetadataRepository();

  // 只查 meta，作用：无权限时提前返回 403/404
  const meta = await isCached(key, pwd, repo);
  if (meta?.email === undefined || (meta.expire ?? 0) < getTimestamp()) {
    throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  }
  if (meta.pwd && !checkPassword(meta.pwd, pwd)) {
    throw new Response(ctx, 403, ResponseMessages.PASSWORD_INCORRECT);
  }

  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", meta.mime);
  ctx.response.headers.set("Content-Length", meta.len.toString());
  if(meta.title) ctx.response.headers.set("Content-Disposition", `inline; filename="${meta.title}"`);
}

/** POST/PUT /save/:key/:pwd? 统一入口：若 key 已存在则更新，否则创建 */
export async function save(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params, 'save');
  if (reservedPaths.has(key)) throw new Response(ctx, 403, ResponseMessages.PATH_RESERVED);

  const repo = await createMetadataRepository();
  const meta = await isCached(key, pwd, repo);

  return meta && "email" in meta
    ? await updateExisting(ctx, key, pwd, meta, repo)
    : await createNew(ctx, key, pwd, repo);
}

/** DELETE /delete/:key/:pwd? */
export async function remove(ctx: Context<AppState>) {
  const { key, pwd } = parsePathParams(ctx.params);
  if (reservedPaths.has(key)) throw new Response(ctx, 403, ResponseMessages.PATH_RESERVED);
  const repo = await createMetadataRepository();
  const meta = await isCached(key, pwd, repo);
  if (!meta || (meta.expire ?? 0) < getTimestamp()) throw new Response(ctx, 404, ResponseMessages.CONTENT_NOT_FOUND);
  const email = ctx.state.session?.get("user")?.email;
  const isAdmin = email === EMAIL;
  if (!isAdmin && !checkPassword(meta.pwd, pwd)) throw new Response(ctx, 403, ResponseMessages.PASSWORD_INCORRECT);
  if (!isAdmin && email !== meta.email) throw new Response(ctx, 403, ResponseMessages.PERMISSION_DENIED);

  delete meta.content;
  await deleteCache(key, meta);
  queueMicrotask(async () => {
    await kv.delete([PASTE_STORE, key])
    await repo.delete(key);
  });
  cacheBroadcast.postMessage({ type: "delete", key, metadata: meta });

  // TODO 回收站 定时清理
  // if (meta.expire > 0) meta.expire = -meta.expire;
  // await updateCache(key, meta)
  // cacheBroadcast.postMessage({ type: "update", key, metadata: meta });
  // queueMicrotask(async () => {
  //   await kv.set([PASTE_STORE, key], meta)
  //   await repo.update(key, {expire: meta.expire});
  // });
  return new Response(ctx, 200, ResponseMessages.SUCCESS);
}

/* ─────────── 辅助私有函数 ─────────── */
async function createNew(
  ctx: Context<AppState>,
  key: string,
  pwd: string,
  repo,
) {
  const metadata = await assembleMetadata(ctx, key, pwd);
  // 原子性检查 + 占位
  const kvRes = await kv.atomic()
    .check({ key: [PASTE_STORE, key], versionstamp: null })
    .set([PASTE_STORE, key], {
      email: metadata.email,
      title: metadata.title,
      name: metadata.uname,
      ip: metadata.ip,
      len: metadata.len,
      expire: metadata.expire,
      hash: metadata.hash,
      pwd,
    }, { expireIn: null })
    .commit();
  if (!kvRes.ok) {
    return new Response(ctx, 409, ResponseMessages.KEY_EXISTS);
  }

  // 写入缓存
  await updateCache(key, metadata);

  queueMicrotask(async () => {
    try {
      const result = await repo.create(metadata);
      if (!result) {
        console.warn('Failed to create in repo, metadata:', key);
        await deleteCache(key, metadata);
        await kv.delete([PASTE_STORE, key]);
      }
    } catch (err) {
      console.error(err);
      await deleteCache(key, metadata);
      await kv.delete([PASTE_STORE, key]);
    }
  });

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    key,
    pwd,
    url: `${ctx.request.url.origin}/r/${key}/${pwd}`,
  });
}

async function updateExisting(
  ctx: Context<AppState>,
  key: string,
  pwd: string,
  oldMeta,
  repo,
) {
  const email = ctx.state.session?.get("user")?.email;
  if (email !== oldMeta.email) {
    throw new Response(ctx, 403, ResponseMessages.PERMISSION_DENIED);
  }

  const metadata = await assembleMetadata(ctx, key, pwd);

  await kv.set([PASTE_STORE, key], {
      email: metadata.email,
      title: metadata.title,
      name: metadata.uname,
      ip: metadata.ip,
      len: metadata.len,
      expire: metadata.expire,
      hash: metadata.hash,
      pwd,
    });
  await updateCache(key, metadata);

  queueMicrotask(async () => {
    try {
      const result = await repo.update(key, metadata)
      if (!result) {
        console.warn('Failed to update in repo, metadata:', key);
        await updateCache(key, oldMeta);
        await kv.set([PASTE_STORE, key], {
          email: oldMeta.email,
          title: oldMeta.title,
          name: oldMeta.uname,
          ip: oldMeta.ip,
          len: oldMeta.len,
          expire: oldMeta.expire,
          hash: oldMeta.hash,
          pwd,
        });
      }else {
        delete metadata.content;
        cacheBroadcast.postMessage({ type: "update", key, metadata });
      }
    } catch (err) {
      console.error(err);
      await updateCache(key, oldMeta); // 回滚
      await kv.set([PASTE_STORE, key], {
          email: oldMeta.email,
          title: oldMeta.title,
          name: oldMeta.uname,
          ip: oldMeta.ip,
          len: oldMeta.len,
          expire: oldMeta.expire,
          hash: oldMeta.hash,
          pwd,
        });
    }
  });

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    key,
    pwd,
    url: `${ctx.request.url.origin}/r/${key}/${pwd}`,
  });
}

/** 把“读取请求体 → 构造 Metadata”封装，新增/更新共用 */
async function assembleMetadata(
  ctx: Context<AppState>,
  key: string,
  pwd: string,
): Promise<Metadata> {
  const req = ctx.request;
  const headers = req.headers;
  // const title = decodeURIComponent(headers.get("x-title") || "");
  const title = headers.get("x-title") || "";
  const len = +headers.get("Content-Length")!;
  if (len > MAX_UPLOAD_FILE_SIZE) {
    throw new Response(ctx, 413, ResponseMessages.CONTENT_TOO_LARGE);
  }
  const mime = headers.get("Content-Type") || "application/octet-stream";
  if (!mimeTypeRegex.test(mime)) {
    throw new Response(ctx, 415, ResponseMessages.INVALID_CONTENT_TYPE);
  }

  const content = await req.body.arrayBuffer();
  if (content.byteLength !== len) {
    throw new Response(ctx, 413, ResponseMessages.CONTENT_TOO_LARGE);
  }

  const payload = ctx.state.session?.get("user");
  const clientIp = headers.get("cf-connecting-ip") || req.ip;
  // const clientIp = req.ip;
  return {
    fkey: key,
    title: title,
    time: getTimestamp(),
    expire: getTimestamp() +
      ~~(headers.get("x-expire") ?? "315360000"),
    ip: clientIp,
    content,
    mime,
    len,
    pwd,
    email: payload?.email ?? "",
    uname: payload?.name ?? "",
    hash: cyrb53(content),
  };
}
