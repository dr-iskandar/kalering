import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { io } from 'socket.io-client'
import TrainScene from './TrainScene.jsx'

const DEFAULT_TEXTURE = '/assets/lrt_gerbong_new.png'

function playArrivalSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioContext()
    const now = ctx.currentTime
    ;[523.25, 659.25, 783.99].forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + index * 0.12)
      gain.gain.linearRampToValueAtTime(0.085, now + index * 0.12 + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + index * 0.12)
      osc.stop(now + index * 0.12 + 0.24)
    })
  } catch {
    // Sound is decoration only; browsers may block autoplay.
  }
}

export default function ViewerPage() {
  const [scannerUrl, setScannerUrl] = useState('')
  const [scannerConnected, setScannerConnected] = useState(false)
  const [scannerCount, setScannerCount] = useState(0)
  const [active, setActive] = useState({ name: 'Kereta Hebat', textureUrl: DEFAULT_TEXTURE, id: 'default' })
  const [queue, setQueue] = useState([])
  const [celebrate, setCelebrate] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const celebrationTimer = useRef(null)

  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json())
      .then((info) => {
        const fallback = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/scan`
        setScannerUrl(info.scannerUrl || fallback)
        setScannerCount(info.connectedScanners || 0)
        setScannerConnected((info.connectedScanners || 0) > 0)
        if (info.recentScans?.length) {
          setQueue(info.recentScans)
          setActive(info.recentScans[0])
        }
      })
      .catch(() => setScannerUrl(`${window.location.origin}/scan`))

    const socket = io({ auth: { role: 'viewer' } })

    socket.on('scan:new', (scan) => {
      setActive(scan)
      setCelebrate(true)
      playArrivalSound()
      clearTimeout(celebrationTimer.current)
      celebrationTimer.current = setTimeout(() => setCelebrate(false), 2200)
    })

    socket.on('queue:update', setQueue)
    socket.on('scanner:status', ({ connected, count }) => {
      setScannerConnected(connected)
      setScannerCount(count || 0)
    })

    return () => {
      clearTimeout(celebrationTimer.current)
      socket.disconnect()
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setFullscreen(true)
      } else {
        await document.exitFullscreen()
        setFullscreen(false)
      }
    } catch {
      // Some embedded browsers do not allow programmatic fullscreen.
    }
  }, [])

  const qrValue = useMemo(() => scannerUrl || `${window.location.origin}/scan`, [scannerUrl])
  const shownQueue = queue.length ? queue : [
    { id: 'demo-1', name: 'Dihya', textureUrl: DEFAULT_TEXTURE },
    { id: 'demo-2', name: 'Rafa', textureUrl: DEFAULT_TEXTURE },
    { id: 'demo-3', name: 'Salsa', textureUrl: DEFAULT_TEXTURE },
  ]

  return (
    <main className="viewer-page">
      <div className="viewer-world">
        <TrainScene textureUrl={active.textureUrl || DEFAULT_TEXTURE} arrivalKey={active.id} />
      </div>

      <div className="viewer-vignette" />
      <div className="cloud cloud-a" />
      <div className="cloud cloud-b" />

      <header className="viewer-header">
        <div className={`status-pill ${scannerConnected ? 'is-online' : ''}`}>
          <span className="status-phone">📱</span>
          <span>
            <b>{scannerConnected ? 'HP Tersambung' : 'Siap Disambungkan'}</b>
            <small>{scannerConnected ? `${scannerCount} scanner aktif` : 'Scan QR di kanan'}</small>
          </span>
        </div>

        <div className="title-lockup">
          <div className="spark spark-1">★</div>
          <div className="spark spark-2">★</div>
          <h1>Yuk Lihat <em>Keretamu!</em></h1>
          <p>Foto dari HP, tekan kirim, lalu keretamu langsung muncul ✨</p>
        </div>

        <button className="fullscreen-btn" onClick={toggleFullscreen} aria-label="Fullscreen">
          {fullscreen ? '↙' : '⛶'}
        </button>
      </header>

      <aside className="qr-card">
        <div className="qr-eyebrow">SCAN DARI HP</div>
        <div className="qr-box">
          <QRCodeSVG value={qrValue} size={118} bgColor="#ffffff" fgColor="#24335b" level="M" />
        </div>
        <b>Buka kamera HP</b>
        <span>Pastikan HP & laptop di Wi-Fi yang sama</span>
      </aside>

      <section className="name-sign">
        <span>KERETA</span>
        <strong>{active.name || 'Hebat'}</strong>
        <i>★</i>
      </section>

      <div className="speech-bubble">Halo! 👋</div>

      {celebrate && (
        <div className="celebration" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => (
            <span key={index} style={{ '--i': index }}>★</span>
          ))}
          <div className="arrival-toast">Yeay! Keretamu datang! 🚆</div>
        </div>
      )}

      <section className="queue-panel">
        <div className="queue-title"><span>👧🏻👦🏻</span> Antrian</div>
        <div className="queue-list">
          {shownQueue.slice(0, 5).map((item, index) => (
            <button
              key={item.id || index}
              className={`queue-card ${item.id === active.id ? 'active' : ''}`}
              onClick={() => setActive(item)}
            >
              <div className="mini-train">🚆</div>
              <b>{item.name || `Kereta ${index + 1}`}</b>
              <small>{index === 0 && queue.length ? 'Baru!' : 'Siap main'}</small>
            </button>
          ))}
        </div>
      </section>

      <nav className="viewer-actions">
        <a href="/scan" className="round-action camera-action">
          <span>📷</span><b>Scan Lagi</b>
        </a>
        <button className="round-action" onClick={() => setActive({ name: 'Kereta Hebat', textureUrl: DEFAULT_TEXTURE, id: `reset-${Date.now()}` })}>
          <span>🏠</span><b>Awal</b>
        </button>
      </nav>

      <div className="viewer-hint">🖱️ Tarik kereta untuk melihat dari sisi lain</div>
    </main>
  )
}
