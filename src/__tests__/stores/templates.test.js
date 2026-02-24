import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTemplatesStore } from '../../stores/templates.js'
import { clearStore } from '../../services/db.js'

describe('templates store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await clearStore('templates')
  })

  it('starts empty', async () => {
    const store = useTemplatesStore()
    await store.init()
    expect(store.templates).toHaveLength(0)
  })

  it('adds a template with auto sortOrder', async () => {
    const store = useTemplatesStore()
    await store.init()
    await store.addTemplate({
      name: '早餐',
      type: 'expense',
      category: 1,
      subcategory: null,
      channel: '一般',
      cardId: null,
      account: '現金',
      note: ''
    })
    expect(store.templates).toHaveLength(1)
    expect(store.templates[0].name).toBe('早餐')
    expect(store.templates[0].sortOrder).toBe(0)
  })

  it('assigns incrementing sortOrder', async () => {
    const store = useTemplatesStore()
    await store.init()
    await store.addTemplate({ name: 'A', type: 'expense', category: 1, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    await store.addTemplate({ name: 'B', type: 'expense', category: 2, subcategory: null, channel: '網購', cardId: null, account: '現金', note: '' })
    expect(store.templates[0].sortOrder).toBe(0)
    expect(store.templates[1].sortOrder).toBe(1)
  })

  it('edits a template', async () => {
    const store = useTemplatesStore()
    await store.init()
    await store.addTemplate({ name: '早餐', type: 'expense', category: 1, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    const tpl = store.templates[0]
    await store.editTemplate({ ...tpl, name: '午餐' })
    expect(store.templates[0].name).toBe('午餐')
  })

  it('deletes a template', async () => {
    const store = useTemplatesStore()
    await store.init()
    await store.addTemplate({ name: '刪除測試', type: 'expense', category: 1, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    const id = store.templates[0].id
    await store.deleteTemplate(id)
    expect(store.templates).toHaveLength(0)
  })
})
