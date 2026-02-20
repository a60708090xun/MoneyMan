import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useReconcileStore = defineStore('reconcile', () => {
  const parsedBillItems = ref([])
  const results = ref(null)
  const dateStart = ref('')
  const dateEnd = ref('')

  function setResults(newResults) {
    results.value = newResults
  }

  function setParsedBillItems(items) {
    parsedBillItems.value = items
  }

  function setDateRange(start, end) {
    dateStart.value = start
    dateEnd.value = end
  }

  function reset() {
    parsedBillItems.value = []
    results.value = null
  }

  return { parsedBillItems, results, dateStart, dateEnd, setResults, setParsedBillItems, setDateRange, reset }
})
