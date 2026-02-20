import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRecords, addRecord, updateRecord, deleteRecord } from '../services/db.js'

export const useCardsStore = defineStore('cards', () => {
  const cards = ref([])

  async function init() {
    cards.value = await getRecords('cards')
  }

  async function addCard(card) {
    const newCard = { ...card }
    if (!newCard.id) {
      newCard.id = crypto.randomUUID()
    }
    await addRecord('cards', newCard)
    cards.value.push(newCard)
  }

  async function editCard(card) {
    await updateRecord('cards', card)
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx] = card
  }

  async function deleteCard(id) {
    await deleteRecord('cards', id)
    cards.value = cards.value.filter(c => c.id !== id)
  }

  return { cards, init, addCard, editCard, deleteCard }
})
