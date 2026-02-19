<template>
  <div v-if="recommendations.length" class="card-recommend">
    <h4>刷卡推薦</h4>
    <div class="rec-form">
      <select v-model="channel">
        <option value="一般">一般</option>
        <option value="網購">網購</option>
        <option value="超商">超商</option>
        <option value="餐飲">餐飲</option>
        <option value="交通">交通</option>
      </select>
      <input type="number" v-model.number="amount" placeholder="金額" style="width: 100px;" />
    </div>
    <div v-for="rec in recommendations" :key="rec.cardId" class="rec-item">
      <div class="rec-header">
        <span class="rec-name">{{ rec.cardName }}</span>
        <span class="rec-rate">{{ (rec.rate * 100).toFixed(1) }}%</span>
      </div>
      <div class="rec-detail">
        預估回饋 ${{ rec.estimatedReward.toFixed(0) }}
        <span v-if="rec.thresholdBonus"> + 門檻獎勵 ${{ rec.thresholdBonus }}</span>
        <span v-if="rec.thresholdGap"> （差 ${{ rec.thresholdGap.toLocaleString() }} 達標）</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { recommendCard } from '../services/recommend.js'

const props = defineProps({
  cards: Array,
  transactions: Array
})

const channel = ref('一般')
const amount = ref(1000)

const recommendations = computed(() => {
  if (!props.cards?.length || !amount.value) return []

  const today = new Date()
  const currentSpending = {}
  const currentChannelSpending = {}

  for (const card of props.cards) {
    const cardTxs = props.transactions.filter(t => t.cardId === card.id && t.type === 'expense')
    currentSpending[card.id] = cardTxs.reduce((s, t) => s + t.amount, 0)
    currentChannelSpending[card.id] = {}
    for (const t of cardTxs) {
      const ch = t.channel || '一般'
      currentChannelSpending[card.id][ch] = (currentChannelSpending[card.id][ch] || 0) + (t.amount * getRate(card, ch))
    }
  }

  return recommendCard({
    cards: props.cards.filter(c => c.channelRules?.length > 0),
    channel: channel.value,
    amount: amount.value,
    currentSpending,
    currentChannelSpending,
    today
  })
})

function getRate(card, channel) {
  const rule = card.channelRules?.find(r => r.channel === channel)
    || card.channelRules?.find(r => r.channel === '一般')
  return rule?.rate || 0
}
</script>

<style scoped>
.card-recommend { background: #FFF8E1; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
.card-recommend h4 { margin-bottom: 8px; }
.rec-form { display: flex; gap: 8px; margin-bottom: 8px; }
.rec-form select, .rec-form input { padding: 6px; border: 1px solid #ddd; border-radius: 4px; }
.rec-item { background: white; border-radius: 8px; padding: 8px; margin-bottom: 4px; }
.rec-header { display: flex; justify-content: space-between; font-weight: 500; }
.rec-rate { color: #4CAF50; }
.rec-detail { font-size: 12px; color: #666; margin-top: 2px; }
</style>
