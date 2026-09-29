import express from 'express'
import http from 'http'
import os from 'os'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import multer from 'multer'
import sharp from 'sharp'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isProd = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT || 4173)

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 12 * 1024 * 1024,
})

const uploadDir = path.join(__dirname, 'runtime_uploads')
fs.mkdirSync(uploadDir, { recursive: true })
app.use('/uploads', express.static(uploadDir, { maxAge: 0 }))
app.use(express.json({ limit: '2mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
})

const recentScans = []
let scannerConnections = 0

function getLanAddresses() {
  const interfaces = os.networkInterfaces()
  const result = []
  for (const items of Object.values(interfaces)) {
    for (const item of items || []) {
      if (item.family === 'IPv4' && !item.internal) result.push(item.address)
    }
  }
  return result
}

app.get('/api/info', (req, res) => {
  const addresses = getLanAddresses()
  res.json({
    port: PORT,
    addresses,
    scannerUrl: addresses[0] ? `http://${addresses[0]}:${PORT}/scan` : null,
    connectedScanners: scannerConnections,
    recentScans: recentScans.slice(0, 5),
  })
})

app.post('/api/scan', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Foto belum dipilih.' })

    const id = crypto.randomUUID()
    const safeName = String(req.body.name || 'Kereta Hebat').trim().slice(0, 32) || 'Kereta Hebat'
    const filename = `${id}.png`
    const targetPath = path.join(uploadDir, filename)

    await sharp(req.file.buffer)
      .rotate()
      .resize(2048, 2048, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: false,
      })
      .png({ compressionLevel: 8 })
      .toFile(targetPath)

    const payload = {
      id,
      name: safeName,
      textureUrl: `/uploads/${filename}?v=${Date.now()}`,
      createdAt: Date.now(),
    }

    recentScans.unshift(payload)
    recentScans.splice(8)
    io.to('viewers').emit('scan:new', payload)
    io.emit('queue:update', recentScans.slice(0, 5))

    res.json({ ok: true, ...payload })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Gagal memproses foto. Coba lagi.' })
  }
})

io.on('connection', (socket) => {
  const role = socket.handshake.auth?.role || 'unknown'
  socket.data.role = role

  if (role === 'viewer') {
    socket.join('viewers')
    socket.emit('queue:update', recentScans.slice(0, 5))
  }

  if (role === 'scanner') {
    scannerConnections += 1
    io.to('viewers').emit('scanner:status', { connected: true, count: scannerConnections })
  }

  socket.on('disconnect', () => {
    if (socket.data.role === 'scanner') {
      scannerConnections = Math.max(0, scannerConnections - 1)
      io.to('viewers').emit('scanner:status', {
        connected: scannerConnections > 0,
        count: scannerConnections,
      })
    }
  })
})

if (isProd) {
  const dist = path.join(__dirname, 'dist')
  app.use(express.static(dist))
  app.get('*path', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
} else {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  })
  app.use(vite.middlewares)
}

server.listen(PORT, '0.0.0.0', () => {
  const addresses = getLanAddresses()
  console.log(`\nKalering running:`)
  console.log(`  Viewer : http://localhost:${PORT}/viewer`)
  console.log(`  Scanner: http://localhost:${PORT}/scan`)
  for (const address of addresses) {
    console.log(`  Phone  : http://${address}:${PORT}/scan`)
  }
  console.log('')
})
