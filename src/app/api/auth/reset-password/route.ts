import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Master admin recovery keys accepted for password reset when logged out
const VALID_KEYS = [
  'printax',
  'printax2024',
  'printax-admin',
  'admin',
  process.env.NEXTAUTH_SECRET || '',
].filter(Boolean)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, newPassword, securityKey } = body

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    // Verify security key
    const normalizedKey = (securityKey || '').trim()
    const isKeyValid = VALID_KEYS.some(k => k.toLowerCase() === normalizedKey.toLowerCase())

    if (!isKeyValid) {
      return NextResponse.json({ 
        error: 'Invalid Security Key. Please enter the master admin key (default: printax).' 
      }, { status: 403 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'No user account found with this email' }, { status: 404 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ 
      success: true, 
      message: `Password updated successfully for ${user.email}. You can now sign in.` 
    })
  } catch (error: any) {
    console.error('Password reset error:', error)
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 })
  }
}
