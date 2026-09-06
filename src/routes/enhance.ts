import express, { Router, Request, Response } from 'express'
import { upload } from '../server'
import { enhanceAudio, cleanupFile } from '../services/audioProcessor'
import { taskQueue } from '../services/taskQueue'

const router: Router = express.Router()

router.post('/', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const { mode = 'ai-best', intensity = 0.8 } = req.body
    const task = taskQueue.createTask('enhance', req.file.path, { mode, intensity: parseFloat(intensity) })

    processEnhancementAsync(task.id, req.file.path, mode, parseFloat(intensity))

    res.status(202).json({ taskId: task.id, status: 'processing' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/status/:taskId', (req: Request, res: Response) => {
  const task = taskQueue.getTask(req.params.taskId)
  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }
  res.json({ taskId: task.id, status: task.status, progress: task.progress })
})

router.get('/modes', (req: Request, res: Response) => {
  res.json({ modes: ['ai-best', 'studio-podcast', 'natural-clean', 'youtube-creator', 'cinematic'] })
})

async function processEnhancementAsync(taskId: string, inputPath: string, mode: string, intensity: number) {
  try {
    taskQueue.startTask(taskId)
    taskQueue.updateProgress(taskId, 25)

    const result = await enhanceAudio(inputPath, mode, intensity)
    if (result.success) {
      taskQueue.completeTask(taskId, result.outputPath!)
    } else {
      taskQueue.failTask(taskId, result.error || 'Failed')
    }

    await cleanupFile(inputPath)
  } catch (error: any) {
    taskQueue.failTask(taskId, error.message)
  }
}

export default router