import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCardsStore } from '../../stores/cards.js'
import { clearStore } from '../../services/db.js'

describe('cards store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('cards')
  })

  it('adds a card', async () => {
    const store = useCardsStore()
    await store.init()
    await store.addCard({
      id: 'test-card',
      name: '測試卡',
      bank: '測試銀行',
      billingCycleDay: 15,
      thresholds: [],
      channelRules: [
        { channel: '一般', rate: 0.01, monthlyCap: null }
      ]
    })
    expect(store.cards).toHaveLength(1)
    expect(store.cards[0].name).toBe('測試卡')
  })

  it('deletes a card', async () => {
    const store = useCardsStore()
    await store.init()
    await store.addCard({ id: 'to-delete', name: '刪除測試', bank: 'X', billingCycleDay: 1, thresholds: [], channelRules: [] })
    await store.deleteCard('to-delete')
    expect(store.cards).toHaveLength(0)
  })
})
