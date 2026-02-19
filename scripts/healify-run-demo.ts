import axios from 'axios'

async function triggerIngest() {
    const HEALIFY_API_URL = 'http://localhost:3000/api/ingest'

    // NECESITAS UNA API KEY VÁLIDA DE UN PROYECTO EXISTENTE EN TU DB
    // Este script es para testeo manual
    const payload = {
        apiKey: 'cm7avjymr000212a2vlyqiv6b', // Reemplazar con una válida si falla
        testName: 'Login Test Failure',
        testFile: 'login.test.ts',
        failedSelector: 'button#login',
        errorMessage: 'Timeout: element not found after 5000ms',
        domSnapshot: '<html><body><div id="content"><button id="btn-login-new">Login</button></div></body></html>',
        branch: 'main',
        commitSha: '789abc'
    }

    console.log('--- Simulating Healify CLI Run ---')
    try {
        const response = await axios.post(HEALIFY_API_URL, payload)
        console.log('Response:', response.data)
    } catch (error: any) {
        console.error('Error triggering ingest:', error.response?.data || error.message)
    }
}

triggerIngest()
