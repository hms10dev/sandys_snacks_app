import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // If there's an error, redirect to join with error message
  if (error) {
    return NextResponse.redirect(
      `${requestUrl.origin}/join?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  // If there's a code, try to exchange it for a session
  if (code) {
    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        return NextResponse.redirect(
          `${requestUrl.origin}/join?error=${encodeURIComponent(exchangeError.message)}`
        )
      }
    } catch (err) {
      return NextResponse.redirect(
        `${requestUrl.origin}/join?error=auth_exchange_failed`
      )
    }
  }

  // Success - redirect to dashboard
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}