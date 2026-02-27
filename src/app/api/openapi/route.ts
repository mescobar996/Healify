import { NextResponse } from 'next/server'

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Healify Public API',
    version: '0.2.0',
    description: 'API pública para reportar fallos de tests y consultar recursos de Healify.',
  },
  servers: [
    {
      url: 'https://healify-sigma.vercel.app',
      description: 'Production',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
      SessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
      },
    },
    schemas: {
      ReportRequest: {
        type: 'object',
        required: ['testName', 'selector', 'error'],
        properties: {
          testName: { type: 'string' },
          testFile: { type: 'string' },
          selector: { type: 'string' },
          error: { type: 'string' },
          context: { type: 'string' },
          selectorType: {
            type: 'string',
            enum: ['CSS', 'XPATH', 'TESTID', 'ROLE', 'TEXT', 'UNKNOWN'],
          },
          branch: { type: 'string' },
          commitSha: { type: 'string' },
        },
      },
      ReportResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          testRunId: { type: 'string' },
          healingEventId: { type: 'string' },
          processingTimeMs: { type: 'number' },
          result: {
            type: 'object',
            properties: {
              fixedSelector: { type: 'string', nullable: true },
              confidence: { type: 'number' },
              selectorType: { type: 'string' },
              explanation: { type: 'string' },
              needsReview: { type: 'boolean' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/v1/report': {
      post: {
        tags: ['Reporting'],
        summary: 'Report failed test for auto-healing',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReportRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Healing analysis completed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReportResponse' },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/test-runs': {
      get: {
        tags: ['Dashboard'],
        summary: 'List test runs (session required)',
        security: [{ SessionAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'offset', in: 'query', schema: { type: 'integer' } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'branch', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of test runs' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/analytics/export': {
      get: {
        tags: ['Analytics'],
        summary: 'Export ROI report as CSV or PDF',
        security: [{ SessionAuth: [] }],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'pdf'] } },
        ],
        responses: {
          '200': { description: 'File exported' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
  },
}

export async function GET() {
  return NextResponse.json(openApiSpec)
}
