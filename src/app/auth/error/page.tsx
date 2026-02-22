import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const session = await getServerSession(authOptions)
  
  if (session) {
    redirect('/dashboard')
  }

  const error = searchParams.error

  const errorMessages: Record<string, string> = {
    Callback: 'OAuth callback error. Check if GitHub OAuth app callback URL is correctly configured.',
    OAuthSignin: 'Error constructing OAuth sign-in URL.',
    OAuthCallback: 'Error handling OAuth callback.',
    OAuthCreateAccount: 'Could not create account.',
    EmailCreateAccount: 'Could not create account with email.',
    CallbackRouteError: 'Callback route error.',
    CredentialsSignin: 'Invalid credentials.',
    Default: 'An authentication error occurred.',
  }

  const errorMessage = errorMessages[error || 'Default'] || errorMessages.Default

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-transparent to-orange-950/20 pointer-events-none" />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      
      <div className="relative w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 mb-4">
            <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Authentication Error
          </h1>
        </div>

        {/* Error Card */}
        <div className="bg-zinc-900/50 border border-red-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <div className="text-center mb-6">
            <p className="text-red-400 text-sm font-mono mb-4">
              {error ? `Error: ${error}` : 'Unknown error'}
            </p>
            <p className="text-zinc-400 text-sm">
              {errorMessage}
            </p>
          </div>

          {/* Debug Info */}
          <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
            <p className="text-xs text-zinc-500 mb-2">Required configuration:</p>
            <ul className="text-xs text-zinc-400 space-y-1">
              <li>• GITHUB_CLIENT_ID must be set</li>
              <li>• GITHUB_CLIENT_SECRET must be set</li>
              <li>• NEXTAUTH_URL must be set to this domain</li>
              <li>• GitHub OAuth callback: /api/auth/callback/github</li>
            </ul>
          </div>

          <a 
            href="/auth/signin"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl font-medium text-white transition-all duration-200"
          >
            Try Again
          </a>
        </div>
      </div>
    </div>
  )
}