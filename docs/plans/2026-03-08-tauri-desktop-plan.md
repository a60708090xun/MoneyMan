# MoneyMan Tauri 桌面版實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 Tauri v2 將現有 MoneyMan 包成桌面應用程式，不修改任何現有功能。

**Architecture:** 在現有 Vite + Vue 3 專案上加 Tauri 包裝層。Vite 作為前端 dev server，Tauri 提供桌面視窗。`vite.config.js` 依環境變數切換 base path 和 PWA 設定。

**Tech Stack:** Tauri v2, Rust (minimal), Vite, Vue 3

---

### Task 1: 安裝系統前置依賴

**Step 1: 確認 Rust toolchain 已安裝**

Run: `rustc --version`
Expected: 版本號輸出（如 `rustc 1.xx.x`）

如果沒有安裝：
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Step 2: 安裝 Linux WebView 開發套件（WSL2）**

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**Step 3: Commit**

無需 commit，這是系統環境設定。

---

### Task 2: 安裝 Tauri npm 依賴

**Files:**
- Modify: `package.json`

**Step 1: 安裝 @tauri-apps/cli 和 @tauri-apps/api**

```bash
npm install --save-dev @tauri-apps/cli@^2
npm install @tauri-apps/api@^2
```

**Step 2: 確認安裝成功**

Run: `npx tauri --version`
Expected: 版本號輸出（如 `tauri-cli 2.x.x`）

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Tauri v2 dependencies

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

### Task 3: 初始化 Tauri 專案

**Files:**
- Create: `src-tauri/` 整個目錄

**Step 1: 執行 tauri init**

```bash
npx tauri init
```

互動式問答填入：
- App name: `MoneyMan`
- Window title: `MoneyMan`
- Frontend dev URL: `http://localhost:5173`
- Frontend dist dir: `../dist`
- Dev command: `npm run dev`
- Build command: `npm run build`

**Step 2: 確認 src-tauri/ 目錄已建立**

Run: `ls src-tauri/`
Expected: 包含 `Cargo.toml`, `tauri.conf.json`, `src/main.rs` 等

**Step 3: Commit**

```bash
git add src-tauri/
git commit -m "chore: initialize Tauri v2 project

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

### Task 4: 設定 tauri.conf.json

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Step 1: 調整視窗與 app 設定**

在 `tauri.conf.json` 中確認/修改以下設定：

```json
{
  "productName": "MoneyMan",
  "identifier": "com.moneyman.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run tauri:build-web"
  },
  "app": {
    "windows": [
      {
        "title": "MoneyMan",
        "width": 420,
        "height": 800,
        "resizable": true,
        "minWidth": 360,
        "minHeight": 600
      }
    ]
  }
}
```

**Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: configure Tauri window size and app settings

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

### Task 5: 調整 vite.config.js 支援 Tauri 模式

**Files:**
- Modify: `vite.config.js`

**Step 1: 依環境切換 base path 和 PWA**

Tauri 啟動時會設定環境變數 `TAURI_ENV_PLATFORM`。利用這個變數判斷是否為 Tauri 模式。

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const isTauri = !!process.env.TAURI_ENV_PLATFORM

export default defineConfig({
  base: isTauri ? '/' : '/MoneyMan/',
  plugins: [
    vue(),
    ...(!isTauri ? [VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MoneyMan',
        short_name: 'MoneyMan',
        description: '跨平台記帳 App，信用卡回饋追蹤與智慧推薦',
        theme_color: '#4CAF50',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/MoneyMan/',
        icons: [
          { src: '/MoneyMan/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/MoneyMan/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })] : [])
  ],
  optimizeDeps: {
    exclude: ['sql.js']
  },
  // Tauri dev server 需要 host 設定
  server: {
    host: isTauri ? '0.0.0.0' : undefined,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js']
  }
})
```

**Step 2: 確認原有 web build 不受影響**

Run: `npm run build`
Expected: 正常 build 到 `dist/`，PWA 仍然啟用

**Step 3: 確認測試仍通過**

Run: `npm test`
Expected: 所有測試 PASS

**Step 4: Commit**

```bash
git add vite.config.js
git commit -m "feat: conditional Tauri mode in vite config

Skip PWA and use '/' base path when running under Tauri.

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

### Task 6: 新增 package.json scripts

**Files:**
- Modify: `package.json`

**Step 1: 加入 Tauri 相關指令**

在 `scripts` 中新增：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build-web": "vite build"
  }
}
```

說明：
- `tauri:dev`：開發模式，啟動 Vite + Tauri 視窗
- `tauri:build`：打包成可執行檔
- `tauri:build-web`：給 `tauri.conf.json` 的 `beforeBuildCommand` 使用

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add Tauri dev/build scripts

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

### Task 7: 更新 .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: 加入 Tauri build 產出目錄**

在 `.gitignore` 末尾加入：

```
# Tauri
src-tauri/target/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore Tauri build output

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

### Task 8: 驗證 Tauri dev 模式

**Step 1: 啟動 Tauri 開發模式**

Run: `npm run tauri:dev`
Expected:
- Vite dev server 啟動
- Tauri 桌面視窗開啟
- MoneyMan UI 正常顯示
- 可以操作所有功能（記帳、CWMoney 匯入/匯出等）

**Step 2: 手動測試關鍵功能**

- [ ] 首頁載入正常
- [ ] 新增交易可以操作
- [ ] CWMoney 匯入（拖拉 .iDB）
- [ ] CWMoney 匯出（下載 .iDB）
- [ ] 路由切換正常

**Step 3: 如有問題，回頭修正設定後重試**

---

### Task 9: 驗證 Tauri build

**Step 1: 打包**

Run: `npm run tauri:build`
Expected: 在 `src-tauri/target/release/bundle/` 下產出可執行檔

**Step 2: 執行打包後的 app**

找到產出的執行檔並運行，確認功能正常。

**Step 3: 最終 commit（如有修正）**

```bash
git add -A
git commit -m "fix: adjustments for Tauri build

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```
