import {Context} from "https://deno.land/x/oak/mod.ts";
import {OAuth2Client} from "jsr:@cmd-johnson/oauth2-client";
import {generateJwtToken, verifyJwtToken, decodeJwtToken} from "../utils/crypto.ts";
import {kv} from "../utils/cache.ts";
import {PasteError, Response} from "../utils/response.ts";
import {
  PASSWORD,
  exactPaths,
  HEADERS,
  prefixPaths,
  TOKEN_EXPIRE,
  EMAIL,
  ENABLE_ANONYMOUS_ACCESS
} from "../config/constants.ts";
import {get_env} from "../config/env.ts";
import {ResponseMessages} from "../utils/messages.ts";


// 定义 OAuth2 提供商配置
// https://github.com/cmd-johnson/deno-oauth2-client
const oauthProviders = {
  // Google OAuth2 配置
  google: {
    client: new OAuth2Client({
      clientId: get_env("GOOGLE_CLIENT_ID") || "",
      clientSecret: get_env("GOOGLE_CLIENT_SECRET") || "",
      authorizationEndpointUri: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUri: "https://oauth2.googleapis.com/token",
      redirectUri: get_env("GOOGLE_CALLBACK_URL") || "http://localhost:8000/api/login/oauth2/callback/google",
      defaults: {
        scope: ["profile", "email"],
      },
    }),
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    userDataTransformer: (userData: any): UserData => ({
      id: userData.sub,
      name: userData.name || userData.email?.split('@')[0] || "User",
      email: userData.email,
      provider: "google",
    }),
    validateUser: (userData: any): boolean => userData.email_verified === true,
  },
  // GitHub OAuth2 配置
  github: {
    client: new OAuth2Client({
      clientId: get_env("GITHUB_CLIENT_ID") || "",
      clientSecret: get_env("GITHUB_CLIENT_SECRET") || "",
      authorizationEndpointUri: "https://github.com/login/oauth/authorize",
      tokenUri: "https://github.com/login/oauth/access_token",
      redirectUri: get_env("GITHUB_CALLBACK_URL") || "http://localhost:8000/api/login/oauth2/callback/github",
      defaults: {
        scope: ["read:user", "user:email"],
      },
    }),
    userInfoUrl: "https://api.github.com/user",
    userDataTransformer: (userData: any): UserData => ({
      id: userData.id.toString(),
      name: userData.login,
      email: userData.email,
      provider: "github",
    }),
    validateUser: (userData: any): boolean => userData.id !== undefined,
    // GitHub 可能需要额外的请求来获取邮箱信息
    getAdditionalData: async (accessToken: string): Promise<any> => {
      if (!accessToken) return {};

      try {
        const emailsResponse = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
          },
        });

        if (emailsResponse.ok) {
          const emails = await emailsResponse.json();
          const primaryEmail = emails.find((email: any) => email.primary && email.verified);

          if (primaryEmail) {
            return { email: primaryEmail.email };
          }
        }

        return {};
      } catch (error) {
        console.error("Error fetching GitHub emails:", error);
        return {};
      }
    }
  },
  // Microsoft OAuth2 配置
  microsoft: {
    client: new OAuth2Client({
      clientId: get_env("MICROSOFT_CLIENT_ID") || "",
      clientSecret: get_env("MICROSOFT_CLIENT_SECRET") || "",
      authorizationEndpointUri: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUri: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      redirectUri: get_env("MICROSOFT_CALLBACK_URL") || "http://localhost:8000/api/login/oauth2/callback/microsoft",
      defaults: {
        scope: ["user.read", "profile", "email", "openid"],
      },
    }),
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    userDataTransformer: (userData: any): UserData => ({
      id: userData.id,
      name: userData.displayName || userData.userPrincipalName?.split('@')[0] || "User",
      email: userData.mail || userData.userPrincipalName,
      provider: "microsoft",
    }),
    validateUser: (userData: any): boolean => userData.id !== undefined,
  },
  // 自定义 OAuth2 配置
  custom: {
    client: new OAuth2Client({
      clientId: get_env("OAUTH_CLIENT_ID") || "",
      clientSecret: get_env("OAUTH_CLIENT_SECRET") || "",
      authorizationEndpointUri: get_env("OAUTH_AUTH_URL") || "",
      tokenUri: get_env("OAUTH_TOKEN_URL") || "",
      redirectUri: get_env("OAUTH_CALLBACK_URL") || "http://localhost:8000/api/login/oauth2/callback/custom",
      defaults: {
        scope: (get_env("OAUTH_SCOPES") || "").split(",").filter(Boolean),
      },
    }),
    userInfoUrl: get_env("OAUTH_USER_INFO_URL") || "",
    userDataTransformer: (userData: any): UserData => ({
      id: userData.id || userData.user_id,
      name: userData.username || userData.name || userData.display_name,
      email: userData.email,
      provider: "custom oauth",
    }),
    validateUser: (userData: any): boolean => userData.active === true,
  },
};

