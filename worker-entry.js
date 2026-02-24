// Worker entry point - CommonJS wrapper
// Este archivo permite ejecutar el worker sin problemas de ESM

require('tsx/cjs');
require('./src/workers/railway-worker.ts');
