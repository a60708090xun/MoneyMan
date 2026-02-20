const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'moneyman-backup.json'

let tokenClient = null
let accessToken = null
let clientId = localStorage.getItem('moneyman_gdrive_client_id') || ''
let authInitialized = false

export function isConfigured() {
  return !!clientId
}

export function setClientId(id) {
  clientId = id
  localStorage.setItem('moneyman_gdrive_client_id', id)
  authInitialized = false
}

export function getClientId() {
  return clientId
}

export async function initGoogleAuth() {
  if (!clientId || authInitialized) return
  authInitialized = true
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: () => {}
      })
      resolve()
    }
    document.head.appendChild(script)
  })
}

export function requestAuth() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google 授權尚未初始化'))
      return
    }
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error))
        return
      }
      accessToken = response.access_token
      resolve(response)
    }
    tokenClient.requestAccessToken()
  })
}

async function checkedFetch(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Drive API ${res.status}: ${errText}`)
  }
  return res
}

export async function uploadBackup(data) {
  if (!accessToken) throw new Error('未授權')

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })

  const searchRes = await checkedFetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) {
    const fileId = searchData.files[0].id
    await checkedFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: blob
    })
  } else {
    const metadata = { name: FILE_NAME, mimeType: 'application/json' }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', blob)
    await checkedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    })
  }
}

export async function downloadBackup() {
  if (!accessToken) throw new Error('未授權')

  const searchRes = await checkedFetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()

  if (!searchData.files?.length) return null

  const fileId = searchData.files[0].id
  const res = await checkedFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  return res.json()
}
