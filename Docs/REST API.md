# QBin API文档

## 系统状态
```http
GET /api/health
```
用途：检查服务是否正常运行
- 返回：200 表示服务正常

## 内容管理

### 1. 上传/更新内容
```http
POST /save/{访问路径}/{密码}
```
- 说明：如果内容存在则更新，不存在则创建
- 权限：更新已有内容需要是创建者
- 请求头：
  - `Content-Type`: 内容类型
  - `x-expire`: 过期时间(秒)
  - `Cookie`: 生成的API Token信息
- 返回：成功返回访问链接
- python代码示例
```python
import requests

def upload_content(path, content, password="", expire=315360000):
    url = f'http://localhost:8000/save/{path}/{password}'
    headers = {
        'Content-Type': 'text/plain',
        'x-expire': str(expire),
        'Cookie': 'token=your_jwt_token'  # 在设置API Token中生成获取
    }
    response = requests.post(url, data=content, headers=headers)

    if response.status_code == 200:
        result = response.json()
        print(f"上传成功，访问链接: {result['data']['url']}")
    elif response.status_code == 403:
        print("无权限更新")
    elif response.status_code == 413:
        print("内容超过大小限制")

# 使用示例
upload_content('test123', 'Hello World', 'password123')
```

### 2. 上传文件内容 
```http
PUT /save/{访问路径}/{密码}
```
- 说明：如果文件存在则更新，不存在则创建
- 权限：更新已有文件需要是创建者
- 请求头：
  - `Content-Type`: 内容类型
  - `x-expire`: 过期时间(秒)
  - `Cookie`: 生成的API Token信息
- 返回：成功返回访问链接

### 3. 获取直链内容
```http
GET /r/{访问路径}/{密码}
```

## 认证相关

### 1. 获取API Token
```http
POST /api/user/token
```
- 用途：获取当前用户的认证token
- 返回：
  ```json
  {
    "token": "jwt_token_string"
  }
  ```
- 说明：需要已登录状态

### 2. 登出
```http
POST /api/user/logout
```
- 用途：清除用户登录状态

### 3. 社交登录
```http
GET /api/login/{provider}
```
- provider支持：github, google, microsoft, custom

## 响应格式
所有API返回统一格式：
```json
{
  "code": 200,          // 状态码
  "message": "success", // 状态信息
  "data": {            // 数据体
    // 具体内容
  }
}
```

## 常见状态码
- 200: 成功
- 403: 无权限
- 404: 内容不存在
- 409: 内容已存在
- 413: 内容过大
- 500: 服务器错误