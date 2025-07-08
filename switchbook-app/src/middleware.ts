import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth")
  const isPublicSharePage = req.nextUrl.pathname.startsWith("/share")
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isAuthApiRoute = req.nextUrl.pathname.startsWith("/api/auth")
  const isPublicShareApi = req.nextUrl.pathname.startsWith("/api/share")
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard")
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")
  const isSettingsPage = req.nextUrl.pathname.startsWith("/settings")

  // Allow public share pages and their API routes
  if (isPublicSharePage || isPublicShareApi) {
    return NextResponse.next()
  }

  // Allow auth API routes (NextAuth endpoints)
  if (isAuthApiRoute) {
    return NextResponse.next()
  }

  // Allow API routes (but require auth for non-public APIs)
  if (isApiRoute && !isPublicShareApi && !isAuthApiRoute && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // Redirect non-logged-in users to login
  if (!isLoggedIn && (isDashboard || isAdminRoute || isSettingsPage)) {
    return NextResponse.redirect(new URL("/auth/login", req.url))
  }

  // Check admin access
  if (isAdminRoute && userRole !== 'ADMIN') {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}