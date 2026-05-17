import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/invoices/:path*',
    '/customers/:path*',
    '/jobs/:path*',
    '/reports/:path*',
    '/statements/:path*',
    '/api/((?!auth|captcha).*)', // Protect all API routes except /api/auth and /api/captcha
  ],
}
