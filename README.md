# Pounamu Atelier

Hand-carved Aotearoa New Zealand pounamu & taonga e-commerce storefront, bespoke commission configurator, digital gift cards, courier/pickup fulfilment, and SQLite-backed Admin studio.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Stripe Elements (`@stripe/react-stripe-js`), `jspdf`, `lucide-react`
- **Backend:** Express (`server.ts`), TypeScript (`tsx`), SQLite (`better-sqlite3` persisted in `data/pounamu.db`)
- **Integrations:** Stripe PaymentIntents & Webhooks, Resend or Nodemailer SMTP transactional emails, Google Identity Services (optional), automated XML sitemap generation (`public/sitemap.xml`)

---

## Environment Variables

Create a `.env` file from `.env.example` (or set these in your deployment Secrets panel). Most storefront and payment fields can also be managed dynamically in **Admin Dashboard**, with environment variables acting as fallback or infrastructure configuration.

### 1. Server & Public URL

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No (AI Studio uses `3000`) | `3000` | Port for Express + Vite server (`NGINX_PORT` conflict guard supported). |
| `DEFAULT_APP_PORT` | No | `3000` | Fallback port used when `PORT` is unset or equals `NGINX_PORT`. |
| `NGINX_PORT` | No | — | Upstream reverse-proxy port checked so Express avoids port collision. |
| `APP_URL` | **Recommended** | `http://localhost:3000` | Public origin URL used for OpenGraph/canonical tags, `sitemap.xml`, and links inside order/gift-card emails. |
| `SITE_URL` | No | Falls back to `APP_URL` | Explicit base URL override specifically for `scripts/generate-sitemap.ts` and `public/sitemap.xml`. |
| `NODE_ENV` | Production only | `development` | Set to `production` to serve built `dist/` assets instead of Vite dev middleware. |
| `DISABLE_HMR` | No | `false` | Set to `true` in AI Studio/headless environments to disable Vite HMR file watching. |

### 2. Fresh Database Admin Bootstrap

On first startup when SQLite has no `ADMIN` user (`data/pounamu.db` is created cleanly on deployment), the server automatically inserts the default Studio Admin account for **Jesse** so he can log in immediately using either username **`jesse`** or email **`jesse@pounamuatelier.co.nz`**.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_EMAIL` | Optional | `jesse@pounamuatelier.co.nz` | Email for the default `ADMIN` account created when no admin exists in SQLite. |
| `ADMIN_PASSWORD` | Optional | `AtelierAdmin2026!` | Initial password (min 8 characters, scrypt-hashed in SQLite). Override via env var or rotate after first login in **Dashboard → Profile Settings → Update Password**. |
| `ADMIN_FIRST_NAME` | No | `Jesse` | First name / username accepted on the login form. |
| `ADMIN_LAST_NAME` | No | `""` | Optional last name for the admin profile. |

> **Security Note:** Always set a strong `ADMIN_PASSWORD` before deploying to production—or sign in as `jesse` immediately after deployment and update the password under **Profile Settings → Update Password**.

### 3. Payments — Stripe & Cash on Pickup

Card payments use Stripe PaymentIntents and Stripe Elements (PCI SAQ A). **Cash on Pickup** and **100% Gift Card Checkout** work out of the box with no Stripe keys configured.

| Variable | Required | Default | Description |
|---|---|---|---|
| `STRIPE_PUBLISHABLE_KEY` | For Card Checkout | — | Stripe publishable key (`pk_test_...` or `pk_live_...`). Overridden if set in **Admin → Payment Settings**. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | No | — | Alternate client-exposed publishable key fallback if `STRIPE_PUBLISHABLE_KEY` is unset. |
| `STRIPE_SECRET_KEY` | For Card Checkout | — | Server-only Stripe secret key (`sk_test_...` or `sk_live_...`). Overridden if saved in Admin Payment Settings. |
| `STRIPE_WEBHOOK_SECRET` | **Recommended (Prod)** | — | Stripe webhook signing secret (`whsec_...`) for verifying `/api/webhooks/stripe` events (`payment_intent.succeeded`, `charge.refunded`, etc.). |

### 4. Transactional Emails (Orders, Status Updates & Gift Cards)

Automated emails trigger on checkout (`OrderComplete`), Admin order status transitions (`PROCESSING`, `FULFILLING`, `SHIPPED`, `DELIVERED`, `REFUNDED`), and Gift Card issuance/activation. If neither Resend nor SMTP is configured, emails are still logged to SQLite (`order_emails`) and inspectable in **Admin → Email Outbox**.

| Variable | Required | Default | Description |
|---|---|---|---|
| `EMAIL_FROM` | When email provider enabled | `${siteName} <orders@pounamuatelier.co.nz>` | Sender header used for Resend / SMTP delivery. |
| `RESEND_API_KEY` | Optional (Provider A) | — | Resend API key (`re_...`). Takes precedence over SMTP if set. |
| `SMTP_HOST` | Optional (Provider B) | — | SMTP hostname used via Nodemailer when `RESEND_API_KEY` is unset. |
| `SMTP_PORT` | No | `587` | SMTP server port (`465` automatically enables TLS if `SMTP_SECURE` is unset). |
| `SMTP_SECURE` | No | `false` | Set to `true` for implicit TLS/SSL (e.g., port `465`). |
| `SMTP_USER` | If SMTP requires auth | — | SMTP authentication username. |
| `SMTP_PASS` | If SMTP requires auth | — | SMTP authentication password. |

### 5. Google Sign-In OAuth (Optional)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | For Google Login | — | Google OAuth 2.0 Web Client ID for Google Identity Services. Can also be configured in **Admin → Storefront Settings**. |

### 6. SEO & Sitemap Automation

| Variable | Required | Default | Description |
|---|---|---|---|
| `SITEMAP_INTERVAL_MINUTES` | No | `15` | Interval in minutes between automatic background regenerations of `public/sitemap.xml` (published products + gallery pieces + static pages). |

### 7. Optional AI Studio Template Secret

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | No (Unused currently) | — | Reserved in `.env.example` for optional future Gemini API features. Not currently required by the storefront or backend. |

---

## Available Scripts

```bash
# Development (Express API + Vite middleware on port 3000)
npm run dev

