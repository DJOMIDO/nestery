# Nestery

A workspace for personal and team collaboration, built with Next.js.

## Tech stack

- **Next.js 15** (App Router), React 19, TypeScript
- **Tailwind CSS v4** + **shadcn/ui**
- **Postgres on [Neon](https://neon.tech)** with **[Drizzle ORM](https://orm.drizzle.team)**
- **[Better Auth](https://www.better-auth.com)** for email/password, GitHub and Google login

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
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional): in Google Cloud Console, create an OAuth client ID of type **Web application** with the authorized redirect URI `http://localhost:3000/api/auth/callback/google`
   - `ASSISTANT_ENCRYPTION_KEY` (optional, enables the assistant): `openssl rand -base64 32`. Users' own API keys are stored encrypted with it; changing it means everyone has to add their key again. To try the assistant with your own Anthropic key without saving it, also set `ANTHROPIC_API_KEY` and add your email to `ASSISTANT_OWNER_EMAILS`. To try it for free, run a local model in [LM Studio](https://lmstudio.ai/) and choose "Other (OpenAI-compatible)" with the base URL `http://localhost:1234/v1` (local addresses are only allowed in development).

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
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional): add `https://<your-domain>/api/auth/callback/google` to the OAuth client's authorized redirect URIs, and publish the OAuth consent screen (in testing mode only listed test users can sign in)
   - `ASSISTANT_ENCRYPTION_KEY` (optional): the same value as locally if you want keys saved in one environment to work in the other; `ANTHROPIC_API_KEY` and `ASSISTANT_OWNER_EMAILS` only if you want to use your own key there
3. Deploy. Vercel runs the `vercel-build` script (`scripts/vercel-build.sh`): it applies pending migrations (`drizzle-kit migrate`) and then runs `next build`. Migrations use `DATABASE_URL_UNPOOLED` when set (the Neon integration sets it), otherwise `DATABASE_URL`.

Migrations run automatically **only for production deployments**. Preview deployments share the production database by default, and migrating it from an unmerged branch would break the live site. To run migrations on previews too, give the Preview environment its own `DATABASE_URL` (for example a Neon branch) and set `MIGRATE_PREVIEW=1` for Preview.

## Database workflow

The schema lives in `src/db/schema.ts`; migrations are committed under `drizzle/`.

| Command               | What it does                                     |
| --------------------- | ------------------------------------------------ |
| `npm run db:generate` | Generate a new migration after editing the schema |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL`       |
| `npm run db:studio`   | Browse the database in Drizzle Studio            |
