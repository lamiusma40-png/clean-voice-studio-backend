import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const enhancementPresets = {
  'ai-best': {
    name: 'AI Best',
    filters: 'highpass=f=100,compand=attacks=0:decays=1:points=-80/-80|-24/-12|0/0|20/28,equalizer=f=1500:t=h:width_type=h:w=200:g=3'
  },
  'studio-podcast': {
    name: 'Studio Podcast',
    filters: 'highpass=f=80,compand=attacks=0.3:decays=0.5:points=-80/-80|-24/-12|0/0|20/28,equalizer=f=3500:t=h:width_type=h:w=250:g=-4'
  },
  'natural-clean': {
    name: 'Natural Clean',
    filters: 'highpass=f=100,compand=attacks=0.5:decays=1:points=-80/-80|-24/-12|0/0|20/28'
  },
  'youtube-creator': {
    name: 'YouTube Creator',
    filters: 'highpass=f=120,equalizer=f=3000:t=h:width_type=h:w=200:g=5,compand=attacks=0.2:decays=0.3:points=-80/-80|-24/-12|0/0|20/28'
  },
  'cinematic': {
    name: 'Cinematic',
    filters: 'equalizer=f=100:t=l:width_type=h:w=50:g=2,equalizer=f=2500:t=h:width_type=h:w=200:g=3,compand=attacks=0.4:decays=0.8:points=-80/-80|-24/-12|0/0|20/28'
  }
}

export async function enhanceAudio(
  inputPath: string,
  mode: string = 'ai-best',
  intensity: number = 0.8,
  outputDir: string = './uploads/processed'
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  try {
    if (!fs.existsSync(inputPath)) {
      return { success: false, error: 'Input file not found' }
    }

    const preset = enhancementPresets[mode as keyof typeof enhancementPresets]
    if (!preset) {
      return { success: false, error: `Unknown mode: ${mode}` }
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = Date.now()
    const outputPath = path.join(outputDir, `enhanced-${timestamp}.wav`)
    const ffmpegCmd = `ffmpeg -i "${inputPath}" -af "${preset.filters}" -y "${outputPath}" 2>&1`

    console.log(`🎵 Processing: ${mode}`)
    await execAsync(ffmpegCmd)
    console.log(`✅ Complete: ${outputPath}`)

    return { success: true, outputPath }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    return { success: false, error: error.message || 'Processing failed' }
  }
}

export async function cleanupFile(filePath: string): Promise<boolean> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch (error) {
    console.error('Cleanup error:', error)
    return false
  }
}