# Build production sitemap + Vite bundle (`dist/`)
npm run build

# Start production server (`dist/` + Express API + SQLite)
NODE_ENV=production npm run start

# TypeScript type-check
npm run lint

# One-off sitemap generation to public/sitemap.xml
npm run sitemap

# Standalone periodic sitemap watcher (respects SITEMAP_INTERVAL_MINUTES)
npm run sitemap:watch
```

## Production Deployment Checklist (Dokploy / Docker)

1. **Runtime & Builder:** The repository includes `nixpacks.toml` (`NIXPACKS_SPA_CADDY=false`, Node.js 22, native SQLite build tools, and full-stack Express startup) as well as a `Dockerfile` (`node:22-bookworm-slim`) and `.node-version` (`22`). Either Dokploy **Nixpacks** or **Dockerfile** build mode works out of the box—ensure Dokploy exposes port **`3000`**.
2. **Persistent Volume (Important for SQLite):** Mount a persistent volume at **`/app/data`** (or set `DATA_DIR` / `SQLITE_DB_PATH`) in Dokploy **Mounts** so `pounamu.db` persists across container redeployments.
3. **Environment Variables:** Configure `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and optionally `RESEND_API_KEY` or `SMTP_*`.
4. **Build & Start:**
   - **Nixpacks:** Runs `npm run build` and starts Express via `./node_modules/.bin/tsx server.ts` (`NODE_ENV=production`).
   - **Dockerfile / VPS:** Runs `npm run build` and `NODE_ENV=production npm run start` (`node server.ts` on Node 22+, serving `dist/`, `public/`, `/src/assets`, and SQLite persistence in `data/pounamu.db`).
5. Sign in at the Member & Studio login modal using **`jesse`** (or `ADMIN_EMAIL`) and update the initial password in **Dashboard → Profile Settings → Update Password** if using the fallback default.

## Database & Persistence

- Application state (users, products, gallery items, legal/privacy policies, SEO per-page overrides, couriers & shipping rates, orders, custom commissions, gift cards, discounts, and email logs) is stored in **SQLite** (`data/pounamu.db`, or `$DATA_DIR/pounamu.db`) in WAL mode.
- Runtime schema defaults live in `src/utils/defaults.ts`; on a fresh empty database, SQLite automatically seeds default `site_settings`, `custom_pricing`, `NZ Post` courier rates, and Jesse's admin account so the app is ready immediately upon deployment.
