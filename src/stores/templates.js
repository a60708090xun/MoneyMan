import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref([])

  async function init() {
    const all = await getRecords('templates')
    templates.value = all.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async function addTemplate(tpl) {
    const maxOrder = templates.value.length > 0
      ? Math.max(...templates.value.map(t => t.sortOrder))
      : -1
    const record = { ...tpl, sortOrder: maxOrder + 1 }
    const id = await addRecord('templates', record)
    templates.value.push({ ...record, id })
  }

  async function editTemplate(tpl) {
    await updateRecord('templates', tpl)
    const idx = templates.value.findIndex(t => t.id === tpl.id)
    if (idx !== -1) templates.value[idx] = { ...tpl }
  }

  async function deleteTemplate(id) {
    await deleteRecord('templates', id)
    templates.value = templates.value.filter(t => t.id !== id)
  }

  async function reorder(fromIndex, toIndex) {
    const item = templates.value.splice(fromIndex, 1)[0]
    templates.value.splice(toIndex, 0, item)
    // Reassign sortOrder to match new positions
    for (let i = 0; i < templates.value.length; i++) {
      const plain = { ...templates.value[i], sortOrder: i }
      await updateRecord('templates', plain)
      templates.value[i] = plain
    }
  }

  return { templates, init, addTemplate, editTemplate, deleteTemplate, reorder }
})
