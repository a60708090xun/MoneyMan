import { describe, it, expect } from 'vitest'
import { recommendCard } from '../../services/recommend.js'

const mockCards = [
  {
    id: 'card-a',
    name: '卡片A',
    billingCycleDay: 15,
    thresholds: [{ amount: 10000, rewardValue: 500 }],
    channelRules: [
      { channel: '網購', rate: 0.03, monthlyCap: 300 },
      { channel: '一般', rate: 0.01, monthlyCap: null }
    ]
  },
  {
    id: 'card-b',
    name: '卡片B',
    billingCycleDay: 20,
    thresholds: [{ amount: 8000, rewardValue: 200 }],
    channelRules: [
      { channel: '網購', rate: 0.05, monthlyCap: 100 },
      { channel: '一般', rate: 0.02, monthlyCap: null }
    ]
  }
]

describe('recommend engine', () => {
  it('ranks by channel reward rate when no cap is reached', () => {
    const spending = { 'card-a': 0, 'card-b': 0 }
    const channelSpending = { 'card-a': {}, 'card-b': {} }
    const result = recommendCard({
      cards: mockCards,
      channel: '網購',
      amount: 1000,
      currentSpending: spending,
      currentChannelSpending: channelSpending,
      today: new Date('2026-02-01')
    })
    // card-b has 5% for 網購 vs card-a 3%
    expect(result[0].cardId).toBe('card-b')
  })

  it('deprioritizes card when monthly cap is reached', () => {
    const spending = { 'card-a': 0, 'card-b': 0 }
    const channelSpending = {
      'card-a': { '網購': 0 },
      'card-b': { '網購': 95 } // cap is 100, only $5 reward left
    }
    const result = recommendCard({
      cards: mockCards,
      channel: '網購',
      amount: 1000,
      currentSpending: spending,
      currentChannelSpending: channelSpending,
      today: new Date('2026-02-01')
    })
    // card-b cap almost full, card-a should rank higher
    expect(result[0].cardId).toBe('card-a')
  })

  it('boosts cards close to threshold', () => {
    const spending = { 'card-a': 9500, 'card-b': 2000 }
    const channelSpending = { 'card-a': {}, 'card-b': {} }
    const result = recommendCard({
      cards: mockCards,
      channel: '一般',
      amount: 500,
      currentSpending: spending,
      currentChannelSpending: channelSpending,
      today: new Date('2026-02-01')
    })
    // card-a is $500 from 10000 threshold (gets $500 bonus)
    expect(result[0].cardId).toBe('card-a')
  })
})
