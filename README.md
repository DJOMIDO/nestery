# Nestery

A workspace for personal and team collaboration, built with Next.js.

## Tech stack

- **Next.js 15** (App Router), React 19, TypeScript
- **Tailwind CSS v4** + **shadcn/ui**
- **Postgres on [Neon](https://neon.tech)** with **[Drizzle ORM](https://orm.drizzle.team)**
- **[Better Auth](https://www.better-auth.com)** for email/password and GitHub login

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Neon project, then copy `.env.example` to `.env.local` and fill it in:
   - `DATABASE_URL`: Neon's **pooled** connection string (a local Postgres URL also works)
   - `BETTER_AUTH_SECRET`: generate with `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `http://localhost:3000` for local development
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (optional): create a GitHub OAuth App with the callback URL `http://localhost:3000/api/auth/callback/github`

3. Create the database tables:

   ```bash
   npm run db:migrate
   ```

4. Start the dev server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Deploying to Vercel

1. On [vercel.com](https://vercel.com), choose **Add New → Project** and import this repository.
2. In **Settings → Environment Variables**, add:
   - `DATABASE_URL`: Neon's pooled connection string
   - `BETTER_AUTH_SECRET`: a random string (`openssl rand -base64 32`)
   - `BETTER_AUTH_URL` (optional): only needed with a custom domain. Otherwise the app uses the Vercel deployment URL, so production and preview deployments both work.
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (optional): the OAuth App callback URL must be `https://<your-domain>/api/auth/callback/github`
3. Deploy. Vercel runs the `vercel-build` script, which applies pending migrations (`drizzle-kit migrate`) before `next build`, so the tables are created automatically. It uses `DATABASE_URL_UNPOOLED` for migrations when set (the Neon integration sets it), otherwise `DATABASE_URL`.

Every deployment runs migrations against the database it is configured with. Point preview deployments at a separate Neon branch if you don't want them to change production data.

## Database workflow

The schema lives in `src/db/schema.ts`; migrations are committed under `drizzle/`.

| Command               | What it does                                     |
| --------------------- | ------------------------------------------------ |
| `npm run db:generate` | Generate a new migration after editing the schema |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL`       |
| `npm run db:studio`   | Browse the database in Drizzle Studio            |
