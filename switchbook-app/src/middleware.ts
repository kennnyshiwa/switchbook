import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth")
  const isPublicSharePage = req.nextUrl.pathname.startsWith("/share")
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard")
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")
  const isSettingsPage = req.nextUrl.pathname.startsWith("/settings")

  // Allow API routes and public share pages
  if (isApiRoute || isPublicSharePage) {
    return NextResponse.next()
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