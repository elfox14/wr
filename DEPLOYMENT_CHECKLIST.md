# Deployment Checklist

## Before deploy

- Install dependencies.
- Generate Prisma client.
- Run a production build locally.
- Prepare a PostgreSQL database.
- Add all required environment variables from `.env.example` to the hosting provider.
- Set the production application URL in the authentication settings.

## Recommended hosting

- Vercel for the Next.js application.
- Supabase, Neon, Render PostgreSQL, or another managed PostgreSQL provider for the database.

## Commands

```bash
npm install
npx prisma generate
npm run build
```

For a new database:

```bash
npx prisma db push
npx prisma db seed
```

## After deploy

- Confirm sign up and login.
- Confirm market assets load.
- Confirm virtual buy and sell actions work.
- Confirm reward actions work.
- Confirm admin endpoints require header-based authorization.
