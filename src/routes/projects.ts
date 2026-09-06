import express, { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'

const router: Router = express.Router()
const projects = new Map<string, any>()

router.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })

    const project = { id: uuidv4(), name, createdAt: new Date() }
    projects.set(project.id, project)
    res.status(201).json(project)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/', (req: Request, res: Response) => {
  res.json({ projects: Array.from(projects.values()) })
})

router.get('/:id', (req: Request, res: Response) => {
  const project = projects.get(req.params.id)
  if (!project) return res.status(404).json({ error: 'Not found' })
  res.json(project)
})

export default router