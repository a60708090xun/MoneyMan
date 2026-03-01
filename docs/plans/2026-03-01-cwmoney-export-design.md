# CWMoney .iDB 匯出功能設計

## 概述

讓 MoneyMan 能將資料匯出為 CWMoney 可讀的 .iDB（SQLite）檔案，支援兩種模式：

1. **編輯回寫**：從 CWMoney 匯入 → MoneyMan 修改 → 產生修改後 .iDB → 匯回 CWMoney
2. **全新匯出**：MoneyMan 資料 → CWMoney .iDB 格式

MoneyMan 定位為 CWMoney 的輔助工具，主要利用對帳、信用卡推薦等功能處理資料後，再匯回 CWMoney。

## 設計決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| 追蹤方式 | 完整追蹤模式（方案 A） | 精確回寫、自動保存原始 .iDB |
| 覆蓋策略 | 全量替換 | 使用者需求，最直觀 |
| 未知欄位/表格 | 保留不動 | 避免破壞 CWMoney 其他功能的資料 |
| 可修改欄位 | 金額、日期、分類、子分類、帳戶、備註 | 目前已解析的欄位 |
| 刪除行為 | MoneyMan 中已刪除的交易，回寫時從 .iDB 移除 | 使用者需求 |
| 匯出方式 | 下載 .iDB 及上傳 Google Drive 兩個按鈕並存 | 使用者自行選擇 |

## 資料層變更

### IndexedDB 升級到 v4

新增 `cwmoney_meta` object store：

```
cwmoney_meta store (keyPath: 'key')
├── key: 'original_idb'      → value: Uint8Array (原始 .iDB 二進位)
├── key: 'category_mapping'   → value: { 'expense_parent_3': 12, ... } (CW ID → MoneyMan ID)
├── key: 'account_mapping'    → value: { 1: '現金', 2: '銀行', ... } (CW 帳戶 ID → 名稱)
└── key: 'import_info'        → value: { importedAt, fileName, dateRange }
```

### Transaction 新增 `cwId` 欄位

```js
{
  id: 1,              // MoneyMan auto-increment ID
  cwId: 42,           // CWMoney rec_table._id（匯入時設定，手動新增的為 null）
  amount: 150,
  type: 'expense',
  category: 3,
  subcategory: 7,
  date: '2026-02-28',
  note: '午餐',
  account: '現金',
  channel: null,
  cardId: null
}
```

在 transactions store 新增 `cwId` index。

### bulkRestore 更新

Google Drive 備份/還原需包含 `cwmoney_meta` store。

## 匯出引擎

### 新增 `src/services/cwmoney-exporter.js`

#### 模式 A：編輯回寫（有原始 .iDB）

1. 從 `cwmoney_meta` 載入原始 .iDB binary
2. 用 sql.js 開啟為 SQLite DB
3. 從 `cwmoney_meta` 載入分類映射表，反轉為 MoneyMan ID → CW ID
4. 遍歷原始 .iDB 的 rec_table：
   - `cwId` 在 MoneyMan 中存在 → `UPDATE`（回寫修改）
   - `cwId` 在 MoneyMan 中不存在 → `DELETE`（從 .iDB 移除）
5. 遍歷 MoneyMan transactions：
   - 無 `cwId` → `INSERT`（新增到 .iDB）
6. 同步新增的分類到對應的 CWMoney 分類表
7. 匯出修改後的 SQLite DB 為 .iDB 檔案

#### 模式 B：全新匯出（沒有原始 .iDB）

1. 用 sql.js 建立空白 SQLite DB
2. `CREATE TABLE` rec_table、kind_table、kinds_table、in_kind_table、in_kinds_table、acc_table
3. 將 MoneyMan 分類寫入對應的分類表
4. 將 MoneyMan transactions 寫入 rec_table
5. 匯出為 .iDB 檔案

### 欄位映射（MoneyMan → CWMoney）

| MoneyMan | CWMoney rec_table | 轉換 |
|----------|-------------------|------|
| `amount` | `i_money` | 直接對應 |
| `date` | `i_date` | YYYY-MM-DD → Unix timestamp |
| `category` | `i_kind` | 反向映射表 → CW parent ID |
| `subcategory` | `i_kinds` | 反向映射表 → CW child ID |
| `account` | `i_account` | 帳戶映射表 → CW account ID |
| `note` | `i_remark` | 直接對應 |
| `type` | `i_type` | 'income' → '2', 'expense' → '1' |

