This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Observability and Telegram Alerts

The app now includes a lightweight telemetry pipeline and a server-side alert evaluator for Telegram notifications.

Set these environment variables in your deployment or local `.env.local` when enabling the new flow:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ALERTS_EVALUATE_SECRET=your_private_cron_secret
```

Run [supabase/observability.sql](supabase/observability.sql) in the Supabase SQL editor to create the `product_events` table used by telemetry.

The alert evaluator is exposed at `/api/alerts/evaluate` and can be called by a scheduled job or manually when you wire a cron/worker.

`ALERTS_EVALUATE_SECRET` is required and every request must send `x-alerts-secret: ALERTS_EVALUATE_SECRET` (or `Authorization: Bearer ALERTS_EVALUATE_SECRET`).

Useful tests:

```bash
# Dry run (sends Telegram but does not mark alerts as triggered)
curl -s -X POST "http://localhost:3000/api/alerts/evaluate?dryRun=1" \
	-H "x-alerts-secret: your_private_cron_secret"

# Protected call
curl -s -X POST "http://localhost:3000/api/alerts/evaluate" \
	-H "x-alerts-secret: your_private_cron_secret"
```
