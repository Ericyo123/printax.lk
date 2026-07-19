import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { AuthOptions } from 'next-auth'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        await prisma.$connect()
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        })
        if (!user || !user.active) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        // Capture Device & IP Info
        const userAgent = req?.headers?.['user-agent'] || 'Unknown Device'
        let ipAddress = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || 'Unknown IP'
        if (Array.isArray(ipAddress)) ipAddress = ipAddress[0]
        if (typeof ipAddress === 'string' && ipAddress.includes(',')) ipAddress = ipAddress.split(',')[0]

        // Create Database Session
        const loginSession = await prisma.loginSession.create({
          data: {
            userId: user.id,
            userAgent,
            ipAddress,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        })

        return { id: user.id, name: user.name, email: user.email, role: user.role, sessionId: loginSession.id }
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
          const activeSession = await prisma.loginSession.findUnique({
            where: { id: token.sessionId }
          })
          // If session was revoked/deleted by admin, kill the token
          if (!activeSession) {
            return { ...token, revoked: true }
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
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
}
