# MoneyMan Tauri 桌面版設計

## 概述

用 Tauri v2 將現有 MoneyMan (Vite + Vue 3) 專案包成桌面應用程式。不修改任何現有程式碼，純粹加上 Tauri 包裝層。

## 目標

- 在 PC 上以桌面 app 形式運行 MoneyMan
- 主要用途：下載 CWMoney .iDB → 離線編輯 → 匯出
- 所有現有功能保留（記帳、對帳、信用卡推薦、CWMoney 匯入/匯出、Google Drive 等）

## 設計決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| 桌面框架 | Tauri v2 | 打包小 (~5-10MB)、不需 Node.js 後端、不需寫 Rust |
| 現有程式碼 | 零修改 | 純粹加包裝層，降低風險 |
| 檔案操作 | 沿用瀏覽器方式 (拖拉 + Blob 下載) | 之後再考慮原生檔案對話框 |
| Google Drive | 保留不動 | 程式碼不移除，桌面版使用者自行決定是否使用 |
| PWA Service Worker | 桌面模式下停用 | 桌面 app 不需要 PWA 快取 |
| 自動更新 | 不做 | 個人工具，手動 build 即可 |
| 跨平台 CI/CD | 不做 | 先手動 build |

## 目錄結構變更

```
MoneyMan/
├── src/                ← 現有 Vue 前端（不動）
├── src-tauri/          ← 新增：Tauri 設定與後端
│   ├── Cargo.toml      ← Rust 依賴
│   ├── tauri.conf.json ← Tauri 設定（視窗大小、app 名稱、指向 Vite dev server）
│   ├── build.rs        ← Tauri build script
│   ├── src/
│   │   └── main.rs     ← 最小 Tauri 啟動程式（~5 行）
│   └── icons/          ← app 圖示
├── vite.config.js      ← 可能微調：確保 dev server host/port 與 Tauri 一致
└── package.json        ← 新增 scripts: tauri dev, tauri build
```

## 實作範圍

### 做的事

1. 安裝 `@tauri-apps/cli` 和 `@tauri-apps/api` 依賴
2. 初始化 `src-tauri/` 目錄（tauri init）
3. 設定 `tauri.conf.json`：
   - app 名稱：MoneyMan
   - 視窗大小：適合手機 UI 的寬度（如 420x800）
   - 指向 Vite dev server (`http://localhost:5173`)
   - build 時指向 `dist/` 目錄
4. `package.json` 加入開發與打包指令
5. 確保 Vite dev server 設定與 Tauri 相容
6. 停用 PWA service worker（桌面模式下不需要）

### 不做的事

- 不修改任何現有 Vue 元件
- 不使用 Tauri 原生檔案 API（未來再加）
- 不做自動更新機制
- 不做跨平台 CI/CD
- 不做 app 簽章

## 開發流程

```bash
# 開發模式：啟動 Vite + Tauri 視窗
npm run tauri dev

# 打包：產出可執行檔
npm run tauri build
```

## 影響範圍

| 檔案 | 變更類型 |
|------|---------|
| `src-tauri/` | **新增**：整個 Tauri 目錄 |
| `package.json` | 修改：加 devDependencies + scripts |
| `vite.config.js` | 可能微調：dev server 設定 |
| `.gitignore` | 修改：加 `src-tauri/target/` |

## 前置需求

- Rust toolchain（`rustup`）
- 系統 WebView 開發套件（Linux: `libwebkit2gtk-4.1-dev` 等）

## 未來可擴充

- 原生檔案對話框（Tauri fs plugin）
- 系統 tray / 選單列
- 自動更新（Tauri updater plugin）
