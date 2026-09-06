import express, { Router, Request, Response } from 'express'
import { upload } from '../server'
import { enhanceAudio, analyzeAudio, cleanupFile } from '../services/audioProcessor'
import { taskQueue } from '../services/taskQueue'
import path from 'path'
import fs from 'fs'

const router: Router = express.Router()

/**
 * POST /api/enhance
 * Upload audio and start enhancement processing
 * 
 * Body:
 * - audio: File (multipart)
 * - mode: string (ai-best, studio-podcast, natural-clean, youtube-creator, cinematic)
 * - intensity: number (0-1)
 */
router.post('/', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const { mode = 'ai-best', intensity = 0.8 } = req.body

    // Validate mode
    const validModes = ['ai-best', 'studio-podcast', 'natural-clean', 'youtube-creator', 'cinematic']
    if (!validModes.includes(mode)) {
      return res.status(400).json({ 
        error: `Invalid mode. Valid modes: ${validModes.join(', ')}`
      })
    }

    // Validate intensity
    const intensityValue = parseFloat(intensity)
    if (isNaN(intensityValue) || intensityValue < 0 || intensityValue > 1) {
      return res.status(400).json({ 
        error: 'Intensity must be between 0 and 1'
      })
    }

    // Create task for background processing
    const task = taskQueue.createTask('enhance', req.file.path, {
      mode,
      intensity: intensityValue,
      originalFilename: req.file.originalname,
      fileSize: req.file.size
    })

    // Start processing in background
    processEnhancementAsync(task.id, req.file.path, mode, intensityValue)

    res.status(202).json({
      taskId: task.id,
      status: 'processing',
      message: 'Audio enhancement started',
      mode,
      intensity: intensityValue,
      estimatedTime: '30-60 seconds'
    })
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || 'Enhancement request failed'
    })
  }
})

/**
 * GET /api/enhance/status/:taskId
 * Get status of enhancement task
 */
router.get('/status/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params
    const task = taskQueue.getTask(taskId)

    if (!task) {
      return res.status(404).json({ 
        error: 'Task not found'
      })
    }

    res.json({
      taskId: task.id,
      status: task.status,
      progress: task.progress,
      message: getStatusMessage(task.status),
      error: task.error,
      outputFile: task.outputFile,
      createdAt: task.createdAt,
      completedAt: task.completedAt
    })
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || 'Status check failed'
    })
  }
})

/**
 * GET /api/enhance/download/:taskId
 * Download enhanced audio file
 */
router.get('/download/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params
    const task = taskQueue.getTask(taskId)

    if (!task) {
      return res.status(404).json({ 
        error: 'Task not found'
      })
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ 
        error: `Task is ${task.status}, not ready for download`
      })
    }

    if (!task.outputFile || !fs.existsSync(task.outputFile)) {
      return res.status(404).json({ 
        error: 'Output file not found'
      })
    }

    // Send file
    const fileName = `enhanced-${task.metadata?.mode || 'audio'}.wav`
    res.download(task.outputFile, fileName, (err) => {
      if (err) {
        console.error('Download error:', err)
      }
    })
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || 'Download failed'
    })
  }
})

/**
 * GET /api/enhance/modes
 * Get available enhancement modes
 */
router.get('/modes', (req: Request, res: Response) => {
  res.json({
    modes: [
      {
        id: 'ai-best',
        name: 'AI Best',
        description: 'Automatically analyzes your audio and applies optimal enhancement',
        recommended: true,
        features: ['Adaptive processing', 'Noise analysis', 'Dynamic range optimization']
      },
      {
        id: 'studio-podcast',
        name: 'Studio Podcast',
        description: 'Professional spoken word processing for podcasts, interviews, and narration',
        features: ['Noise reduction', 'Room echo removal', 'De-essing', 'Presence boost', 'Loudness normalization']
      },
      {
        id: 'natural-clean',
        name: 'Natural Clean',
        description: 'Removes unwanted noise while preserving your natural voice character',
        features: ['Gentle processing', 'Noise removal', 'Natural tone preservation']
      },
      {
        id: 'youtube-creator',
        name: 'YouTube Creator',
        description: 'Optimized for online content with bright, punchy character',
        features: ['Presence enhancement', 'Brightness boost', 'Sibilance control']
      },
      {
        id: 'cinematic',
        name: 'Cinematic',
        description: 'Rich, professional narration tone for film and video production',
        features: ['Warmth enhancement', 'Dynamic control', 'Professional presence']
      }
    ]
  })
})

/**
 * GET /api/enhance/analyze
 * Analyze audio file (for AI Best mode decision making)
 */
router.post('/analyze', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const result = await analyzeAudio(req.file.path)

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error || 'Analysis failed'
      })
    }

    res.json({
      analysis: result.analysis,
      recommendation: getEnhancementRecommendation(result.analysis)
    })

    // Clean up uploaded file
    await cleanupFile(req.file.path)
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || 'Analysis failed'
    })
  }
})

/**
 * Background processing function
 */
async function processEnhancementAsync(
  taskId: string,
  inputPath: string,
  mode: string,
  intensity: number
) {
  try {
    const task = taskQueue.startTask(taskId)
    if (!task) return

    // Update progress
    taskQueue.updateProgress(taskId, 10)

    // Process audio
    const result = await enhanceAudio(inputPath, mode, intensity)

    if (!result.success) {
      taskQueue.failTask(taskId, result.error || 'Processing failed')
      return
    }

    // Update progress
    taskQueue.updateProgress(taskId, 90)

    // Complete task
    taskQueue.completeTask(taskId, result.outputPath!)

    console.log(`✅ Enhancement completed: ${taskId}`)

    // Clean up input file
    await cleanupFile(inputPath)
  } catch (error: any) {
    console.error(`❌ Enhancement error for task ${taskId}:`, error)
    taskQueue.failTask(taskId, error.message || 'Processing error')
  }
}

/**
 * Get user-friendly status message
 */
function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    pending: 'Waiting to be processed',
    processing: 'Processing your audio',
    completed: 'Enhancement complete',
    failed: 'Enhancement failed'
  }
  return messages[status] || status
}

/**
 * Get enhancement recommendation based on audio analysis
 */
function getEnhancementRecommendation(analysis: any): string {
  if (!analysis) return 'ai-best'

  const { noiseLevel, dynamicRange, peakLevel } = analysis

  // Simple heuristics
  if (noiseLevel > 0.5 || peakLevel > 0.95) {
    return 'studio-podcast' // High noise or clipping needs aggressive processing
  }
  if (dynamicRange < 18) {
    return 'youtube-creator' // Low dynamic range benefits from presence boost
  }
  
  return 'natural-clean' // Default to gentle processing
}

export default router
