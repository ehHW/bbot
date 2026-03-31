# bbot 前端

基于 Vue 3 + TypeScript + Vite + Ant Design Vue 的管理后台前端，包含登录鉴权、用户/角色/权限管理、文件管理与上传等页面。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Ant Design Vue
- Axios

## 运行环境

- Node.js: `^20.19.0 || >=22.12.0`
- 包管理器: pnpm

## 安装依赖

```bash
pnpm install
```

## 开发启动

```bash
pnpm dev
```

默认使用 Vite 开发服务器，接口通过代理转发到后端：

- `/api` -> `http://127.0.0.1:8000/`
- `/ws/` -> `ws://127.0.0.1:8000/ws/`
- `/uploads` -> `http://127.0.0.1:8000/uploads`

## 常用命令

```bash
# 类型检查
pnpm type-check

# 构建生产包
pnpm build

# 本地预览生产包
pnpm preview

# 格式化 src 目录
pnpm format
```

## 目录结构（简要）

```text
src/
  api/            # 接口封装
  stores/         # Pinia 状态管理
  router/         # 路由配置
  views/          # 页面
  Layout/         # 布局组件
  utils/          # 请求封装、进度条等工具
  components/     # 复用组件
```

## 联调说明

1. 先启动后端（默认 8000 端口）。
2. 再启动前端开发服务。
3. 浏览器访问前端地址（Vite 启动后终端会输出）。

## 备注

- 请求基础路径配置在 `src/utils/request.ts`。
- 代理配置在 `vite.config.ts`。
