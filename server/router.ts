// Task router: Narrator, Cinematographer and casting go to the strong model; per-agent beats go to the
// fast model so 3-5 agents can decide in parallel within a few seconds.
import { models } from './gemini.js'

export type Task = 'cast' | 'beat' | 'narrator' | 'camera' | 'model3d'

export function routeTask(task: Task): string {
  switch (task) {
    case 'beat':
      return models.fast()
    case 'model3d':
      return models.builder3d()
    default:
      return models.strong()
  }
}
