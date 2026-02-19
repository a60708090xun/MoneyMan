# MoneyMan 設計文件

> 日期：2026-02-19
> 狀態：已確認

## 概述

MoneyMan 是一個跨平台記帳 PWA，支援電腦與手機使用，透過 Google Drive 手動同步資料。核心特色是**信用卡回饋追蹤與智慧推薦**，幫助使用者判斷每筆消費該刷哪張卡最划算。

## 技術棧

| 項目 | 選擇 | 說明 |
|------|------|------|
| 類型 | PWA | 電腦用瀏覽器、手機加到桌面 |
| 前端框架 | Vue 3 + Vite | 輕量、PWA 生態成熟 |
| 狀態管理 | Pinia | Vue 3 官方推薦 |
| 本地儲存 | IndexedDB | 離線可用、容量足夠 |
| 圖表 | Chart.js | 圓餅圖、長條圖 |
| 同步 | Google Drive API | 手動上傳/下載，零伺服器成本 |
| 卡片規則 | JSON 設定檔 | 可手動編輯或用 Claude Code Skill 更新 |

## 核心功能

### 1. 收支記錄

- 欄位：金額、日期、分類、通路、指定信用卡、收入/支出、備註
- 支援新增、編輯、刪除
- 通路選項：網購、超商、餐飲、交通、一般消費等（可自訂）

### 2. 分類管理

- 預設分類：飲食、交通、娛樂、購物、居家、醫療、教育
- 使用者可自訂新增/刪除分類
- 分類帶有圖示與顏色

### 3. 月報表

- **圓餅圖**：依分類顯示當月支出佔比
- **長條圖**：依日期顯示每日消費趨勢
- 月收入/支出/結餘統計
- 可切換月份檢視

### 4. 信用卡回饋追蹤

#### 4.1 卡片管理

- 新增/編輯/刪除信用卡
- 每張卡設定：名稱、銀行、結算日（每張卡可不同）
- 每張卡可設定多條回饋規則

#### 4.2 回饋規則

每張卡支援以下規則類型：

- **通路別回饋率**：指定通路的回饋百分比
- **每月回饋上限**：該通路的月回饋金額上限
- **總消費門檻**：消費達特定金額後的額外回饋

#### 4.3 智慧推薦引擎

使用者選擇消費通路後，系統綜合以下因素排序推薦：

1. **該通路回饋率** — 回饋率高的優先
2. **回饋上限** — 本月上限已用完的排除
3. **門檻差距** — 離達標越近越優先
4. **回饋效率** — 剩餘消費金額 vs 可得回饋的比值
5. **剩餘天數** — 結算日快到且來不及的降低優先度

推薦結果顯示：
- 推薦卡片名稱
- 該通路回饋率與預估回饋金額
- 門檻進度與達標後額外回饋
- 回饋效率指標

#### 4.4 進度儀表板

首頁顯示每張卡的當期消費進度條：

```
🏦 國泰 CUBE      ████████████░░  $8,500 / $10,000  差 $1,500 ⭐推薦
🏦 玉山 U Bear    ██████████░░░░  $7,200 / $10,000  差 $2,800
🏦 中信 LINE Pay  ██░░░░░░░░░░░░  $2,000 / $12,000  差 $10,000
```

### 5. PDF 帳單匯入與對帳

#### 5.1 PDF 匯入流程

1. 使用者選擇 PDF 帳單檔案
2. 輸入密碼（本地 pdf.js 解密，密碼不離開裝置）
3. 擷取文字內容
4. 自動偵測銀行（比對關鍵字：「國泰世華」「玉山」等）
5. 有對應解析器 → 自動解析交易明細（日期、商家名稱、金額）
6. 無對應解析器 → 顯示原始文字，手動框選欄位對應
7. 預覽交易清單，使用者確認後匯入

#### 5.2 插件式解析架構

採用插件模式，每家銀行一個解析器，方便擴充：

```
src/services/parsers/
├── index.js              # 解析器註冊與自動偵測
├── base-parser.js        # 基礎解析器介面
├── cathay-parser.js      # 國泰世華（範例）
├── esun-parser.js        # 玉山銀行（範例）
└── manual-parser.js      # 手動框選欄位（fallback）
```

每個解析器實作統一介面：
- `detect(text)` — 判斷此 PDF 是否屬於該銀行
- `parse(text)` — 解析交易明細，回傳標準格式

標準交易格式：
```json
{
  "date": "2026-02-03",
  "merchant": "全聯福利中心",
  "amount": 385,
  "currency": "TWD",
  "cardLast4": "1234"
}
```

#### 5.3 對帳比對邏輯

匯入帳單後，自動與手動記帳紀錄比對：

| 比對結果 | 條件 | 顯示 | 動作 |
|----------|------|------|------|
| 已對帳 | 日期 + 金額吻合 | ✅ | 無 |
| 金額不符 | 日期吻合但金額有差異 | ⚠️ | 可修正 |
| 帳單多出 | PDF 有但未手動記帳 | ❌ | 一鍵補記 |
| 手動多出 | 手動有記但帳單無此筆 | 🔍 | 需確認 |

