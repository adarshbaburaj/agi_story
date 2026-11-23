// Runware: fast image inference (poster fallback). https://runware.ai/docs
import { env, uid } from '../env.js'

export const runwareReady = () => !!env('RUNWARE_API_KEY')

export async function runwareImage(prompt: string): Promise<string> {
  const key = env('RUNWARE_API_KEY')
  if (!key) throw new Error('RUNWARE_API_KEY missing')
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: crypto.randomUUID?.() ?? uid(),
        positivePrompt: prompt.slice(0, 1800),
        model: env('RUNWARE_IMAGE_MODEL') ?? 'runware:100@1',
        width: 768,
        height: 1152,
        numberResults: 1,
        outputType: 'URL',
      },
    ]),
  })
  if (!res.ok) throw new Error(`Runware ${res.status}`)
  const json = (await res.json()) as { data?: { imageURL?: string }[] }
  const url = json.data?.[0]?.imageURL
  if (!url) throw new Error('Runware returned no image')
  return url
}