## UI 設計

### 入口：SettingsView

在 CWMoney 區塊，現有「匯入」下方新增「匯出」：

```
┌─ CWMoney ──────────────────────────┐
│  [▼ 從 CWMoney 匯入]               │  ← 現有
│  [▼ 匯出為 CWMoney .iDB]           │  ← 新增
└─────────────────────────────────────┘
```

### ExportCWMoney.vue 匯出精靈

#### 編輯回寫模式（有原始 .iDB）

```
Step 1: 摘要
┌─────────────────────────────────────┐
│  原始檔案：mymoney.iDB              │
│  匯入時間：2026-02-15               │
│  原始筆數：1,234 筆                  │
│                                     │
│  MoneyMan 變更：                     │
│    修改 23 筆 │ 新增 5 筆 │ 刪除 2 筆 │
│                                     │
│  [匯出 .iDB]          [取消]        │
└─────────────────────────────────────┘

Step 2: 匯出中（進度條）

Step 3: 完成
┌─────────────────────────────────────┐
│  匯出完成！                          │
│  更新 23 筆 / 新增 5 筆 / 刪除 2 筆  │
│                                     │
│  [下載 .iDB]   [上傳到 Google Drive] │
│                                     │
│  [完成]                              │
└─────────────────────────────────────┘
```

#### 全新匯出模式（沒有原始 .iDB）

```
Step 1: 設定
┌─────────────────────────────────────┐
│  MoneyMan 目前共 456 筆交易          │
│                                     │
│  匯出範圍：                          │
│  [2026-01-01] ～ [2026-02-28]       │
│                                     │
│  此區間共 120 筆                     │
│                                     │
│  [匯出 .iDB]          [取消]        │
└─────────────────────────────────────┘

Step 2: 匯出中（進度條）

Step 3: 完成
┌─────────────────────────────────────┐
│  匯出完成！                          │
│  共匯出 120 筆交易、15 個分類        │
│  檔案已下載：moneyman-export.iDB    │
│                                     │
│  [下載 .iDB]   [上傳到 Google Drive] │
│                                     │
│  [完成]                              │
└─────────────────────────────────────┘
```

### 檔案下載方式

瀏覽器標準 `Blob` + `URL.createObjectURL` + `<a download>` 觸發下載。

### Google Drive 上傳

使用現有 `gdrive.js` 的 OAuth 整合，檔名 `moneyman-cwmoney-export.iDB`，與 `moneyman-backup.json` 分開。

## 影響範圍

| 檔案 | 變更類型 |
|------|---------|
| `src/services/db.js` | 修改：DB v4 升級，新增 `cwmoney_meta` store、`cwId` index |
| `src/services/cwmoney-parser.js` | 修改：`mapRow` 加回傳 `cwId` |
| `src/services/cwmoney-exporter.js` | **新增**：匯出引擎核心邏輯 |
| `src/services/gdrive.js` | 修改：備份/還原納入 `cwmoney_meta` |
| `src/components/ImportCWMoney.vue` | 修改：存 `cwId`、原始 .iDB、映射表 |
| `src/components/ExportCWMoney.vue` | **新增**：匯出精靈 UI |
| `src/views/SettingsView.vue` | 修改：加入匯出區塊 |

## 邊界情況

| 情況 | 處理方式 |
|------|---------|
| 匯入後又重新匯入另一個 .iDB | 覆蓋 `cwmoney_meta`，舊 cwId 交易不受影響但失去回寫能力 |
| 混合有 cwId 和無 cwId 的交易 | 回寫時：有 cwId → UPDATE，無 cwId → INSERT，正常共存 |
| MoneyMan 新建的分類匯出 | INSERT 到對應的 CWMoney 分類表 |
| 原始 .iDB 損壞 | 匯出前驗證 SQLite 完整性，失敗時提示使用者 |
| 全新匯出不知完整 schema | 只建立已知必要表格 |

## 不做的事

- 不做雙向即時同步
- 不修改 CWMoney 的照片、定位、週期交易等未知欄位
- 不處理多次匯入的合併衝突
