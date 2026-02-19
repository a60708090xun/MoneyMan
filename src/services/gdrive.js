const CLIENT_ID = '' // User must set this
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const FILE_NAME = 'moneyman-backup.json'

let tokenClient = null
let accessToken = null

export function isConfigured() {
  return !!CLIENT_ID
}

export async function initGoogleAuth() {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          accessToken = response.access_token
          resolve(response)
        }
      })
      resolve()
    }
    document.head.appendChild(script)
  })
}

export function requestAuth() {
  if (tokenClient) tokenClient.requestAccessToken()
}

export async function uploadBackup(data) {
  if (!accessToken) throw new Error('未授權')

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })

  // Check if file already exists
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()

  if (searchData.files?.length > 0) {
    // Update existing file
    const fileId = searchData.files[0].id
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: blob
    })
  } else {
    // Create new file
    const metadata = { name: FILE_NAME, mimeType: 'application/json' }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', blob)
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form
    })
  }
}

export async function downloadBackup() {
  if (!accessToken) throw new Error('未授權')

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const searchData = await searchRes.json()

  if (!searchData.files?.length) return null

  const fileId = searchData.files[0].id
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  return res.json()
}
