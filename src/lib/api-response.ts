import { NextResponse } from 'next/server'

type ApiErrorOptions = {
  code?: string
  details?: unknown
}

function getRequestId(request: Request): string {
  const existing = request.headers.get('x-request-id')
  if (existing) return existing

  try {
    return crypto.randomUUID()
  } catch {
    return `req_${Date.now()}`
  }
}

export function apiError(
  request: Request,
  status: number,
  message: string,
  options?: ApiErrorOptions
) {
  const requestId = getRequestId(request)

  return NextResponse.json(
    {
      error: message,
      code: options?.code,
      details: options?.details,
      requestId,
    },
    {
      status,
      headers: {
        'x-request-id': requestId,
      },
    }
  )
}
