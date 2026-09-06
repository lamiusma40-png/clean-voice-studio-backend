import { v4 as uuidv4 } from 'uuid'

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Task {
  id: string
  type: 'enhance' | 'transform' | 'export'
  status: TaskStatus
  progress: number
  inputFile: string
  outputFile?: string
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  metadata?: Record<string, any>
}

class TaskQueue {
  private tasks: Map<string, Task> = new Map()

  createTask(type: 'enhance' | 'transform' | 'export', inputFile: string, metadata?: Record<string, any>): Task {
    const task: Task = {
      id: uuidv4(),
      type,
      status: 'pending',
      progress: 0,
      inputFile,
      createdAt: new Date(),
      metadata
    }
    this.tasks.set(task.id, task)
    return task
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  updateTask(taskId: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(taskId)
    if (task) {
      Object.assign(task, updates)
      this.tasks.set(taskId, task)
    }
    return task
  }

  startTask(taskId: string): Task | undefined {
    return this.updateTask(taskId, { status: 'processing', startedAt: new Date() })
  }

  completeTask(taskId: string, outputFile: string): Task | undefined {
    return this.updateTask(taskId, { status: 'completed', progress: 100, outputFile, completedAt: new Date() })
  }

  failTask(taskId: string, error: string): Task | undefined {
    return this.updateTask(taskId, { status: 'failed', error, completedAt: new Date() })
  }

  updateProgress(taskId: string, progress: number): Task | undefined {
    return this.updateTask(taskId, { progress })
  }

  listTasks(filter?: { status?: TaskStatus; type?: string }): Task[] {
    return Array.from(this.tasks.values()).filter(task => {
      if (filter?.status && task.status !== filter.status) return false
      if (filter?.type && task.type !== filter.type) return false
      return true
    })
  }
}

export const taskQueue = new TaskQueue()