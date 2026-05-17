import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const a = Math.floor(Math.random() * 9) + 1
  const b = Math.floor(Math.random() * 9) + 1
  const sum = a + b

  const secret = process.env.NEXTAUTH_SECRET || 'secret'
  const hash = crypto.createHmac('sha256', secret).update(sum.toString()).digest('hex')
  const expires = Date.now() + 5 * 60 * 1000 // 5 minutes

  const captchaCookie = JSON.stringify({ hash, expires })

  const response = NextResponse.json({ a, b })
  response.cookies.set('captcha', captchaCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300 // 5 minutes
  })

  return response
}
