# GitHub 上传和 Pages 部署完整指南

## ✅ 必须上传的文件

以下文件需要添加到 Git 仓库并上传到 GitHub：

```
kanban-tool/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   ├── screenshots/      # 项目运行截图
│   │   │   ├── desktop.png
│   │   │   ├── tablet.png
│   │   │   └── mobile.png
│   │   └── shubiao.png
│   ├── stores/
│   │   └── kanban.js
│   ├── views/
│   │   └── KanbanView.vue
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

## ❌ 不应上传的文件

以下文件已经在 `.gitignore` 中配置，不需要上传：

- `node_modules/` - 依赖包（通过 npm install 安装）
- `dist/` - 构建产物（通过 npm run build 生成）
- `.vscode/` - VS Code 配置（除了 extensions.json）
- `.idea/` - IntelliJ IDEA 配置
- `.DS_Store` - macOS 文件
- `.local` - 本地临时文件
- `*.log` - 日志文件

## 📋 详细文件说明

### 核心源代码
| 文件 | 说明 |
|------|------|
| `src/App.vue` | 根组件 |
| `src/main.js` | 应用入口 |
| `src/style.css` | 全局样式 |
| `src/views/KanbanView.vue` | 看板主页面（核心功能） |
| `src/stores/kanban.js` | Pinia 状态管理 |

### 静态资源
| 文件 | 说明 |
|------|------|
| `public/favicon.svg` | 网站图标 |
| `public/icons.svg` | 图标集 |
| `src/assets/shubiao.png` | 图片资源 |
| `src/assets/screenshots/` | 项目运行截图（用于 README 展示） |

### 配置文件
| 文件 | 说明 |
|------|------|
| `package.json` | 项目依赖和脚本 |
| `package-lock.json` | 依赖版本锁定 |
| `vite.config.js` | Vite 构建配置 |
| `index.html` | HTML 入口 |

### 文档文件
| 文件 | 说明 |
|------|------|
| `README.md` | 项目说明文档 |
| `.gitignore` | Git 忽略规则 |

---

## 🚀 第一部分：上传到 GitHub

### 步骤 1：配置 Vite 部署路径

首先需要修改 `vite.config.js`，让项目支持 GitHub Pages 路径（重要！）：

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 配置 GitHub Pages 部署的基础路径
  base: '/你的仓库名/'  // 替换为你的实际仓库名
})
```

### 步骤 2：初始化 Git 仓库

```bash
git init
```

### 步骤 3：查看当前状态

```bash
git status
```

### 步骤 4：添加所有需要上传的文件

```bash
git add .
```

### 步骤 5：创建提交

```bash
git commit -m "feat: 初始化可视化任务看板系统"
```

### 步骤 6：关联远程仓库

首先在 GitHub 创建一个新仓库（仓库名要和 vite.config.js 中配置的一致），然后：

```bash
git remote add origin https://github.com/你的用户名/你的仓库名.git
```

### 步骤 7：推送到 GitHub

```bash
git branch -M main
git push -u origin main
```

---

## 🤔 常见问题：GitHub Pages 能部署几个项目？

**答案：可以部署无限多个项目！** GitHub Pages 分为两种：

| 类型 | 数量限制 | 仓库名要求 | 访问地址 |
|------|----------|------------|----------|
| 用户/组织站点 | 1个 | 必须是 `你的用户名.github.io` | `https://你的用户名.github.io/` |
| **项目站点** | **无限个** | 任意名称 | `https://你的用户名.github.io/仓库名/` |

你的看板项目属于**项目站点**，所以放心部署！以后还可以用同样方式部署更多项目。

---

## 🌐 第二部分：部署到 GitHub Pages

### 方法一：使用 GitHub Actions 自动部署（推荐）

#### 1. 创建 GitHub Actions 工作流文件

在项目根目录创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  # 推送到 main 分支时自动部署
  push:
    branches: [ main ]
  # 允许手动触发部署
  workflow_dispatch:

# 设置权限，允许部署到 GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  # 构建任务
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Setup Pages
        uses: actions/configure-pages@v4
        
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  # 部署任务
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 2. 配置 GitHub 仓库设置

1. 进入你的 GitHub 仓库
2. 点击 **Settings**
3. 在左侧菜单找到 **Pages**
4. 在 **Build and deployment** 中：
   - Source 选择 **GitHub Actions**（不是 Deploy from a branch）

#### 3. 提交并推送工作流文件

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: 添加 GitHub Pages 部署工作流"
git push
```

#### 4. 查看部署进度

1. 去 GitHub 仓库的 **Actions** 标签页
2. 等待工作流运行完成
3. 部署成功后会显示绿色的 ✅

#### 5. 访问你的网站

部署成功后，访问：
`https://你的用户名.github.io/你的仓库名/`

---

### 方法二：手动部署（不推荐）

如果你不想用 GitHub Actions，也可以手动部署：

#### 1. 安装 gh-pages 工具

```bash
npm install -D gh-pages
```

#### 2. 在 package.json 添加部署脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "gh-pages -d dist"
  }
}
```

#### 3. 构建并部署

```bash
npm run build
npm run deploy
```

#### 4. 配置 GitHub Pages

1. 仓库 Settings → Pages
2. Source 选择 **Deploy from a branch**
3. Branch 选择 **gh-pages** 分支
4. 点击 Save

---

## 📌 注意事项

### 上传前检查

1. **确保 vite.config.js 配置正确** - base 路径必须是你的仓库名
2. **确保 .gitignore 正确** - 不要将 node_modules 和 dist 提交
3. **检查敏感信息** - 确认没有 API keys 或密码被提交
4. **保留 package-lock.json** - 确保依赖版本一致性
5. **本地测试构建** - 先运行 `npm run build` 确保可以正常构建

### 部署常见问题

#### 问题 1：页面显示 404

**原因**：vite.config.js 中的 base 路径配置错误

**解决**：确保 base 是 `'/你的仓库名/'`（注意前后都有斜杠）

#### 问题 2：资源加载失败

**原因**：路径配置错误

**解决**：检查浏览器控制台的资源路径，确认和你的仓库名一致

#### 问题 3：GitHub Actions 部署失败

**原因**：权限配置问题

**解决**：检查仓库 Settings → Pages 中是否选择了 GitHub Actions 作为来源

---

## 💡 可选优化

### 添加 deploy 脚本（方法二）

如果使用方法二，除了上面的，还可以：

- `LICENSE` - 开源许可证
- `.env` - 环境变量（但不要提交真实值）
- `CHANGELOG.md` - 更新日志
- `.prettierrc` - 代码格式化配置
- `eslint.config.js` - ESLint 配置

### 自定义域名

如果有域名，可以在仓库 Settings → Pages 中配置 Custom domain。

---

## 🎯 快速检查清单

部署前确认：
- [ ] vite.config.js 中的 base 路径已配置
- [ ] 本地 `npm run build` 可以正常运行
- [ ] package.json 和 package-lock.json 已提交
- [ ] .github/workflows/deploy.yml 已创建并提交
- [ ] GitHub Pages 已配置为使用 GitHub Actions

部署后确认：
- [ ] Actions 工作流运行成功
- [ ] 可以访问 https://你的用户名.github.io/你的仓库名/
- [ ] 所有资源加载正常（没有 404）
- [ ] 功能正常（拖拽、添加任务等）
