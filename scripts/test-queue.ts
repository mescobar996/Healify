import { addTestJob } from '../src/lib/queue'

async function main() {
    console.log('--- Triggering Test Job ---')
    const job = await addTestJob('proj_clt_12345', 'sha_abcdef123456')
    console.log(`Job added with ID: ${job.id}`)
    process.exit(0)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
