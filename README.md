<div align="center">
  <h1>QBin · 一键存储</h1>

  <img src="https://s3.tebi.io/lite/favicon.svg" width="20%" alt="QBin LOGO" title="QBin LOGO" />

  > ✨ 轻量的 Cloud Note & PasteBin 替代方案，一键保存文本、代码、图片、视频等任意内容，分享更便捷！

  [简体中文] · [**English**](README_EN.md) · [演示站点] · [使用文档](Docs/document.md) · [自托管教程](Docs/self-host.md) · [接口文档](Docs/REST%20API.md)

<!-- SHIELD GROUP -->

[![][docker-pulls-shield]][docker-pulls-link]
[![][latest-version-shield]][latest-version-link]
[![][github-stars-shield]][github-stars-link]
[![][github-license-shield]][github-license-link]

</div>

## 🖼️ 功能预览
Mobile
---
![Mobile photos](https://s3.tebi.io/lite/mobile-preview.jpg)

Windows
----

![Windows photos](https://s3.tebi.io/lite/windows-preview.jpg)


## 📝 项目简介

QBin 专注于「快速、安全、便捷」的在线编辑与内容分享，适合个人笔记、临时存储、多人协作、跨平台分享等多种场景。  
- 前端全程采用纯 HTML+JS+CSS，无需笨重框架，内置 Monaco 代码编辑器、Cherry Markdown 渲染器、通用编辑器，满足多种内容场景；  
- 后端选用 Deno Oak 框架 + Drizzle ORM，并结合 Deno KV 与 Edge Cache 多级缓存，让读取与写入都拥有极佳性能；  
- 内置 PWA 与 IndexedDB 支持，让你在断网下依然可以编辑、保存与预览；  
- 可自由设置访问路径、密码、有效期，保护隐私的同时实现灵活分享；  
- 与传统 PasteBin 相比，QBin 提供了更丰富的编辑能力、多层次安全防护和更高扩展性。

## ✨ 项目特性

- 🚀 **极简存储**：轻松保存文字、代码、图片、音视频等任意类型，一键分享
- 🔒 **安全可控**：支持自定义访问路径和密码保护
- ⏱️ **灵活期限**：可设置存储有效期，数据过期自动删除
- 🌓 **明暗切换**：支持深色 / 浅色 / 跟随系统模式，夜间使用更护眼
- 📱 **PWA 离线**：断网也能编辑、读取本地缓存，随时随地记录与查看 
- 🔄 **实时保存**：自动定时保存到本地及远程，减少数据丢失风险
- 🔑 **多种登录**：支持账号密码登录 和 OAuth2（Google、GitHub、Microsoft、自定义）
- ♻️ **多级缓存**：Deno KV、Drizzle ORM、Edge Cache 与 ETag 结合，提升访问速度
- ⚡ **一键部署**：支持 Docker Compose、Deno Deploy 等多种场景，轻松自托管

## 🚀 快速使用指南

1. 访问已部署的 QBin 链接 (或本地环境)
2. 输入默认管理员账号密码
3. 登录后可在“通用 / Code / Markdown”任意编辑器里输入内容或粘贴、拖放上传文件
4. 设置链接路径、过期时间、密码保护 (可选)  
5. 自动保存并生成分享链接或二维码  
6. 访问链接查看或下载内容 (若有密码则需输入密码)

更多详细用法可参考 [使用指南](Docs/document.md)。

## 🔧 技术栈
前端:  
- 纯 HTML + JS + CSS (无第三方框架)  
- Monaco 代码编辑器 + Cherry Markdown + 通用编辑器  

后端:  
- Deno Oak 框架
- Drizzle ORM库，支持PostgreSQL、 SQLite等数据库  
- Deno KV & Edge Cache 多级缓存 + ETag 缓存校验  

安全与认证:  
- JWT + 账号密码  
- OAuth2 登录 (Google、GitHub、Microsoft、Custom)

## ⚡ 自托管部署
以下提供了多种一键部署与自定义部署方式。

### Docker Compose (推荐)

```bash
git clone https://github.com/quick-bin/qbin.git
cd qbin
docker-compose up -d
```

运行后访问 http://localhost:8000 ，即可开始使用。  
(默认管理员账号密码可在 docker-compose.yml 内修改)

### 直接使用 Docker

默认 SQLite 本地存储：
```bash
# 拉取最新镜像
docker pull naiher/qbin:latest

# 启动容器
docker run -d -p 8000:8000 \
  -e JWT_SECRET="your_jwt_secret" \
  -e ADMIN_EMAIL="admin@qbin.github" \
  -e ADMIN_PASSWORD="qbin" \
  -e DB_CLIENT="sqlite" \
  -e ENABLE_ANONYMOUS_ACCESS="1" \
  -v ~/qbin-data:/app/data \
  --name qbin  \
  --restart always  \
  naiher/qbin
```

然后访问 http://localhost:8000 即可。  

### 其他部署方式

支持将 QBin 运行在 Deno Deploy、本地 Deno 环境等更多场景。详见[自托管教程](Docs/self-host.md)。

## 🚀 TODO
- [ ] 增加存储管理自定义排序功能  
- [ ] 增加MySQL存储  
- [ ] 增加Cloudflare D1存储  
- [ ] 打包为多平台本地程序 
- [ ] 实现端到端加密  
- [x] 优化编辑器设置面板功能  
- [x] 增加后端本地存储（SQLite数据库） 
- [x] Code高亮、Markdown、音视频、图片预览  
- [x] 本地离线访问 
- [x] 个人中心面板  
- [x] Docker 部署支持  
- [x] 第三方 OAuth2 登录 (Google / GitHub / Microsoft / Custom)    
- [x] 多级热 - 冷存储  
- [x] 移动端 + 浅色 / 深色 / 跟随系统主题适配 
- [x] ETag 协商缓存 + IndexedDB 本地存储  
- [x] 自定义存储路径、密码和有效期  
- [x] 数据自动本地备份 

## 🤝 参与贡献

如果您对这个项目感兴趣，欢迎参与贡献，也欢迎 "Star" 支持一下 ^_^ <br>
以下为提PR并合并的小伙伴，在此感谢项目中所有的贡献者。

<a href="https://github.com/quick-Bin/qbin/graphs/contributors" target="_blank">
  <table>
    <tr>
      <th colspan="2">
        <br><img src="https://contrib.rocks/image?repo=quick-bin/qbin"><br><br>
      </th>
    </tr>
  </table>
</a>

1. Fork 本项目  
2. 创建新分支：`git checkout -b feature/amazing-feature`  
3. 提交更改：`git commit -m "Add amazing feature"`  
4. 推送分支：`git push origin feature/amazing-feature`  
5. 发起 Pull Request，等待合并

## ❤ 赞助支持

如果 QBin 帮到您或贵团队，欢迎通过[爱发电](https://afdian.com/a/naihe)进行赞助，助力项目持续更新与优化！

<a title="QBin Sponsor" href="https://afdian.com/a/naihe" target="_blank" rel="noopener">
  <img src="https://s3.tebi.io/lite/Sponsor.svg" width="25%" alt="QBin Sponsor" title="QBin Sponsor" />
</a>

## 😘 鸣谢
特此感谢为本项目提供支持与灵感的项目

- [Cherry Markdown](https://github.com/Tencent/cherry-markdown)
- [Monaco Editor](https://github.com/microsoft/monaco-editor)
- [deno_docker](https://github.com/denoland/deno_docker)
- [drizzle-orm](https://github.com/drizzle-team/drizzle-orm)
- [bin](https://github.com/wantguns/bin) 
- [line-md](https://github.com/cyberalien/line-md) 
- [excalidraw](https://github.com/excalidraw/excalidraw) 

## 许可证

本项目采用 [GPL-3.0](LICENSE) 协议开源，欢迎自由使用与二次开发。  
让我们共建开放、高效的云上存储与分享新生态！


## Stargazers over time
[![Stargazers over time](https://starchart.cc/Quick-Bin/qbin.svg?variant=adaptive)](https://starchart.cc/Quick-Bin/qbin)


<!-- LINK GROUP -->
[docker-pulls-link]: https://hub.docker.com/r/naiher/qbin
[docker-pulls-shield]: https://img.shields.io/docker/pulls/naiher/qbin?style=flat-square&logo=docker&labelColor=black
[latest-version-shield]: https://img.shields.io/github/v/release/quick-Bin/qbin?style=flat-square&label=latest%20version&labelColor=black
[latest-version-link]: https://github.com/Quick-Bin/Qbin/releases
[github-stars-shield]: https://img.shields.io/github/stars/quick-bin/qbin?style=flat-square&logo=github&labelColor=black
[github-stars-link]: https://github.com/quick-bin/qbin/stargazers
[github-license-shield]: https://img.shields.io/github/license/quick-bin/qbin?style=flat-square&logo=github&labelColor=black
[github-license-link]: https://github.com/quick-bin/qbin/issues
