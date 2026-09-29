import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'

function cropSquareToBlob(file, maxSize = 1800) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      try {
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
        const sx = (image.naturalWidth - sourceSize) / 2
        const sy = (image.naturalHeight - sourceSize) / 2
        const outputSize = Math.min(sourceSize, maxSize)
        const canvas = document.createElement('canvas')
        canvas.width = outputSize
        canvas.height = outputSize
        const ctx = canvas.getContext('2d', { alpha: false })
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, outputSize, outputSize)
        ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, outputSize, outputSize)
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Tidak bisa membaca foto.'))
        }, 'image/jpeg', 0.9)
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Foto tidak dapat dibuka.'))
    }
    image.src = url
  })
}

export default function ScannerPage() {
  const [name, setName] = useState('Dihya')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState('ready')
  const [message, setMessage] = useState('Foto kertas yang sudah kamu warnai!')
  const [socketConnected, setSocketConnected] = useState(false)
  const fileInput = useRef(null)

  useEffect(() => {
    const socket = io({ auth: { role: 'scanner' } })
    socket.on('connect', () => setSocketConnected(true))
    socket.on('disconnect', () => setSocketConnected(false))
    return () => socket.disconnect()
  }, [])

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const canSend = useMemo(() => Boolean(file) && status !== 'sending', [file, status])

  const choosePhoto = (event) => {
    const picked = event.target.files?.[0]
    if (!picked) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
    setStatus('preview')
    setMessage('Bagus! Pastikan seluruh kertas terlihat di dalam foto.')
  }

  const send = async () => {
    if (!file) return
    setStatus('sending')
    setMessage('Sedang mengirim keretamu... 🚆✨')
    try {
      const cropped = await cropSquareToBlob(file)
      const form = new FormData()
      form.append('image', cropped, 'coloring.jpg')
      form.append('name', name)
      const response = await fetch('/api/scan', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim.')
      setStatus('success')
      setMessage('Yeay! Sudah terkirim. Lihat layar besar! 🎉')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Gagal mengirim. Coba lagi ya.')
    }
  }

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview('')
    setFile(null)
    setStatus('ready')
    setMessage('Foto kertas yang sudah kamu warnai!')
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <main className="scanner-page">
      <div className="scanner-stars" aria-hidden="true">★ ✦ ★ ✧</div>
      <header className="scanner-header">
        <div className="scanner-logo">🚆 <span>KALERING</span></div>
        <div className={`scanner-connection ${socketConnected ? 'online' : ''}`}>
          <i /> {socketConnected ? 'Terhubung ke layar' : 'Mencari layar...'}
        </div>
      </header>

      <section className="scanner-card">
        <div className="step-pill">1 • FOTO KERTASMU</div>
        <h1>Warnanya sudah selesai? 🎨</h1>
        <p>Arahkan kamera supaya seluruh kertas masuk ke kotak. Tidak perlu scanner khusus.</p>

        <label className="name-field">
          <span>Nama keretamu</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Contoh: Dihya" />
        </label>

        <div className={`camera-frame ${preview ? 'has-photo' : ''}`}>
          {preview ? (
            <img src={preview} alt="Preview hasil foto" />
          ) : (
            <div className="camera-placeholder">
              <div className="paper-icon">🖼️</div>
              <b>Letakkan kertas di tengah</b>
              <small>Usahakan 4 sudut kertas terlihat</small>
            </div>
          )}
          <span className="corner c1" /><span className="corner c2" />
          <span className="corner c3" /><span className="corner c4" />
        </div>

        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={choosePhoto}
        />

        <div className={`scanner-message ${status}`}>{message}</div>

        {status === 'success' ? (
          <button className="big-primary success-button" onClick={reset}>📷 Warnai & kirim lagi</button>
        ) : !preview ? (
          <button className="big-primary" onClick={() => fileInput.current?.click()}>📷 Buka Kamera</button>
        ) : (
          <div className="scanner-buttons">
            <button className="secondary-button" onClick={() => fileInput.current?.click()}>↻ Foto Ulang</button>
            <button className="big-primary" disabled={!canSend} onClick={send}>
              {status === 'sending' ? 'Mengirim…' : '🚀 Kirim ke Layar'}
            </button>
          </div>
        )}
      </section>

      <section className="scanner-steps">
        <article><span>🎨</span><b>Warnai</b><small>Warnai gerbong sesukamu.</small></article>
        <article><span>📷</span><b>Foto</b><small>Ambil foto dari atas.</small></article>
        <article><span>✨</span><b>Lihat!</b><small>Kereta muncul di layar besar.</small></article>
      </section>

      <footer className="scanner-footer">HP dan laptop harus berada di jaringan Wi-Fi yang sama.</footer>
    </main>
  )
}
