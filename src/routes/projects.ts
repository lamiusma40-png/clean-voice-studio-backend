import express, { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { taskQueue } from '../services/taskQueue'
import fs from 'fs'
import path from 'path'

const router: Router = express.Router()

// In-memory project storage (replace with database in production)
interface AudioProject {
  id: string
  name: string
  description?: string
  originalAudioPath?: string
  enhancedAudioPath?: string
  transformedAudioPath?: string
  metadata: {
    createdAt: Date
    updatedAt: Date
    duration?: number
    originalFile?: string
    enhancement?: {
      mode: string
      intensity: number
      timestamp: Date
    }
    transformation?: {
      targetVoice: string
      parameters: Record<string, number>
      timestamp: Date
    }
  }
  tags?: string[]
}

const projects = new Map<string, AudioProject>()

/**
 * POST /api/projects
 * Create new audio project
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, tags } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' })
    }

    const project: AudioProject = {
      id: uuidv4(),
      name,
      description,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      },
      tags: tags || []
    }

    projects.set(project.id, project)

    res.status(201).json(project)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create project' })
  }
})

/**
 * GET /api/projects
 * List all projects
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { sort = 'updated', order = 'desc' } = req.query

    let projectList = Array.from(projects.values())

    // Sort
    if (sort === 'created') {
      projectList.sort((a, b) => {
        const aDate = a.metadata.createdAt.getTime()
        const bDate = b.metadata.createdAt.getTime()
        return order === 'desc' ? bDate - aDate : aDate - bDate
      })
    } else {
      projectList.sort((a, b) => {
        const aDate = a.metadata.updatedAt.getTime()
        const bDate = b.metadata.updatedAt.getTime()
        return order === 'desc' ? bDate - aDate : aDate - bDate
      })
    }

    res.json({
      projects: projectList,
      count: projectList.length,
      warning: 'Projects are stored in memory. Use a database for persistence.'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch projects' })
  }
})

/**
 * GET /api/projects/:id
 * Get specific project
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const project = projects.get(id)

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json(project)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch project' })
  }
})

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const project = projects.get(id)

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const { name, description, tags } = req.body

    if (name) project.name = name
    if (description !== undefined) project.description = description
    if (tags) project.tags = tags

    project.metadata.updatedAt = new Date()

    projects.set(id, project)

    res.json(project)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update project' })
  }
})

/**
 * DELETE /api/projects/:id
 * Delete project and associated files
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const project = projects.get(id)

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Clean up associated files
    const filesToDelete = [
      project.originalAudioPath,
      project.enhancedAudioPath,
      project.transformedAudioPath
    ]

    for (const file of filesToDelete) {
      if (file && fs.existsSync(file)) {
        try {
          fs.unlinkSync(file)
        } catch (err) {
          console.error('Failed to delete file:', file, err)
        }
      }
    }

    projects.delete(id)

    res.status(204).send()
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete project' })
  }
})

/**
 * POST /api/projects/:id/enhancement
 * Link enhancement task to project
 */
router.post('/:id/enhancement', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { taskId, mode, intensity } = req.body

    const project = projects.get(id)
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const task = taskQueue.getTask(taskId)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    if (task.status === 'completed' && task.outputFile) {
      project.enhancedAudioPath = task.outputFile
      project.metadata.enhancement = {
        mode,
        intensity,
        timestamp: new Date()
      }
      project.metadata.updatedAt = new Date()

      projects.set(id, project)

      res.json({
        message: 'Enhancement linked to project',
        project
      })
    } else {
      res.status(400).json({
        error: 'Task is not completed or has no output file'
      })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to link enhancement' })
  }
})

/**
 * POST /api/projects/:id/transformation
 * Link voice transformation task to project
 */
router.post('/:id/transformation', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { taskId, targetVoice, parameters } = req.body

    const project = projects.get(id)
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const task = taskQueue.getTask(taskId)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    if (task.status === 'completed' && task.outputFile) {
      project.transformedAudioPath = task.outputFile
      project.metadata.transformation = {
        targetVoice,
        parameters,
        timestamp: new Date()
      }
      project.metadata.updatedAt = new Date()

      projects.set(id, project)

      res.json({
        message: 'Transformation linked to project',
        project
      })
    } else {
      res.status(400).json({
        error: 'Task is not completed or has no output file'
      })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to link transformation' })
  }
})

/**
 * GET /api/projects/:id/download
 * Download project audio (enhanced or transformed)
 */
router.get('/:id/download', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { version = 'enhanced' } = req.query

    const project = projects.get(id)
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    let filePath: string | undefined

    if (version === 'original') {
      filePath = project.originalAudioPath
    } else if (version === 'transformed') {
      filePath = project.transformedAudioPath
    } else {
      filePath = project.enhancedAudioPath
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: `${version} audio not found for this project`
      })
    }

    const fileName = `${project.name}-${version}.wav`
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err)
      }
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Download failed' })
  }
})

/**
 * GET /api/projects/stats
 * Get project statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const allProjects = Array.from(projects.values())

    const stats = {
      totalProjects: allProjects.length,
      enhanced: allProjects.filter(p => p.enhancedAudioPath).length,
      transformed: allProjects.filter(p => p.transformedAudioPath).length,
      average: {
        name: 'Average project',
        enhancement_percentage: allProjects.length > 0 
          ? Math.round((allProjects.filter(p => p.enhancedAudioPath).length / allProjects.length) * 100)
          : 0
      }
    }

    res.json(stats)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch stats' })
  }
})

export default router
