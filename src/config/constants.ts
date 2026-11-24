/**
 * 全局常量配置
 */
import { get_env } from "./env.ts";


export const TOKEN_EXPIRE = parseInt(get_env("TOKEN_EXPIRE", "31536000")); // JWT 过期时长(秒)
export const MAX_UPLOAD_FILE_SIZE = parseInt(get_env("MAX_UPLOAD_FILE_SIZE", "52428800"));
export const MAX_CACHE_SIZE = 1048576;    // 单数据缓存上限
export const ENABLE_ANONYMOUS_ACCESS = parseInt(get_env("ENABLE_ANONYMOUS_ACCESS", "1"));   // 匿名访问

export const PASTE_STORE = "qbinv3";     // KV 命名空间
export const DENO_KV_ACCESS_TOKEN = get_env("DENO_KV_ACCESS_TOKEN"); // Deno KV 访问令牌
export const DENO_KV_PROJECT_ID = get_env("DENO_KV_PROJECT_ID"); // Deno KV 项目 ID
export const CACHE_CHANNEL = "qbin-cache-sync";

// Deno KV 项目 ID 验证正则表达式
export const DENO_KV_PROJECT_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const jwtSecret = get_env("JWT_SECRET", "input-your-jwtSecret");  // 从环境变量获取jwt密钥
export const exactPaths = ["/favicon.ico", "/document", "/api/health", "/login", "/pwa-loader", "/service-worker.js", "/manifest.json"]
export const prefixPaths = ['/r/', '/e/', '/c/', '/m/', '/p/', '/static/', '/api/login/']
export const basePath = Deno.cwd();

export const EMAIL = get_env("ADMIN_EMAIL", "admin@qbin.github");
export const PASSWORD = get_env("ADMIN_PASSWORD", "qbin");

// Refuse to start with the secrets shipped in docker-compose.yml, .env.template
// and the docs: they are publicly known, so anyone could sign an admin token or
// log in with the documented admin password.
const INSECURE_JWT_SECRETS = [
  "input-your-jwtSecret",
  "your_jwt_secret",
  "XTV0x5ecm5",
];
if (!jwtSecret || INSECURE_JWT_SECRETS.includes(jwtSecret)) {
  throw new Error(
    "JWT_SECRET must be set to a strong random value (e.g. `openssl rand -hex 32`).",
  );
}
if (!PASSWORD || PASSWORD === "qbin") {
  throw new Error("ADMIN_PASSWORD must be changed from the shipped default.");
}
export const QBIN_ENV = get_env("QBIN_ENV", "prod");
// 校验访问路径和访问密码字符
export const VALID_CHARS_REGEX = /^[a-zA-Z0-9-\.\_]+$/;
// 上传 MIME类型校验正则
export const mimeTypeRegex = /^[-\w.+]+\/[-\w.+]+(?:;\s*[-\w]+=[-\w]+)*$/i;
// 保留访问路径
export const reservedPaths = new Set<string>(
  (get_env("RESERVED_PATHS", "")).split(",").map(s => s.trim().toLowerCase())
);

export const HEADERS = {
  HTML: {
    "X-Content-Type-Options": "nosniff",    // 禁止嗅探MIME类型
    "X-XSS-Protection": "1; mode=block",    // 启用XSS过滤器
    "X-Frame-Options": "DENY",              // 禁止页面在frame中展示
    // "Content-Security-Policy": "default-src 'self'",  // 同源加载
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",  // HSTS强制使用HTTPS
    "Referrer-Policy": "strict-origin-when-cross-origin",      // 引用策略
  },
  JSON: { "Content-Type": "application/json" },
  CORS: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
};