比對策略：
1. 先以「日期 + 金額」精確配對
2. 同日期多筆同金額時，以商家名稱模糊比對輔助
3. 顯示對帳率（吻合筆數 / 總筆數）

#### 5.4 對帳結果畫面

```
2月帳單對帳 — 國泰 CUBE

✅ 02/03  全聯福利中心     $385     已對帳
⚠️ 02/05  momo購物        $1,200   你記 $1,199（差 $1）
❌ 02/08  台灣大哥大       $499     漏記 [一鍵補記]
🔍 02/10  星巴克           $180     帳單無此筆

對帳率：85%（17/20 筆吻合）
```

### 6. Google Drive 同步

- **上傳按鈕**：將本地 IndexedDB 資料匯出為 JSON，上傳至 Google Drive
- **下載按鈕**：從 Google Drive 拉回最新 JSON，覆蓋本地資料
- 需設定 Google Cloud OAuth（一次性）
- 不支援即時同步，適合單一裝置修改後手動同步

### 7. Claude Code Skill — `fetch-card-rewards`

- 用途：抓取銀行信用卡優惠網頁，自動更新卡片回饋設定檔
- 觸發方式：在 Claude Code 中手動執行
- 頻率：建議每月跑一次（銀行回饋規則通常按月更新）
- 輸出：更新 `cards-config.json`

## 卡片回饋設定檔格式

檔案路徑：`src/data/cards-config.json`

```json
{
  "lastUpdated": "2026-02-19",
  "cards": [
    {
      "id": "cathay-cube",
      "name": "國泰 CUBE",
      "bank": "國泰世華",
      "billingCycleDay": 15,
      "thresholds": [
        {
          "amount": 10000,
          "reward": "額外贈 $500",
          "rewardValue": 500
        }
      ],
      "channelRules": [
        {
          "channel": "網購",
          "rate": 0.03,
          "monthlyCap": 300
        },
        {
          "channel": "超商",
          "rate": 0.05,
          "monthlyCap": 200
        },
        {
          "channel": "一般",
          "rate": 0.01,
          "monthlyCap": null
        }
      ]
    }
  ]
}
```

## 頁面規劃

| 頁面 | 路由 | 內容 |
|------|------|------|
| 首頁 | `/` | 當月收支摘要 + 卡片進度條 + 推薦刷哪張 |
| 記帳頁 | `/add` | 新增/編輯收支（選分類、通路、卡片） |
| 報表頁 | `/report` | 月報圓餅圖 + 長條圖 + 統計數據 |
| 卡片管理 | `/cards` | 新增/編輯信用卡、查看回饋規則與進度 |
| 對帳頁 | `/reconcile` | 匯入 PDF 帳單、對帳比對結果、一鍵補記 |
| 設定頁 | `/settings` | 分類管理 + Google Drive 同步按鈕 |

## 專案結構

```
MoneyMan/
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App 圖示
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── router/
│   │   └── index.js           # Vue Router 設定
│   ├── views/
│   │   ├── HomeView.vue       # 首頁
│   │   ├── AddView.vue        # 記帳頁
│   │   ├── ReportView.vue     # 報表頁
│   │   ├── CardsView.vue      # 卡片管理
│   │   ├── ReconcileView.vue  # 對帳頁
│   │   └── SettingsView.vue   # 設定頁
│   ├── components/
│   │   ├── CardProgress.vue   # 卡片進度條元件
│   │   ├── CardRecommend.vue  # 智慧推薦元件
│   │   ├── ReconcileResult.vue # 對帳結果元件
│   │   ├── PieChart.vue       # 圓餅圖
│   │   └── BarChart.vue       # 長條圖
│   ├── stores/
│   │   ├── transactions.js    # 收支記錄 store
│   │   ├── cards.js           # 信用卡 store
│   │   ├── reconcile.js       # 對帳 store
│   │   └── categories.js     # 分類 store
│   ├── services/
│   │   ├── db.js              # IndexedDB 操作
│   │   ├── gdrive.js          # Google Drive API
│   │   ├── recommend.js       # 推薦引擎邏輯
│   │   ├── reconcile.js       # 對帳比對邏輯
│   │   └── parsers/           # PDF 帳單解析器
│   │       ├── index.js       # 解析器註冊與自動偵測
│   │       ├── base-parser.js # 基礎解析器介面
│   │       └── manual-parser.js # 手動框選（fallback）
│   ├── data/
│   │   └── cards-config.json  # 卡片回饋設定檔
│   └── assets/
│       └── styles/            # 全域樣式
├── docs/
│   └── plans/
├── package.json
└── vite.config.js
```

## 未來擴充（暫不實作）

- Capacitor 包裝上架 App Store / Google Play
- App 內建銀行網頁抓取功能
- 預算設定與超支提醒
- 多帳戶（現金、銀行帳戶）
- 匯出 CSV / Excel
