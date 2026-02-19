import { db } from '../src/lib/db'

async function findApiKey() {
    const project = await db.project.findFirst({
        select: { apiKey: true, name: true }
    })

    if (project) {
        console.log(`Found Project: ${project.name}`)
        console.log(`API Key: ${project.apiKey}`)
    } else {
        console.log('No projects found in database.')
    }
}

findApiKey()
