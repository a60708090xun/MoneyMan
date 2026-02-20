import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCategoriesStore } from '../../stores/categories.js'
import { clearStore } from '../../services/db.js'

describe('categories store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('categories')
  })

  it('loads default categories with type and parentId', async () => {
    const store = useCategoriesStore()
    await store.init()
    expect(store.categories.length).toBeGreaterThanOrEqual(7)
    expect(store.categories[0].type).toBe('expense')
    expect(store.categories[0].parentId).toBeNull()
  })

  it('adds a custom category and returns id', async () => {
    const store = useCategoriesStore()
    await store.init()
    const before = store.categories.length
    const id = await store.addCategory({ name: '寵物', color: '#FF9800', icon: '🐕', type: 'expense', parentId: null })
    expect(store.categories.length).toBe(before + 1)
    expect(typeof id).toBe('number')
  })

  it('deletes a category', async () => {
    const store = useCategoriesStore()
    await store.init()
    const before = store.categories.length
    const catId = store.categories[0].id
    await store.deleteCategory(catId)
    expect(store.categories.length).toBe(before - 1)
  })

  it('getByType filters by income/expense', async () => {
    const store = useCategoriesStore()
    await store.init()
    await store.addCategory({ name: '薪資', color: '#4CAF50', icon: '💰', type: 'income', parentId: null })
    expect(store.getByType('expense').length).toBeGreaterThanOrEqual(7)
    expect(store.getByType('income').length).toBe(1)
  })

  it('getChildren returns sub-categories by parentId', async () => {
    const store = useCategoriesStore()
    await store.init()
    const parentId = store.categories[0].id // 飲食
    await store.addCategory({ name: '早餐', color: '#FF5722', icon: '🍳', type: 'expense', parentId })
    await store.addCategory({ name: '午餐', color: '#FF9800', icon: '🍱', type: 'expense', parentId })
    expect(store.getChildren(parentId).length).toBe(2)
    expect(store.getChildren(parentId)[0].name).toBe('早餐')
  })

  it('getParents returns only top-level categories', async () => {
    const store = useCategoriesStore()
    await store.init()
    const parentId = store.categories[0].id
    await store.addCategory({ name: '早餐', color: '#FF5722', icon: '🍳', type: 'expense', parentId })
    const parents = store.getParents('expense')
    expect(parents.every(c => c.parentId === null)).toBe(true)
  })

  it('getCategoryName returns name by id', async () => {
    const store = useCategoriesStore()
    await store.init()
    const cat = store.categories[0]
    expect(store.getCategoryName(cat.id)).toBe(cat.name)
  })

  it('getFullCategoryName returns parent/sub format', async () => {
    const store = useCategoriesStore()
    await store.init()
    const parentId = store.categories[0].id
    await store.addCategory({ name: '早餐', color: '#FF5722', icon: '🍳', type: 'expense', parentId })
    const sub = store.categories.find(c => c.name === '早餐')
    expect(store.getFullCategoryName(parentId, sub.id)).toBe('飲食/早餐')
    expect(store.getFullCategoryName(parentId, null)).toBe('飲食')
  })
})
