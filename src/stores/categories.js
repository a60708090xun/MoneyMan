import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'

const DEFAULT_CATEGORIES = [
  { name: '飲食', color: '#F44336', icon: '🍔', type: 'expense', parentId: null },
  { name: '交通', color: '#2196F3', icon: '🚗', type: 'expense', parentId: null },
  { name: '娛樂', color: '#9C27B0', icon: '🎮', type: 'expense', parentId: null },
  { name: '購物', color: '#FF9800', icon: '🛍️', type: 'expense', parentId: null },
  { name: '居家', color: '#795548', icon: '🏠', type: 'expense', parentId: null },
  { name: '醫療', color: '#E91E63', icon: '💊', type: 'expense', parentId: null },
  { name: '教育', color: '#3F51B5', icon: '📚', type: 'expense', parentId: null }
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
    return id
  }

  async function editCategory(cat) {
    await updateRecord('categories', cat)
    const idx = categories.value.findIndex(c => c.id === cat.id)
    if (idx !== -1) categories.value[idx] = { ...cat }
  }

  async function deleteCategory(id) {
    await deleteRecord('categories', id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  function getByType(type) {
    return categories.value.filter(c => c.type === type)
  }

  function getParents(type) {
    return categories.value.filter(c => c.parentId === null && c.type === type)
  }

  function getChildren(parentId) {
    return categories.value.filter(c => c.parentId === parentId)
  }

  function getCategoryName(id) {
    const cat = categories.value.find(c => c.id === id)
    return cat ? cat.name : ''
  }

  function getFullCategoryName(categoryId, subcategoryId) {
    const parent = getCategoryName(categoryId)
    if (!subcategoryId) return parent
    const sub = getCategoryName(subcategoryId)
    return `${parent}/${sub}`
  }

  return {
    categories,
    init,
    addCategory,
    editCategory,
    deleteCategory,
    getByType,
    getParents,
    getChildren,
    getCategoryName,
    getFullCategoryName
  }
})
