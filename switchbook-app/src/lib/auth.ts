import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Discord from "next-auth/providers/discord"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import { addUserToMailingList } from "@/lib/email"

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
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
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

          if (!user || !user.password) {
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
    async signIn({ user, account, profile }) {
      // Handle Discord sign-in
      if (account?.provider === "discord") {
        // Check if user exists with same email
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (existingUser) {
          // Link the accounts if user exists
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "discord",
                providerAccountId: account.providerAccountId,
              },
            },
          })

          if (!existingAccount) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | null,
              },
            })
          }
          return true
        }

        // Create new user if doesn't exist
        const discordUsername: string = (profile?.username as string) || user.name?.replace(/\s+/g, '_').toLowerCase() || `discord_${account.providerAccountId}`
        
        // Check if username is taken and generate unique one if needed
        let finalUsername: string = discordUsername
        let suffix = 1
        
        const checkUsername = async (usernameToCheck: string) => {
          return await prisma.user.findUnique({ 
            where: { username: usernameToCheck } 
          })
        }
        
        while (await checkUsername(finalUsername)) {
          finalUsername = `${discordUsername}_${suffix}`
          suffix++
        }

        const newUser = await prisma.user.create({
          data: {
            email: user.email!,
            username: finalUsername,
            emailVerified: new Date(), // Discord emails are pre-verified
            role: "USER",
            accounts: {
              create: {
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | null,
              },
            },
          },
        })
        
        // Add new Discord user to mailing list (emailMarketing defaults to true for new users)
        addUserToMailingList(newUser.email, newUser.username).catch(error => {
          console.error("Failed to add Discord user to mailing list:", error)
        })
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // For OAuth sign-ins, fetch user data
      if (account?.provider === "discord" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.name = dbUser.username
        }
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
      // Sign in event handled
    },
    async signOut(message) {
      // Sign out event handled
    },
  },
})