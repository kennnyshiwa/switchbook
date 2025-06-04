import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { UserRole } from "@prisma/client"

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const { username, password } = loginSchema.parse(credentials)
          
          const user = await prisma.user.findUnique({
            where: { username },
          })

          if (!user) {
            throw new Error("Invalid credentials")
          }

          // Check if email is verified
          if (!user.emailVerified) {
            throw new Error("Please verify your email before logging in")
          }

          const isValidPassword = await bcrypt.compare(password, user.password)
          
          if (!isValidPassword) {
            throw new Error("Invalid credentials")
          }

          return {
            id: user.id,
            email: user.email,
            name: user.username,
            role: user.role,
          }
        } catch (error) {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  events: {
    async signIn(message) {
      console.log("Sign in event:", message)
    },
    async signOut(message) {
      console.log("Sign out event:", message)
    },
  },
})