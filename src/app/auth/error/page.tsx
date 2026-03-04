import { getSessionUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await getSessionUser()
  
  if (user) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const error = params?.error

  const errorMessages: Record<string, { title: string; detail: string }> = {
    Callback: {
      title: 'Error en el callback de OAuth',
      detail: 'Verificá que la URL de callback en tu app de GitHub sea correcta.',
    },
    OAuthSignin: {
      title: 'Error al iniciar sesión',
      detail: 'No se pudo construir la URL de OAuth. Intentá de nuevo.',
    },
    OAuthCallback: {
      title: 'Error al procesar respuesta del proveedor',
      detail: 'El proveedor de autenticación respondió con un error. Probá de nuevo en unos segundos.',
    },
    OAuthCreateAccount: {
      title: 'No se pudo crear la cuenta',
      detail: 'Ocurrió un problema al registrar tu cuenta. Contactá soporte si persiste.',
    },
    EmailCreateAccount: {
      title: 'No se pudo crear la cuenta',
      detail: 'Error al crear la cuenta con email.',
    },
    CallbackRouteError: {
      title: 'Error en la ruta de callback',
      detail: 'El servidor encontró un problema procesando la autenticación.',
    },
    CredentialsSignin: {
      title: 'Credenciales inválidas',
      detail: 'Verificá tus datos e intentá nuevamente.',
    },
    Default: {
      title: 'Error de autenticación',
      detail: 'Ocurrió un error inesperado. Intentá de nuevo o contactá soporte.',
    },
  }

  const msg = errorMessages[error || 'Default'] || errorMessages.Default

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
            {msg.title}
          </h1>
        </div>

        {/* Error Card */}
        <div className="bg-zinc-900/50 border border-red-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <div className="text-center mb-6">
            {error && (
              <p className="text-red-400 text-sm font-mono mb-3">
                Código: {error}
              </p>
            )}
            <p className="text-zinc-400 text-sm leading-relaxed">
              {msg.detail}
            </p>
          </div>

          {/* Debug Info (collapsed by default) */}
          <details className="group mb-6">
            <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400 transition-colors select-none">
              Información técnica
            </summary>
            <div className="mt-2 bg-zinc-800/50 rounded-lg p-4">
              <p className="text-xs text-zinc-500 mb-2">Configuración requerida:</p>
              <ul className="text-xs text-zinc-400 space-y-1">
                <li>• GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET configurados</li>
                <li>• GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET configurados</li>
                <li>• NEXTAUTH_URL apuntando a este dominio</li>
                <li>• Callback URLs: /api/auth/callback/github y /api/auth/callback/google</li>
              </ul>
            </div>
          </details>

          <div className="space-y-3">
            <a 
              href="/auth/signin"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl font-medium text-white transition-all duration-200"
            >
              Intentar de nuevo
            </a>
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Volver al inicio
            </Link>
          </div>

          <p className="text-center text-[11px] text-zinc-600 mt-4">
            ¿Sigue sin funcionar?{' '}
            <a
              href="mailto:support@healify.dev?subject=Auth%20Error%20-%20${error}"
              className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
            >
              Contactar soporte
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}