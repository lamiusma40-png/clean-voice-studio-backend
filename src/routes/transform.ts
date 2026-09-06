import express, { Router, Request, Response } from 'express'

const router: Router = express.Router()

const voiceModels = [
  { id: 'natural-male', name: 'Natural Male' },
  { id: 'natural-female', name: 'Natural Female' },
  { id: 'deep-narrator', name: 'Deep Narrator' },
]

router.post('/', async (req: Request, res: Response) => {
  try {
    const { targetVoice } = req.body
    if (!targetVoice) {
      return res.status(400).json({ error: 'targetVoice required' })
    }

    res.status(202).json({
      message: 'Voice transformation requires external API (ElevenLabs, Descript, etc)',
      targetVoice
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/voices', (req: Request, res: Response) => {
  res.json({ voices: voiceModels })
})

export default router