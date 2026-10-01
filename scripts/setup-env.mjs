import { copyFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'

const environmentFiles = [
  ['backend/.env.example', 'backend/.env'],
  ['frontend/.env.example', 'frontend/.env'],
]

for (const [source, destination] of environmentFiles) {
  try {
    await access(destination, constants.F_OK)
    console.log(`Keeping existing ${destination}`)
  } catch {
    await copyFile(source, destination)
    console.log(`Created ${destination} from ${source}`)
  }
}
