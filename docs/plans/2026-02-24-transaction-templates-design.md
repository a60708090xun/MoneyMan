# Transaction Templates Design

## Overview

Add reusable transaction templates so users can quickly fill in common expense/income entries without re-entering the same fields every time.

## Requirements

- Templates store all transaction fields **except** amount and date
- Use templates from the AddView form (top of page, auto-fill on select)
- Save new templates directly from the AddView form ("存為模板")
- Manage templates (edit, delete, drag-to-reorder) in SettingsView
- Include templates in Google Drive backup/restore
- Manual drag-to-reorder sorting

## Approach

New `templates` IndexedDB object store (DB v3 upgrade) with a dedicated Pinia store, following the same patterns as existing `cards` and `categories` stores.

## Data Model

New `templates` object store (keyPath: `id`, autoIncrement: true):

```javascript
{
  id: number,              // auto-increment primary key
  name: string,            // template display name, e.g. "早餐", "房租"
  type: 'expense' | 'income',
  category: number | null,
  subcategory: number | null,
  channel: string,         // "一般", "網購", etc.
  cardId: string | null,
  account: string,         // "現金", etc.
  note: string,
  sortOrder: number        // integer for manual drag-to-reorder
}
```

## Store (useTemplatesStore)

File: `src/stores/templates.js`

```
State:
  templates — ref([]), sorted by sortOrder

Methods:
  init()                        — load all from DB, sort by sortOrder
  addTemplate(template)         — add, sortOrder = max + 1
  editTemplate(template)        — update existing template
  deleteTemplate(id)            — remove template
  reorder(fromIndex, toIndex)   — update sortOrder values for affected templates
```

## UI Changes

### AddView (記帳頁面)

- **Template selector** at top of form: horizontal scrollable row of buttons, each showing template name + category icon
- Selecting a template auto-fills: type, category, subcategory, channel, cardId, account, note
- User then inputs amount (date defaults to today)
- **"存為模板" button** next to save button: opens a name input dialog, saves current form fields as a new template

### SettingsView (設定頁面)

- New **"模板管理" section** below existing "類別管理"
- List view: icon + name + category/subcategory for each template
- Drag handle for reordering
- Tap to edit (name and all template fields)
- Delete via button or swipe

## DB Migration (v2 → v3)

- Create `templates` object store with keyPath `id` and autoIncrement
- No data migration needed (new store starts empty)

## Google Drive Backup Integration

- **Export**: include `templates` array in backup JSON
- **Import**: restore `templates` store in `bulkRestore()`
- **Backward compatible**: if backup JSON has no `templates` field, skip silently

## Testing

- `src/__tests__/stores/templates.test.js` — CRUD operations, reorder logic
- `src/__tests__/services/db.test.js` — v3 upgrade, templates store read/write

Uses existing vitest + fake-indexeddb test setup.
