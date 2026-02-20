---
name: fetch-card-rewards
description: 抓取信用卡回饋資訊，更新 MoneyMan 卡片回饋設定
user_invocable: true
---

# fetch-card-rewards

抓取銀行信用卡優惠頁面，自動更新 MoneyMan 的卡片回饋設定。

## 使用方式

在 Claude Code 中執行 `/fetch-card-rewards`，或手動提供銀行信用卡優惠頁面的 URL。

## 流程

1. 向使用者詢問要更新哪些信用卡（或全部更新）
2. 使用 WebFetch 工具抓取使用者提供的銀行信用卡優惠頁面
3. 從頁面內容中擷取以下資訊：
   - 通路別回饋率（網購、超商、餐飲、交通、一般等）
   - 每月回饋上限
   - 總消費門檻與額外回饋
   - 結算日
4. 更新 MoneyMan 中對應卡片的 store 資料

## 卡片資料格式

每張信用卡的回饋規則格式如下：

```json
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
      "channel": "一般",
      "rate": 0.01,
      "monthlyCap": null
    }
  ]
}
```

## 更新步驟

1. 讀取目前的卡片資料：使用 `src/stores/cards.js` 中的 cards store
2. 根據抓取到的資訊，生成更新後的卡片物件
3. 顯示變更差異給使用者確認
4. 使用者確認後，透過 cards store 的 `editCard()` 更新資料

## 通路對應

銀行頁面常見的通路名稱對應到 MoneyMan 的通路：

```
網路購物 / 線上消費 → 網購
超商 / 便利商店 → 超商
餐飲 / 美食 → 餐飲
交通 / 大眾運輸 → 交通
其他 / 國內一般消費 → 一般
```

## 注意事項

- 回饋率以小數表示（例如 3% → 0.03）
- 回饋上限以新台幣金額表示
- 門檻金額為累計消費金額
- 如果無法取得某項資訊，保留原有設定不覆蓋
- 建議每月執行一次，銀行回饋規則通常按月更新
