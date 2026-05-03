const express = require('express')
const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

const app = express()
const DATA_FILE = path.join(__dirname, 'data.json')

let packages = loadData()
const clients = new Set()

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  catch { return [] }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(packages))
}

function broadcast() {
  const msg = `data: ${JSON.stringify(packages)}\n\n`
  clients.forEach(res => res.write(msg))
}

app.use(express.json())
app.use(express.static(__dirname))

// Sync en tiempo real via Server-Sent Events
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  res.write(`data: ${JSON.stringify(packages)}\n\n`)
  clients.add(res)
  req.on('close', () => clients.delete(res))
})

app.get('/api/packages', (req, res) => res.json(packages))

app.post('/api/packages', (req, res) => {
  const { name, zone } = req.body
  const validZones = ['MALETERO', 'TRASERO', 'DELANTERO']
  if (!name?.trim() || !validZones.includes(zone)) {
    return res.status(400).json({ error: 'Datos inválidos' })
  }
  const pkg = { id: randomUUID(), name: name.trim(), zone, delivered: false, createdAt: Date.now() }
  packages.push(pkg)
  saveData()
  broadcast()
  res.status(201).json(pkg)
})

app.patch('/api/packages/:id', (req, res) => {
  const pkg = packages.find(p => p.id === req.params.id)
  if (!pkg) return res.status(404).json({ error: 'No encontrado' })
  pkg.delivered = Boolean(req.body.delivered)
  saveData()
  broadcast()
  res.json(pkg)
})

app.delete('/api/packages/:id', (req, res) => {
  packages = packages.filter(p => p.id !== req.params.id)
  saveData()
  broadcast()
  res.json({ success: true })
})

app.delete('/api/trip', (req, res) => {
  packages = []
  saveData()
  broadcast()
  res.json({ success: true })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✦ Spark Drive corriendo en http://localhost:${PORT}`)
  console.log(`  Desde iPhone usa: http://<IP-DE-TU-MAC>:${PORT}\n`)
})
