# Transaction Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reusable transaction templates that auto-fill the AddView form, with management UI in SettingsView and Google Drive backup integration.

**Architecture:** New `templates` IndexedDB object store (DB v3), a `useTemplatesStore` Pinia store following the same CRUD pattern as `cards.js`, template selector UI in AddView, and template management section in SettingsView.

**Tech Stack:** Vue 3 (Composition API), Pinia, IndexedDB via `idb`, Vitest + fake-indexeddb

---

### Task 1: DB v3 — Add `templates` Object Store

**Files:**
- Modify: `src/services/db.js:3` (DB_VERSION), `src/services/db.js:17-49` (upgrade function)
- Test: `src/__tests__/services/db.test.js`

**Step 1: Write the failing test**

Add to `src/__tests__/services/db.test.js`:

```javascript
describe('db v3 schema', () => {
  beforeEach(async () => {
    resetDB()
  })

  it('has templates object store', async () => {
    const db = await initDB()
    expect(db.objectStoreNames.contains('templates')).toBe(true)
  })

  it('templates store supports auto-increment id', async () => {
    const id = await addRecord('templates', {
      name: '早餐',
      type: 'expense',
      category: 1,
      subcategory: null,
      channel: '一般',
      cardId: null,
      account: '現金',
      note: '',
      sortOrder: 0
    })
    expect(typeof id).toBe('number')
    const records = await getRecords('templates')
    expect(records).toHaveLength(1)
    expect(records[0].name).toBe('早餐')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: FAIL — `templates` store does not exist

**Step 3: Write minimal implementation**

In `src/services/db.js`:

1. Change `DB_VERSION` from `2` to `3` (line 4)
2. In the `upgrade` function, add inside `if (oldVersion < 1)` block (after line 31):

```javascript
        db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true })
```

3. Add new upgrade block after the `oldVersion < 2` block (after line 47):

```javascript
      if (oldVersion >= 1 && oldVersion < 3) {
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true })
        }
      }
