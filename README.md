# Switchbook

A web application for mechanical keyboard enthusiasts to catalog, track, and share their switch collections.

## Overview

Switchbook is a community-driven platform that helps keyboard enthusiasts:
- 📦 Track their personal switch collection
- 🔍 Browse a comprehensive database of mechanical keyboard switches
- 📊 View statistics and analytics about their collection
- 🔗 Share their collection with others
- 💡 Contribute to the community switch database

## Features

- **Personal Collection Management**: Add, edit, and organize your switches
- **Master Switch Database**: Community-curated database of switch specifications
- **Force Curve Integration**: Check if switches have force curve data available
- **Bulk Operations**: Import/export and bulk edit capabilities
- **Public Sharing**: Share your collection via public links
- **Admin Dashboard**: Manage users, submissions, and maintain data quality

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js v5 (Auth.js)
- **Email**: Mailgun (optional for local development)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/switchbook.git
   cd switchbook/switchbook-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: `http://localhost:3000`
   - `AUTH_SECRET`: Same as NEXTAUTH_SECRET
   - `AUTH_URL`: Same as NEXTAUTH_URL
   
   Email configuration is optional for local development.

4. **Set up the database**
   ```bash
   # Push the schema to your database
   npm run db:push
   
   # Or use migrations
   npm run db:migrate
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Create your admin account**
   - Navigate to http://localhost:3000/auth/register
   - The first account created automatically becomes an admin
   - No email verification required for the first admin account

### Important Notes

- All commands must be run from the `/switchbook-app/` directory
- The first registered user automatically becomes an admin with immediate access
- Subsequent users will need email verification (requires Mailgun configuration)

## Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema changes to database
npm run db:migrate   # Create and apply migrations
npm run db:studio    # Open Prisma Studio GUI

# Type Generation
npx prisma generate  # Generate Prisma client (runs automatically on npm install)
```

## Project Structure

```
switchbook-app/
├── src/
│   ├── app/           # Next.js app router pages and API routes
│   ├── components/    # React components
│   ├── lib/          # Core libraries (auth, email, database)
│   ├── utils/        # Utility functions
│   └── constants/    # App constants
├── prisma/
│   └── schema.prisma # Database schema
├── public/           # Static assets
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and patterns
- Write meaningful commit messages
- Test your changes thoroughly
- Update documentation as needed

## Environment Variables

See `.env.example` for all available options. Key variables:

- `DATABASE_URL`: PostgreSQL connection string (required)
- `NEXTAUTH_SECRET`: Session encryption secret (required)
- `NEXTAUTH_URL`: Application URL (required)
- `MAILGUN_*`: Email service configuration (optional for local dev)
- `DISCORD_*`: OAuth provider configuration (optional)

## License

[Your chosen license]

## Support

For questions or issues:
- Open an issue on GitHub
- Join our community [Discord]