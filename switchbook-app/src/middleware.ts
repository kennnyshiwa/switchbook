import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role
  const isAuthPage = pathname.startsWith("/auth")
  const isPublicSharePage = pathname.startsWith("/share")
  const isApiRoute = pathname.startsWith("/api")
  const isAuthApiRoute = pathname.startsWith("/api/auth")
  const isPublicShareApi = pathname.startsWith("/api/share")
  const isDashboard = pathname.startsWith("/dashboard")
  const isAdminRoute = pathname.startsWith("/admin")
  const isSettingsPage = pathname.startsWith("/settings")
  const isPublicMasterSwitchApi =
    ["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (pathname === "/api/master-switches" ||
      /^\/api\/master-switches\/[^/]+$/.test(pathname))

  // Allow public pages/APIs used for logged-out discovery.
  if (isPublicSharePage || isPublicShareApi || isPublicMasterSwitchApi) {
    return NextResponse.next()
  }

  // Allow auth API routes (NextAuth endpoints)
  if (isAuthApiRoute) {
    return NextResponse.next()
  }

  // Allow API routes (but require auth for non-public APIs)
  if (isApiRoute && !isPublicShareApi && !isAuthApiRoute && !isPublicMasterSwitchApi && !isLoggedIn) {
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
