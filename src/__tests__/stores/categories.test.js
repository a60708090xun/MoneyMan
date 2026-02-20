import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCategoriesStore } from '../../stores/categories.js'
import { clearStore } from '../../services/db.js'

describe('categories store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('categories')
  })

  it('loads default categories', async () => {
    const store = useCategoriesStore()
    await store.init()
    expect(store.categories.length).toBeGreaterThanOrEqual(7)
    expect(store.categories.map(c => c.name)).toContain('飲食')
  })

  it('adds a custom category', async () => {
    const store = useCategoriesStore()
    await store.init()
    const before = store.categories.length
    await store.addCategory({ name: '寵物', color: '#FF9800', icon: '🐕' })
    expect(store.categories.length).toBe(before + 1)
  })

  it('deletes a category', async () => {
    const store = useCategoriesStore()
    await store.init()
    const before = store.categories.length
    const catId = store.categories[0].id
    await store.deleteCategory(catId)
    expect(store.categories.length).toBe(before - 1)
  })
})
