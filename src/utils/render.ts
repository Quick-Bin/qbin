/**
 * 模板渲染 / 读取工具
 */
import {join, normalize, resolve, relative, isAbsolute} from "https://deno.land/std/path/mod.ts";
import {basePath} from "../config/constants.ts";
import {getMime} from "../utils/types.ts";
import {cyrb53_str} from "./common.ts";

// 解析静态资源真实路径并校验是否越出静态目录，防止路径穿越
function resolveStaticPath(subDir: string, pathname: string): string {
    const baseDir = resolve(join(basePath, subDir));
    const target = resolve(baseDir, normalize(pathname));
    const rel = relative(baseDir, target);
    if (rel === ".." || rel.startsWith(".." + "/") || rel.startsWith(".." + "\\") || isAbsolute(rel)) {
        throw new Deno.errors.NotFound("Invalid static path");
    }
    return target;
}


export async function getJS(ctx, pathname, status = 200): Promise<string> {
    try {
        ctx.response.body = await Deno.readTextFile(resolveStaticPath("/static/js", pathname));
        ctx.response.status = status;
        ctx.response.headers.set("Content-Type", "application/javascript");
        // ctx.response.headers.set("Cache-Control", "public, max-age=86400, immutable");
        const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
        ctx.state.metadata = {etag: hash};
    } catch (error) {
        ctx.response.status = 404;
    }
}

export async function getCSS(ctx, pathname, status = 200): Promise<string> {
    try {
        ctx.response.body = await Deno.readTextFile(resolveStaticPath("/static/css", pathname));
        ctx.response.status = status;
        ctx.response.headers.set("Content-Type", "text/css");
        // ctx.response.headers.set("Cache-Control", "public, max-age=86400, immutable");
        const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
        ctx.state.metadata = {etag: hash};
    } catch (error) {
        ctx.response.status = 404;
    }
}

export async function getIMG(ctx, pathname, status = 200): Promise<string> {
    try {
        const extension = pathname.split('.').pop()?.toLowerCase() || '';
        const contentType = getMime(extension) || 'application/octet-stream';
        ctx.response.body = await Deno.readFile(resolveStaticPath("/static/img", pathname));
        ctx.response.status = status;

        ctx.response.headers.set("Content-Type", contentType);
        ctx.response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
        ctx.state.metadata = {etag: hash};
    } catch (error) {
        ctx.response.status = 404;
    }
}

export async function getFONTS(ctx, pathname, status = 200): Promise<string> {
    try {
        const extension = pathname.split('.').pop()?.toLowerCase() || '';
        const contentType = getMime(extension) || 'application/octet-stream';
        ctx.response.body = await Deno.readFile(resolveStaticPath("/static/css/fonts", pathname));
        ctx.response.status = status;

        ctx.response.headers.set("Content-Type", contentType);
        ctx.response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        const hash = cyrb53_str(`${pathname}-${ctx.response.body.length}`);
        ctx.state.metadata = {etag: hash};
    } catch (error) {
        ctx.response.status = 404;
    }
}

export async function getRenderHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");  // public, max-age=3600
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/render.html'));
    const hash = cyrb53_str('render.html' + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

export async function getEditHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/multi-editor.html'));
    const hash = cyrb53_str("multi-editor.html" + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

export async function getCodeEditHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/code-editor.html'));
    const hash = cyrb53_str("code-editor.html" + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

export async function getMDEditHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/md-editor.html'));
    const hash = cyrb53_str("md-editor.html" + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

export async function getLoginPageHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/login.html'));
    const hash = cyrb53_str('login.html' + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

export async function getDocumentHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");
    ctx.response.body = await Deno.readTextFile(join(basePath, './Docs/document.md'));
    const hash = cyrb53_str("document.md" + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

export async function getFavicon(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "image/svg+xml");
    ctx.response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.response.body = await Deno.readFile(join(basePath, './static/img/favicon.svg'));
}

export async function getHomeHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/home.html'));
    const hash = cyrb53_str("home.html" + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

export async function getPWALoaderHtml(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
    // ctx.response.headers.set("Cache-Control", "public, max-age=300");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/pwa-loader.html'));
    const hash = cyrb53_str('pwa-loader.html' + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

// PWA - Service Worker
export async function getServiceWorker(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "application/javascript");
    ctx.response.headers.set("Cache-Control", "no-cache, must-revalidate");
    ctx.response.headers.set("Service-Worker-Allowed", "/");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/js/service-worker.js'));
    const hash = cyrb53_str('service-worker.js' + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}

// PWA - Manifest
export async function getManifest(ctx, status = 200): Promise<string> {
    ctx.response.status = status;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.headers.set("Cache-Control", "public, max-age=86400");
    ctx.response.body = await Deno.readTextFile(join(basePath, './static/manifest.json'));
    const hash = cyrb53_str('manifest.json' + ctx.response.body.length);
    ctx.state.metadata = {etag: hash};
}


// // 路径格式错误网页
// export async function getPathErrorHtml(ctx, status=200): Promise<string> {
//   ctx.response.status = status;
//   ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
//   // ctx.response.headers.set("Cache-Control", "public, max-age=300");
//   ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/error.html'));
//   const hash = cyrb53_str('error.html' + ctx.response.body.length);
//   ctx.state.metadata = { etag: hash };
// }
//
// // 密码保存内容网页
// export async function getPassWordHtml(ctx, status=200): Promise<string> {
//   ctx.response.status = status;
//   ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
//   // ctx.response.headers.set("Cache-Control", "public, max-age=300");
//   ctx.response.body = await Deno.readTextFile(join(basePath, './static/templates/password.html'));
//   const hash = cyrb53_str('password.html' + ctx.response.body.length);
//   ctx.state.metadata = { etag: hash };
// }
