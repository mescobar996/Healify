/**
 * Script para probar el flujo de enqueue y worker
 * 
 * Uso: bun run scripts/test-enqueue.ts
 * 
 * Este script simula un webhook de GitHub y encola un job de prueba
 */

import { addTestJob, getJobStatus } from '../src/lib/queue'
import { db } from '../src/lib/db'
import { TestStatus } from '../src/lib/enums'

async function main() {
    console.log('========================================')
    console.log('🧪 Testing Healify Enqueue Flow')
    console.log('========================================\n')

    // 1. Verificar conexión a Redis
    console.log('1️⃣ Checking Redis connection...')
    
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
        console.error('❌ REDIS_URL not set!')
        console.log('\nTo fix:')
        console.log('  1. Create a Redis instance (Railway or Upstash)')
        console.log('  2. Set REDIS_URL in your .env file')
        console.log('  3. Run this script again')
        process.exit(1)
    }
    console.log('✅ REDIS_URL found\n')

    // 2. Buscar o crear un proyecto de prueba
    console.log('2️⃣ Finding test project...')
    
    let project = await db.project.findFirst({
        where: { repository: { not: null } }
    })

    if (!project) {
        // Crear proyecto de prueba
        const user = await db.user.findFirst()
        if (!user) {
            console.error('❌ No users found in database')
            process.exit(1)
        }

        project = await db.project.create({
            data: {
                name: 'Test Project',
                description: 'Created for testing enqueue flow',
                repository: 'https://github.com/mescobar996/Healify',
                userId: user.id
            }
        })
        console.log('✅ Created test project:', project.id)
    } else {
        console.log('✅ Found existing project:', project.id)
    }
    console.log('   Repository:', project.repository, '\n')

    // 3. Crear TestRun
    console.log('3️⃣ Creating TestRun...')
    
    const testRun = await db.testRun.create({
        data: {
            projectId: project.id,
            status: TestStatus.PENDING,
            branch: 'main',
            commitMessage: 'Test commit - enqueue flow verification',
            triggeredBy: 'manual_test',
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            healedTests: 0,
        }
    })
    console.log('✅ TestRun created:', testRun.id, '\n')

    // 4. Encolar job
    console.log('4️⃣ Enqueueing job...')
    
    const job = await addTestJob(
        project.id,
        'abc123', // commitSha ficticio
        testRun.id,
        {
            branch: 'main',
            commitMessage: 'Test commit',
            commitAuthor: 'test-script',
            repository: project.repository || undefined
        }
    )

    if (!job) {
        console.error('❌ Failed to enqueue job')
        process.exit(1)
    }
    console.log('✅ Job enqueued:', job.id, '\n')

    // 5. Actualizar TestRun con jobId
    await db.testRun.update({
        where: { id: testRun.id },
        data: { jobId: job.id }
    })

    // 6. Mostrar estado
    console.log('5️⃣ Job Status:')
    
    const status = await getJobStatus(job.id)
    console.log('   State:', status?.state)
    console.log('   Progress:', status?.progress)
    console.log('')

    // 7. Instrucciones
    console.log('========================================')
    console.log('✅ Enqueue Test Complete!')
    console.log('========================================\n')
    console.log('Next steps:')
    console.log('')
    console.log('1. Start the worker locally:')
    console.log('   bun run worker:railway')
    console.log('')
    console.log('2. Or deploy to Railway and check the logs')
    console.log('')
    console.log('3. Monitor the job:')
    console.log(`   TestRun ID: ${testRun.id}`)
    console.log(`   Job ID: ${job.id}`)
    console.log('')
    console.log('4. Check the database for TestRun updates:')
    console.log(`   SELECT * FROM test_runs WHERE id = '${testRun.id}';`)
    console.log('')

    process.exit(0)
}

main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
})
