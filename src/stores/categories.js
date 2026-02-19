import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, deleteRecord } from '../services/db.js'

const DEFAULT_CATEGORIES = [
  { name: '飲食', color: '#F44336', icon: '🍔' },
  { name: '交通', color: '#2196F3', icon: '🚗' },
  { name: '娛樂', color: '#9C27B0', icon: '🎮' },
  { name: '購物', color: '#FF9800', icon: '🛍️' },
  { name: '居家', color: '#795548', icon: '🏠' },
  { name: '醫療', color: '#E91E63', icon: '💊' },
  { name: '教育', color: '#3F51B5', icon: '📚' }
]

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref([])

  async function init() {
    const stored = await getRecords('categories')
    if (stored.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await addRecord('categories', cat)
      }
      categories.value = await getRecords('categories')
    } else {
      categories.value = stored
    }
  }

  async function addCategory(cat) {
    const id = await addRecord('categories', cat)
    categories.value.push({ ...cat, id })
  }

  async function deleteCategory(id) {
    await deleteRecord('categories', id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  return { categories, init, addCategory, deleteCategory }
})
