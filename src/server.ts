import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import 'express-async-errors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import multer from 'multer'

dotenv.config()

const app: Express = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true 
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Create upload directories
const uploadDir = process.env.AUDIO_UPLOAD_DIR || './uploads/audio'
const processedDir = process.env.PROCESSED_AUDIO_DIR || './uploads/processed'

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true })
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    cb(null, `upload-${timestamp}${ext}`)
  },
})

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm']
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Invalid audio format. Allowed: ${allowedMimes.join(', ')}`))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000') }
})

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

app.get('/api/version', (req: Request, res: Response) => {
  res.json({ version: '1.0.0', name: 'Clean Voice Studio API' })
})

// Routes (will add later)
app.use('/api/enhance', (req, res) => res.json({ message: 'enhance route' }))
app.use('/api/transform', (req, res) => res.json({ message: 'transform route' }))
app.use('/api/projects', (req, res) => res.json({ message: 'projects route' }))

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message)
  const status = err.status || 500
  res.status(status).json({ error: err.message || 'Internal server error' })
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Clean Voice Studio Backend running on port ${PORT}`)
  })
}

export default app