/**
 * Recommends which credit card to use for a purchase.
 *
 * @param {Object} opts
 * @param {Array} opts.cards - Array of card objects with channelRules and thresholds
 * @param {string} opts.channel - Purchase channel (e.g. '網購', '超商')
 * @param {number} opts.amount - Purchase amount
 * @param {Object} opts.currentSpending - { cardId: totalSpent } for current billing cycle
 * @param {Object} opts.currentChannelSpending - { cardId: { channel: rewardEarned } }
 * @param {Date} opts.today - Current date
 * @returns {Array} Sorted recommendations, best first
 */
export function recommendCard({ cards, channel, amount, currentSpending, currentChannelSpending, today }) {
  const recommendations = cards.map(card => {
    const rule = card.channelRules.find(r => r.channel === channel)
      || card.channelRules.find(r => r.channel === '一般')

    if (!rule) return null

    const rate = rule.rate
    const rawReward = amount * rate

    // Check monthly cap
    const earnedSoFar = (currentChannelSpending[card.id] || {})[rule.channel] || 0
    const capRemaining = rule.monthlyCap != null ? Math.max(0, rule.monthlyCap - earnedSoFar) : Infinity
    const effectiveReward = Math.min(rawReward, capRemaining)

    // Threshold bonus
    const spent = currentSpending[card.id] || 0
    let thresholdBonus = 0
    let thresholdGap = Infinity
    for (const t of card.thresholds) {
      const gap = t.amount - spent
      if (gap > 0 && gap <= amount) {
        thresholdBonus += t.rewardValue
        thresholdGap = Math.min(thresholdGap, gap)
      }
    }

    // Days remaining in billing cycle
    const cycleDay = card.billingCycleDay
    const todayDay = today.getDate()
    const daysRemaining = cycleDay > todayDay
      ? cycleDay - todayDay
      : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - todayDay + cycleDay

    // Score: effective reward + threshold bonus, penalized if cap nearly full
    const totalReward = effectiveReward + thresholdBonus
    const capRatio = rule.monthlyCap != null ? capRemaining / rule.monthlyCap : 1
    const score = totalReward * (0.5 + 0.5 * capRatio)

    return {
      cardId: card.id,
      cardName: card.name,
      channel: rule.channel,
      rate,
      estimatedReward: effectiveReward,
      thresholdBonus,
      thresholdGap: thresholdGap === Infinity ? null : thresholdGap,
      currentSpent: spent,
      daysRemaining,
      score
    }
  }).filter(Boolean)

  return recommendations.sort((a, b) => b.score - a.score)
}
