# CWMoney .iDB 匯入功能設計

日期：2026-02-20

## 概述

新增從 CWMoney（記帳城市）匯出的 `.iDB` 檔案匯入交易資料功能。同時將分類系統從單層升級為兩層架構（大分類 + 子分類），以對應 CWMoney 的分類結構。

## CWMoney .iDB 資料格式

`.iDB` 檔案為 SQLite 3 資料庫，主要資料表：

- **rec_table**：交易紀錄（23,009 筆範例，2013-06-25 ~ 2026-02-18）
  - `i_money` (TEXT) — 金額
  - `i_date` (datetime) — Unix timestamp
  - `i_type` (TEXT) — "1"=支出, "2"=收入
  - `i_kind` (TEXT) — 大分類 id
  - `i_kinds` (TEXT) — 子分類 id
  - `i_account` (TEXT) — 帳戶 id
  - `i_remark` (TEXT) — 備註
- **kind_table**：支出大分類（12 類）
- **kinds_table**：支出子分類（58 類）
- **in_kind_table**：收入大分類（3 類）
- **in_kinds_table**：收入子分類（11 類）
- **acc_table**：帳戶（34 個，含信用卡、現金、電子票證）

## Schema 變更

### IndexedDB 版本：1 → 2

### categories store

```
現有：{ id, name, color, icon }
新增：{ id, name, color, icon, parentId, type }
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| parentId | number \| null | null = 大分類，有值 = 子分類 |
| type | 'income' \| 'expense' | 區分收入/支出分類 |

新增 indexes：`parentId`, `type`

向下相容：現有 7 個分類升級為 `type: 'expense'`, `parentId: null`。

### transactions store

```
現有：{ id, amount, type, category, channel, cardId, date, note }
新增：{ id, amount, type, category, subcategory, channel, cardId, date, note, account }
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| subcategory | number \| null | 子分類 id |
| account | string \| null | 帳戶名稱，如「信用卡-中信」「現金」 |

新增 index：`subcategory`

## 分類對應規則

1. 先建立所有大分類（kind_table → expense，in_kind_table → income）
2. 再建立所有子分類，設定 parentId 指向對應大分類
3. 建立 CWMoney id → MoneyMan id 的映射表
4. 匯入交易時用映射表填入 category + subcategory

重複處理：
- 若已存在同名 + 同 type 的大分類，不重複建立，直接複用
- 若已存在同名 + 同 parentId 的子分類，直接複用

CWMoney 匯入的分類 color 和 icon 使用預設值（可後續手動調整）。

## 匯入 UI 流程

入口：SettingsView（設定頁）新增「匯入 CWMoney 資料」區塊。

### 步驟 1：選擇檔案

- `<input type="file" accept=".iDB,.idb">`
- 用 sql.js（WebAssembly SQLite）在瀏覽器端解析
- sql.js 透過動態 `import()` 載入，不影響其他頁面

### 步驟 2：選擇日期區間

- 自動偵測 rec_table 的 MIN/MAX 日期，顯示總範圍
- 用兩個 `<input type="date">` 讓用戶選擇匯入起訖日期
- 即時顯示該區間筆數

### 步驟 3：預覽資料

- 顯示該區間最早 10 筆 + 最晚 10 筆
- 每筆顯示：日期、類型、大分類/子分類、金額、帳戶
- 中間顯示省略筆數
- 統計：總筆數（支出 N / 收入 M）、預估重複筆數
- 提供「返回調整」和「確認匯入」按鈕

### 步驟 4：匯入執行

1. 建立分類（大分類 → 子分類，跳過已存在的）
2. 逐筆匯入交易（跳過重複）
3. 顯示進度條
4. 完成後顯示結果摘要：「匯入完成：新增 X 筆，跳過 Y 筆重複」

### 重複判斷

同日期 + 同金額 + 同分類（category + subcategory）視為重複，跳過不匯入。

## 受影響的現有頁面

### AddView（新增交易）

- 分類選單改為兩級聯動：先選大分類（依 type 篩選），再選子分類
- 子分類預設選中第一個（非 null）
- 若大分類下無子分類，subcategory = null
- 新增帳戶（account）欄位，預設「現金」

### ReportView（月報表）

- PieChart 按大分類分組（維持現有行為）
- 點擊展開子分類明細可後續再做

### SettingsView（設定頁）

- 分類管理改為樹狀顯示（大分類下顯示子分類）
- 新增/編輯分類時要選 type 和 parentId
- 新增「匯入 CWMoney」區塊

### ReconcileView（對帳）

- 分類顯示改為「大分類/子分類」格式

### Pinia Stores

- **categoriesStore**：新增 `getByType(type)`, `getChildren(parentId)` getter；`init()` 處理 migration
- **transactionsStore**：`getCategoryBreakdown` 改用大分類分組

### Google Drive 備份

- 匯出格式自動包含新欄位（parentId, type, subcategory, account）
- bulkRestore 不需特別改動

## 不需修改

- HomeView（只顯示總額）
- CardProgress / CardRecommend（不涉及分類層級）
- PDF 解析器（parsers/）
- reconcile.js（比對不依賴分類）

## 新增檔案

- `src/services/cwmoney-parser.js` — CWMoney .iDB 解析與轉換
- `src/components/ImportCWMoney.vue` — 匯入 UI 元件

## 新增依賴

- `sql.js` — WebAssembly SQLite，動態載入（僅匯入時使用）

## 技術決策摘要

| 決策 | 選擇 | 理由 |
|------|------|------|
| SQLite 解析 | sql.js（瀏覽器端） | 不需後端，符合 PWA 架構 |
| 分類層級 | 單表自引用 parentId | 比雙表更簡潔 |
| 分類 type | categories 加 type 欄位 | 收入/支出分類分開管理 |
| 交易分類欄位 | category + subcategory 兩欄位 | 查詢直覺，不需額外 lookup |
| sql.js 載入 | 動態 import() | 不影響其他頁面載入速度 |
