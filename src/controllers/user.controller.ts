import { Response } from "../utils/response.ts";
import { ResponseMessages } from "../utils/messages.ts";
import { parsePagination } from "../utils/validator.ts";
import { createMetadataRepository } from "../db/db.ts";
import { EMAIL } from "../config/constants.ts";

export async function getStorage(ctx) {
  const user = ctx.state.session?.get("user");
  if (!user?.email) return new Response(ctx, 401, ResponseMessages.LOGIN_REQUIRED);

  const { page, pageSize } = parsePagination(new URL(ctx.request.url));
  const offset = (page - 1) * pageSize;

  const repo = await createMetadataRepository();
  const isAdmin = user.email === EMAIL;
  const { items, total } = isAdmin
    ? await repo.listAlive(pageSize, offset)
    : await repo.paginateByEmail(user.email, pageSize, offset);
  const totalPages = Math.ceil(total / pageSize);

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    items,
    pagination: { total, page, pageSize, totalPages },
  });
}

export async function getToken(ctx) {
  // 获取基本请求信息
  const referer = ctx.request.headers.get("referer");
  const origin = ctx.request.headers.get("origin");

  if (!referer || referer.includes("/r/") || referer.includes("/m/")) {
    return new Response(ctx, 403, ResponseMessages.REFERER_DISALLOWED);
  }
  if (referer === origin) {
    return new Response(ctx, 403, ResponseMessages.REFERER_INVALID);
  }
  const refererUrl = new URL(referer);
  if (refererUrl.pathname === "/" || refererUrl.pathname === "") {
    return new Response(ctx, 403, ResponseMessages.REFERER_DISALLOWED);
  }

  const token = await ctx.cookies.get("token");
  return new Response(ctx, 200, ResponseMessages.SUCCESS, { token: token });
}