```

4. In `bulkRestore` (line 139), add `'templates'` to the transaction array and add restore logic:

```javascript
export async function bulkRestore(data) {
  const db = await initDB()
  const tx = db.transaction(['transactions', 'cards', 'categories', 'templates'], 'readwrite')
  await tx.objectStore('transactions').clear()
  await tx.objectStore('cards').clear()
  await tx.objectStore('categories').clear()
  await tx.objectStore('templates').clear()
  for (const item of data.transactions || []) await tx.objectStore('transactions').put(item)
  for (const card of data.cards || []) await tx.objectStore('cards').put(card)
  for (const cat of data.categories || []) await tx.objectStore('categories').put(cat)
  for (const tpl of data.templates || []) await tx.objectStore('templates').put(tpl)
  await tx.done
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/db.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/services/db.js src/__tests__/services/db.test.js
git commit -m "feat: add templates object store (DB v3)"
```

---

### Task 2: Templates Pinia Store — CRUD

**Files:**
- Create: `src/stores/templates.js`
- Test: `src/__tests__/stores/templates.test.js`

**Step 1: Write the failing tests**

Create `src/__tests__/stores/templates.test.js`:

```javascript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/templates.test.js`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/stores/templates.js`:

```javascript
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

  return { templates, init, addTemplate, editTemplate, deleteTemplate }
})
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/stores/templates.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/stores/templates.js src/__tests__/stores/templates.test.js
git commit -m "feat: add templates Pinia store with CRUD"
```

---

### Task 3: Templates Store — Reorder

**Files:**
- Modify: `src/stores/templates.js`
- Modify: `src/__tests__/stores/templates.test.js`

**Step 1: Write the failing test**

Add to `src/__tests__/stores/templates.test.js`:

```javascript
  it('reorders templates (move last to first)', async () => {
    const store = useTemplatesStore()
    await store.init()
    await store.addTemplate({ name: 'A', type: 'expense', category: 1, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    await store.addTemplate({ name: 'B', type: 'expense', category: 2, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    await store.addTemplate({ name: 'C', type: 'expense', category: 3, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })

    await store.reorder(2, 0) // move C from index 2 to index 0

    expect(store.templates.map(t => t.name)).toEqual(['C', 'A', 'B'])
  })

  it('reorders templates (move first to last)', async () => {
    const store = useTemplatesStore()
    await store.init()
    await store.addTemplate({ name: 'A', type: 'expense', category: 1, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    await store.addTemplate({ name: 'B', type: 'expense', category: 2, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    await store.addTemplate({ name: 'C', type: 'expense', category: 3, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })

    await store.reorder(0, 2) // move A from index 0 to index 2

    expect(store.templates.map(t => t.name)).toEqual(['B', 'C', 'A'])
  })

  it('persists reorder after reload', async () => {
    const store = useTemplatesStore()
    await store.init()
    await store.addTemplate({ name: 'A', type: 'expense', category: 1, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    await store.addTemplate({ name: 'B', type: 'expense', category: 2, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })
    await store.addTemplate({ name: 'C', type: 'expense', category: 3, subcategory: null, channel: '一般', cardId: null, account: '現金', note: '' })

    await store.reorder(2, 0)

    // Reload from DB
    await store.init()
    expect(store.templates.map(t => t.name)).toEqual(['C', 'A', 'B'])
  })
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/stores/templates.test.js`
Expected: FAIL — `store.reorder is not a function`

**Step 3: Write minimal implementation**

Add `reorder` method to `src/stores/templates.js` and export it:

```javascript
  async function reorder(fromIndex, toIndex) {
    const item = templates.value.splice(fromIndex, 1)[0]
    templates.value.splice(toIndex, 0, item)
    // Reassign sortOrder to match new positions
    for (let i = 0; i < templates.value.length; i++) {
      templates.value[i] = { ...templates.value[i], sortOrder: i }
      await updateRecord('templates', templates.value[i])
    }
  }

  return { templates, init, addTemplate, editTemplate, deleteTemplate, reorder }
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/stores/templates.test.js`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/stores/templates.js src/__tests__/stores/templates.test.js
git commit -m "feat: add reorder support to templates store"
```

---

### Task 4: AddView — Template Selector & Save-as-Template

**Files:**
- Modify: `src/views/AddView.vue`

**Step 1: Add template store import and init**

In `<script setup>` section, add after line 92 (`import { useCardsStore }`):

```javascript
import { useTemplatesStore } from '../stores/templates.js'
```

Add after line 99 (`const cardsStore = useCardsStore()`):

```javascript
const templatesStore = useTemplatesStore()
```

In `onMounted` (line 136), add after `await cardsStore.init()`:

```javascript
  await templatesStore.init()
```

**Step 2: Add template selector UI**

Add after the `<h2>` tag (line 3) and before the type-toggle div (line 5):

```html
    <div v-if="templatesStore.templates.length" class="template-selector">
      <label>快速填入</label>
      <div class="template-scroll">
        <button
          v-for="tpl in templatesStore.templates"
          :key="tpl.id"
          class="template-btn"
          @click="applyTemplate(tpl)"
        >
          {{ getCategoryIcon(tpl.category) }} {{ tpl.name }}
        </button>
      </div>
    </div>
```

**Step 3: Add applyTemplate and getCategoryIcon functions**

Add in `<script setup>`:

```javascript
function getCategoryIcon(categoryId) {
  const cat = categoriesStore.categories.find(c => c.id === categoryId)
  return cat ? cat.icon : '📌'
}

function applyTemplate(tpl) {
  form.type = tpl.type
  form.category = tpl.category
  form.subcategory = tpl.subcategory
  form.channel = tpl.channel
  form.cardId = tpl.cardId
  form.account = tpl.account
  form.note = tpl.note
}
```

**Step 4: Add save-as-template button and logic**

Add after the save button (line 81):

```html
    <button v-if="!isEdit" class="template-save-btn" @click="saveAsTemplate" :disabled="!form.category">
      存為模板
    </button>
```

Add in `<script setup>`:

```javascript
async function saveAsTemplate() {
  const name = prompt('模板名稱：')
  if (!name || !name.trim()) return
  await templatesStore.addTemplate({
    name: name.trim(),
    type: form.type,
    category: form.category,
    subcategory: form.subcategory,
    channel: form.channel,
    cardId: form.cardId,
    account: form.account,
    note: form.note
  })
  alert('模板已儲存！')
}
```

**Step 5: Add CSS styles**

Add in `<style scoped>`:

```css
.template-selector { margin-bottom: 16px; }
.template-selector label { display: block; font-size: 14px; color: #666; margin-bottom: 4px; }
.template-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.template-btn {
  flex-shrink: 0; padding: 6px 12px; border: 1px solid #ddd; background: #fff;
  border-radius: 16px; cursor: pointer; font-size: 14px; white-space: nowrap;
}
.template-btn:hover { background: #E8F5E9; border-color: #4CAF50; }
.template-save-btn {
  width: 100%; padding: 14px; background: none; color: #2196F3;
  border: 1px solid #2196F3; border-radius: 8px; font-size: 16px;
  cursor: pointer; margin-top: 8px;
}
.template-save-btn:disabled { color: #ccc; border-color: #ccc; }
```

**Step 6: Run build to verify no errors**

Run: `npx vite build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/views/AddView.vue
git commit -m "feat: add template selector and save-as-template in AddView"
```

---

### Task 5: SettingsView — Template Management

**Files:**
- Modify: `src/views/SettingsView.vue`

**Step 1: Add template store import and init**

In `<script setup>`, add import:

```javascript
import { useTemplatesStore } from '../stores/templates.js'
```

Add after store declarations:

```javascript
const templatesStore = useTemplatesStore()
```

In `onMounted`, add:

```javascript
  await templatesStore.init()
```

**Step 2: Add template state variables**

Add in `<script setup>`:

```javascript
const editingTplId = ref(null)
const editTplName = ref('')
const dragTplIndex = ref(null)
```

**Step 3: Add template management section in template**

Add after the 分類管理 `</section>` (after line 55) and before the CWMoney section:

```html
    <section>
      <h3>模板管理</h3>
      <div v-if="!templatesStore.templates.length" class="hint">尚無模板。在記帳頁面填好欄位後可「存為模板」。</div>
      <div
        v-for="(tpl, index) in templatesStore.templates"
        :key="tpl.id"
        class="tpl-item"
        draggable="true"
        @dragstart="dragTplIndex = index"
        @dragover.prevent
        @drop="dropTemplate(index)"
      >
        <template v-if="editingTplId === tpl.id">
          <div class="edit-cat">
            <input v-model="editTplName" class="name-input" />
            <button @click="saveEditTpl(tpl)" class="save-edit-btn">存</button>
            <button @click="editingTplId = null" class="cancel-edit-btn">取消</button>
          </div>
        </template>
        <template v-else>
          <span class="tpl-drag-handle">☰</span>
          <span>{{ getCategoryIcon(tpl.category) }} <strong>{{ tpl.name }}</strong> — {{ getCategoryLabel(tpl) }}</span>
          <div class="cat-actions">
            <button @click="startEditTpl(tpl)" class="edit-btn">編輯</button>
            <button @click="deleteTpl(tpl.id)" class="delete-btn">刪除</button>
          </div>
        </template>
      </div>
    </section>
```

**Step 4: Add template management functions**

Add in `<script setup>`:

```javascript
function getCategoryIcon(categoryId) {
  const cat = categoriesStore.categories.find(c => c.id === categoryId)
  return cat ? cat.icon : '📌'
}

function getCategoryLabel(tpl) {
  return categoriesStore.getFullCategoryName(tpl.category, tpl.subcategory) || '未分類'
}

function startEditTpl(tpl) {
  editingTplId.value = tpl.id
  editTplName.value = tpl.name
}

async function saveEditTpl(tpl) {
  if (!editTplName.value.trim()) return
  await templatesStore.editTemplate({ ...tpl, name: editTplName.value.trim() })
  editingTplId.value = null
}

async function deleteTpl(id) {
  if (confirm('確定刪除此模板？')) await templatesStore.deleteTemplate(id)
}

async function dropTemplate(toIndex) {
  const fromIndex = dragTplIndex.value
  if (fromIndex === null || fromIndex === toIndex) return
  await templatesStore.reorder(fromIndex, toIndex)
  dragTplIndex.value = null
}
```

**Step 5: Add CSS styles**

Add in `<style scoped>`:

```css
.tpl-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 0;
  border-bottom: 1px solid #f0f0f0; cursor: grab;
}
.tpl-item:active { cursor: grabbing; }
.tpl-drag-handle { color: #ccc; cursor: grab; user-select: none; }
```

**Step 6: Run build to verify no errors**

Run: `npx vite build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/views/SettingsView.vue
git commit -m "feat: add template management UI in SettingsView"
```

---

### Task 6: Google Drive Backup Integration

**Files:**
- Modify: `src/views/SettingsView.vue:164-181` (upload/download functions)

**Step 1: Update upload function**

In `SettingsView.vue`, in the `upload()` function, add `templates` to the data object:

```javascript
    const data = {
      transactions: await getRecords('transactions'),
      cards: await getRecords('cards'),
      categories: await getRecords('categories'),
      templates: await getRecords('templates'),
      exportedAt: new Date().toISOString()
    }
```

**Step 2: Update download function**

In the `download()` function, after the existing store reloads, add:

```javascript
    await templatesStore.init()
```

Note: `bulkRestore` was already updated in Task 1 to handle `templates`.

**Step 3: Run build to verify no errors**

Run: `npx vite build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/views/SettingsView.vue
git commit -m "feat: include templates in Google Drive backup/restore"
```

---

### Task 7: Run Full Test Suite & Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing + new template tests)

**Step 2: Run build**

Run: `npx vite build`
Expected: Build succeeds with no warnings

**Step 3: Final commit (if any fixes needed)**

If fixes were needed, commit them. Otherwise skip.
