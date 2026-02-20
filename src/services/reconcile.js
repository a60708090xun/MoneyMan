/**
 * Reconcile bill items against manual records.
 *
 * @param {Array} billItems - [{date, merchant, amount}]
 * @param {Array} manualRecords - [{id, date, amount, category, note}]
 * @returns {Array} Reconciliation results
 */
export function reconcile(billItems, manualRecords) {
  const results = []
  const usedManualIds = new Set()

  // Match bill items to manual records
  for (const bill of billItems) {
    // Exact match: same date + same amount
    let match = manualRecords.find(
      m => !usedManualIds.has(m.id) && m.date === bill.date && m.amount === bill.amount
    )

    if (match) {
      usedManualIds.add(match.id)
      results.push({ status: 'matched', billItem: bill, manualRecord: match })
      continue
    }

    // Amount mismatch: same date, close amount
    match = manualRecords.find(
      m => !usedManualIds.has(m.id) && m.date === bill.date && Math.abs(m.amount - bill.amount) <= Math.max(bill.amount * 0.05, 10)
    )

    if (match) {
      usedManualIds.add(match.id)
      results.push({
        status: 'amount_mismatch',
        billItem: bill,
        manualRecord: match,
        diff: Math.abs(bill.amount - match.amount)
      })
      continue
    }

    // Bill only
    results.push({ status: 'bill_only', billItem: bill, manualRecord: null })
  }

  // Manual only (not matched to any bill item)
  for (const manual of manualRecords) {
    if (!usedManualIds.has(manual.id)) {
      results.push({ status: 'manual_only', billItem: null, manualRecord: manual })
    }
  }

  return results
}