/**
 * 认证中间件
 * - 从 Cookie 中读取 token 并验证
 * - 无 token 时尝试做 OAuth2 登录流程
 * - 若未登录且访问受限路由，则显示登录页面
 */
export async function authMiddleware(ctx: Context, next: () => Promise<unknown>) {
  const session = ctx.state.session;
  let token = await ctx.cookies.get("token");  // 从 cookie 中取出 Token
  const currentPath = ctx.request.url.pathname;
  const method = ctx.request.method;
  const isExactPathAuth = method === "GET" && exactPaths.includes(currentPath);
  const isPrefixPathAuth = prefixPaths.some(prefix => currentPath.startsWith(prefix));

  if (ENABLE_ANONYMOUS_ACCESS === 1 && !token) {
    if (!session.has("user") && !["/login", "/api/login/admin", "/favicon.ico", "/r/"].some(prefix => currentPath.startsWith(prefix))) {
      const demoToken = await generateJwtToken({
        id: 1,
        email: "qbin@github.com",
        name: "Anonymous User",
        provider: "anonymous",
      }, 43200);
      await ctx.cookies.set("token", demoToken, {
        maxAge: 43200000,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      token = demoToken;
      if(currentPath === "/") return ctx.response.redirect("/home");
    }
  }

  if (token) {
    try {
      // 若 Session 中没有用户信息，但 JWT 有，则写回 Session
      const userFromJwt = await verifyJwtToken(token);
      if(userFromJwt){
         session.set("user", {
          id: userFromJwt.id,
          name: userFromJwt.name,
          email: userFromJwt.email,
        });
      }
    }
    catch (e) {
      await ctx.cookies.delete("token", {
        path: "/",
        httpOnly: true,
        sameSite: "lax"
      });
      if (!(isPrefixPathAuth || isExactPathAuth || currentPath === "/home")) {
        const { header, payload } = decodeJwtToken(token);
        if (ENABLE_ANONYMOUS_ACCESS === 1 && payload.provider === "anonymous") {
          const demoToken = await generateJwtToken({
            id: 1,
            email: "qbin@github.com",
            name: "Anonymous User",
            provider: "anonymous",
          }, 43200);
          await ctx.cookies.set("token", demoToken, {
            maxAge: 43200000,
            httpOnly: true,
            sameSite: "lax",
            path: "/",
          });
          session.set("user", {
            id: 1,
            name: "Anonymous User",
            email: "qbin@github.com",
          });
        } else {
          return new Response(ctx, 401, "Cookie expired");
        }
      }
    }
  }

  if (session?.has("user")) {
    Object.entries(HEADERS.HTML).forEach(([k, v]) => {
      ctx.response.headers.set(k, v);
    });
    await next();
    return;
  }

  if (isPrefixPathAuth || isExactPathAuth){
    // 公开路径，无需认证
    await next();
    return;
  }

  return ctx.response.redirect("/login");
}

export const handleAdminLogin = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { email, password } = body;
    if (!email || !password) return new Response(ctx, 400, "Email and password are required");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return new Response(ctx, 400, "Invalid email format");
    if (email !== EMAIL || password !== PASSWORD) {
      return new Response(ctx, 403, "Invalid email or password");
    }

    const jwtToken = await generateJwtToken({
      id: 0,
      email: EMAIL,
      name: EMAIL.includes('@') ? EMAIL.split('@')[0] : EMAIL,
    }, TOKEN_EXPIRE);
    await ctx.cookies.set("token", jwtToken, {
      maxAge: TOKEN_EXPIRE * 1000,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return new Response(ctx, 200, ResponseMessages.SUCCESS);
  } catch (error) {
    console.error("Admin login error:", error);
    return new Response(ctx, 400, "Invalid request format");
  }
}

// 处理 OAuth2 登录重定向
export const handleLogin = async (ctx: Context) => {
  try {
    const provider = ctx.params.provider;
    if (!oauthProviders[provider]) {
      return new Response(ctx, 400, "无效的 OAuth 提供商");
    }

    const oauth2Client = oauthProviders[provider].client;
    const { uri, codeVerifier } = await oauth2Client.code.getAuthorizationUri();
    const sessionId = crypto.randomUUID();

    await kv.set(["oauth_sessions", sessionId], { provider, codeVerifier }, { expireIn: 60000 });
    ctx.cookies.set("session_id", sessionId, {
      maxAge: 60000,  // 60秒过期
      httpOnly: true,
      sameSite: "lax"
    });
    ctx.response.redirect(uri);
  } catch (error) {
    console.error("OAuth 登录错误:", error);
    throw new PasteError(500, "OAuth2 认证错误");
  }
}

// 处理 OAuth2 回调请求
export const handleOAuthCallback = async (ctx: Context) => {
  try {
    const providerParam = ctx.params.provider;
    if (!oauthProviders[providerParam]) throw new PasteError(400, "无效的 OAuth 提供商");
    const sessionId = await ctx.cookies.get("session_id");
    if (!sessionId) throw new PasteError(400, "未找到会话");
    const sessionDataResult = await kv.get(["oauth_sessions", sessionId]);
    if (!sessionDataResult) throw new PasteError(400, "无效的会话");

    const { provider, codeVerifier } = sessionDataResult.value;
    if (provider !== providerParam) throw new PasteError(400, "提供商不匹配");
    await kv.delete(["oauth_sessions", sessionId]);

    const oauth2Client = oauthProviders[provider].client;
    const tokens = await oauth2Client.code.getToken(ctx.request.url, {
      codeVerifier: codeVerifier
    });

    const userResponse = await fetch(oauthProviders[provider].userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: "application/json"
      },
    });
    if (!userResponse.ok) throw new PasteError(500, `获取用户数据失败: ${userResponse.statusText}`);
    const userData = await userResponse.json();

    let additionalData = {};
    if (provider === "github" && oauthProviders.github.getAdditionalData) {
      additionalData = await oauthProviders.github.getAdditionalData(tokens.accessToken);
    }
    const mergedUserData = { ...userData, ...additionalData };
    if (!oauthProviders[provider].validateUser(mergedUserData)) {
      throw new PasteError(403, "OAuth2 用户验证失败");
    }
    const transformedUserData = oauthProviders[provider].userDataTransformer(mergedUserData);
    const jwtToken = await generateJwtToken({
      id: transformedUserData.id,
      name: transformedUserData.name,
      email: transformedUserData.email,
      provider: transformedUserData.provider,
    }, TOKEN_EXPIRE);
    await ctx.cookies.set("token", jwtToken, {
      maxAge: TOKEN_EXPIRE * 1000,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    await ctx.cookies.delete("session_id", {
      path: "/",
      httpOnly: true,
      sameSite: "lax"
    });
    ctx.response.redirect("/home");
  } catch (error) {
    console.error("OAuth 回调错误:", error);
    if (error instanceof PasteError) {
      return new Response(ctx, error.status, error.message);
    } else {
      throw new PasteError(500, "认证回调错误");
    }
  }
};
