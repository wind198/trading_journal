import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { GoogleSignIn } from '@/app/login/google-sign-in'
import { PasswordSignIn } from '@/app/login/password-sign-in'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const params = await searchParams
  const error = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Trading Journal</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <GoogleSignIn oauthFailed={error === 'oauth_failed'} />
          {process.env.NODE_ENV === 'development' && (
            <>
              <p className="text-center text-xs text-muted-foreground">or</p>
              <PasswordSignIn />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
