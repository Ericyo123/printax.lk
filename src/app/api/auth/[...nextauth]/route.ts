import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('Auth attempt for:', credentials?.email)
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials')
          return null
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        })
        if (!user) {
          console.log('User not found in DB')
          return null
        }
        if (!user.active) {
          console.log('User is inactive')
          return null
        }
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          console.log('Invalid password')
          return null
        }
        console.log('Auth successful for:', user.email)
        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
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
  session: { strategy: 'jwt' as const },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
