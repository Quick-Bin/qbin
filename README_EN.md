<div align="center">
  <h1>QBin · Quick Storage</h1>

  <img src="https://s3.tebi.io/lite/favicon.svg" width="20%" alt="QBin LOGO" title="QBin LOGO" />

  > ✨ A lightweight Cloud Note & PasteBin alternative. Save text, code, images, videos, and any content with just one click for easier sharing!

  [English] · [**简体中文**](README.md) · [Demo Website] · [Documentation](Docs/document.md) · [Self-hosting Guide](Docs/self-host.md) · [REST API](Docs/REST%20API.md) 
</div>

## 🖼️ Feature Preview
Mobile
---
![Mobile photos](https://s3.tebi.io/lite/mobile-preview.jpg)

Windows
----

![Windows photos](https://s3.tebi.io/lite/windows-preview.jpg)


## 📝 Project Introduction

QBin focuses on "fast, secure, and lightweight" online editing and content sharing, suitable for personal notes, temporary storage, team collaboration, cross-platform sharing, and many other scenarios.
- Frontend uses pure HTML+JS+CSS without heavy frameworks, featuring Monaco code editor, Cherry Markdown renderer, and a universal editor for various content types.
- Backend uses Deno Oak framework + PostgreSQL database, combined with Deno KV and Edge Cache for multi-level caching, providing excellent performance for both reading and writing.
- Built-in PWA and IndexedDB support lets you edit, save, and preview even when offline.
- Freely set access paths, passwords, and expiration dates for flexible sharing while protecting privacy.
- Compared to traditional PasteBin services, QBin offers richer editing capabilities, multi-layered security, and higher extensibility.

## ✨ Project Features

- 🚀 **Simple Storage**: Easily save text, code, images, audio/video, and other content with one-click sharing
- 🔒 **Secure Control**: Support for custom access paths and password protection
- ⏱️ **Flexible Expiration**: Set storage validity periods with automatic deletion of expired data
- 🌓 **Light/Dark Mode**: Support for dark/light/system theme for comfortable viewing day or night
- 📱 **PWA Offline**: Edit and access local cache without internet, take notes anytime, anywhere
- 🔄 **Real-time Saving**: Automatic periodic saving to local and remote storage to prevent data loss
- 🔑 **Multiple Logins**: Support for username/password and OAuth2 (Google, GitHub, Microsoft, custom)
- ♻️ **Multi-level Cache**: Combining Deno KV, PostgreSQL, Edge Cache, and ETag for faster access
- ⚡ **One-click Deploy**: Support for Docker Compose, Deno Deploy, and more for easy self-hosting

## 🚀 Quick Start Guide

1. Visit a deployed QBin link (or local environment)
2. Enter the default admin username and password
3. After logging in, enter content or paste/drag-and-drop files in any editor (General/Code/Markdown)
4. Set link path, expiration time, password protection (optional)
5. Content is automatically saved and sharing links or QR codes are generated
6. Visit the link to view or download content (password required if set)

For more detailed usage, please refer to the [User Guide](Docs/document.md).

## 🔧 Technology Stack
Frontend:
- Pure HTML + JS + CSS (no third-party frameworks)
- Monaco code editor + Cherry Markdown + Universal editor

Backend:
- Deno Oak framework
- PostgreSQL database
- Deno KV & Edge Cache multi-level caching + ETag cache validation

Security and Authentication:
- JWT + username/password
- OAuth2 login (Google, GitHub, Microsoft, Custom)

## ⚡ Self-hosting Deployment
Several deployment methods are provided below.

### Docker Compose (Recommended)

```bash
git clone https://github.com/Quick-Bin/qbin.git
cd qbin
docker-compose up -d
```

After running, visit http://localhost:8000 to start using.
(Default admin account and password can be modified in docker-compose.yml)

### Using Docker Directly

Suitable for environments with existing PostgreSQL:
```bash
# Pull the latest image
docker pull naiher/qbin:latest

# Start the container
docker run -it -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  -e JWT_SECRET="your_jwt_secret" \
  -e ADMIN_PASSWORD="qbin" \
  -e ADMIN_EMAIL="admin@qbin.github" \
  naiher/qbin
```

Then visit http://localhost:8000.
> Tip: You can use free PostgreSQL from [Neon](https://neon.tech/), [Aiven](https://aiven.io/), or [Render](https://render.com/docs/deploy-mysql).

### Other Deployment Methods

QBin can run on Deno Deploy, local Deno environments, and other platforms. See [Self-hosting Guide](Docs/self-host.md) for details.

## 🚀 TODO
- [ ] Implement end-to-end encryption
- [x] Markdown, audio/video, image preview
- [x] Personal dashboard
- [x] Docker deployment support
- [x] Third-party OAuth2 login (Google / GitHub / Microsoft / Custom)
- [x] Multi-level hot-cold storage
- [x] Mobile + light/dark/system theme adaptation
- [x] ETag cache + IndexedDB local storage
- [x] Custom storage path, password, and expiration
- [x] Automatic local data backup

## 🤝 How to Contribute

1. Fork this project
2. Create a new branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add amazing feature"`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Create a Pull Request and wait for it to be merged

## ❤ Sponsorship Support

If QBin has helped you or your team, please consider sponsoring through [Afdian](https://afdian.com/a/naihe) to help the project continue to update and improve!

<a title="QBin Sponsor" href="https://afdian.com/a/naihe" target="_blank" rel="noopener">
  <img src="https://s3.tebi.io/lite/Sponsor.svg" width="25%" alt="QBin Sponsor" title="QBin Sponsor" />
</a>

## 😘 Acknowledgments
Special thanks to the projects that provided support and inspiration:

- [Cherry Markdown](https://github.com/Tencent/cherry-markdown)
- [Monaco Editor](https://github.com/microsoft/monaco-editor)
- [deno_docker](https://github.com/denoland/deno_docker)
- [bin](https://github.com/wantguns/bin)
- [excalidraw](https://github.com/excalidraw/excalidraw)

## License

This project is open-source under the [GPL-3.0](LICENSE) license. Feel free to use and develop it further.
Let's build an open and efficient cloud storage and sharing ecosystem together!
