import Discord from "next-auth/providers/discord"

export const discordProvider = Discord({
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  // Discord includes this RFC 9207 issuer in authorization callbacks.
  // Without it, Auth.js validates against its https://authjs.dev fallback.
  issuer: "https://discord.com",
})
