import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { AuthOptions } from 'next-auth'
import { headers } from 'next/headers'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password) return null

          await prisma.$connect()
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.trim().toLowerCase() },
          })
          if (!user || !user.active) return null

          const isValid = await bcrypt.compare(credentials.password, user.password)
          if (!isValid) return null

          // Capture Device & IP Info
          let userAgent = 'Unknown Device'
          let ipAddress = 'Unknown IP'
          let location = 'Unknown Location'
          try {
            const headersList = headers()
            userAgent = headersList.get('user-agent') || 'Unknown Device'
            
            // Try different headers for Vercel/proxies
            const forwardedFor = headersList.get('x-forwarded-for')
            const realIp = headersList.get('x-real-ip')
            let ipRaw = forwardedFor || realIp || 'Unknown IP'
            
            if (typeof ipRaw === 'string' && ipRaw.includes(',')) ipRaw = ipRaw.split(',')[0].trim()
            ipAddress = ipRaw

            // Fetch geolocation data
            if (ipAddress !== 'Unknown IP' && ipAddress !== '::1' && ipAddress !== '127.0.0.1') {
              try {
                const geoRes = await fetch(`http://ip-api.com/json/${ipAddress}?fields=city,country`, { cache: 'no-store' })
                if (geoRes.ok) {
                  const geoData = await geoRes.json()
                  if (geoData.city && geoData.country) {
                    location = `${geoData.city}, ${geoData.country}`
                  }
                }
              } catch (geoErr) {
                console.error('Geo fetch error:', geoErr)
              }
            }
          } catch (e) {
            console.error('Error parsing headers:', e)
          }

          // Create Database Session
          const loginSession = await prisma.loginSession.create({
            data: {
              userId: user.id,
              userAgent,
              ipAddress,
              location,
              expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
            }
          })

          return { id: user.id, name: user.name, email: user.email, role: user.role, sessionId: loginSession.id }
        } catch (error) {
          console.error('Authorize error:', error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        // Initial sign in
        token.role = user.role
        token.id = user.id
        token.sessionId = user.sessionId
      } else {
        // Subsequent requests: verify session is still active
        if (token.sessionId) {
          try {
            const activeSession = await prisma.loginSession.findUnique({
              where: { id: token.sessionId }
            })
            // If session was revoked/deleted by admin, kill the token
            if (!activeSession) {
              return { ...token, revoked: true }
            }
          } catch (error) {
            console.error('JWT Session check error:', error)
          }
        }
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      // If token was marked as revoked, force session destruction by stripping user
      if (token.revoked) {
        return {} as any
      }

      if (session.user) {
        session.user.role = token.role
        session.user.id = token.id
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { 
    strategy: 'jwt',
    maxAge: 4 * 60 * 60, // 4 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
}
