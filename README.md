# Club Crumbie

Production-oriented Next.js 16 storefront for Club Crumbie, a pickup-only cookie business in Ivanhoe, Victoria. This is an independent project and must use its own Vercel project, Redis-compatible datastore, R2 bucket, Stripe configuration, Resend identity, domain and secrets.

## Local development

1. Copy `.env.example` to `.env.local` and replace placeholders with new Club Crumbie test values. Never copy environment files from Imperfect Bakers.
2. Run `npm install`.
3. Run `npm run dev` and open `http://localhost:3000`.
4. Forward Stripe test webhooks to `http://localhost:3000/api/stripe/webhook` and set the resulting signing secret.

Without external credentials the public catalogue builds normally. Checkout, custom-enquiry persistence and admin data intentionally return configuration errors instead of touching another business's resources.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Home and featured collections |
| `/about` | Editable founder story placeholder |
| `/cookies` | Curated box catalogue |
| `/cookies/[slug]` | Product, allergen information, box size and pickup-date selection |
| `/cart` | Mixed-product and mixed-date cart |
| `/order-success` | Post-payment confirmation |
| `/contact-us` | Contact and custom-order enquiry |
| `/ordering-policy` | Pickup, payment, cancellation and allergen policy |
| `/admin` | Seven-day secure-session admin |

## Data and key design

Every Redis key begins with `crumbie:v1:`. Current record families are `order:{id}`, `order:all`, `custom-order:{id}`, `custom-order:all`, `pending-checkout:{id}` and `stripe-event:{eventId}`. Stripe webhook event keys make payment processing idempotent. Orders contain line-level statuses because one payment can include several pickup dates.

Products have variants for six- and twelve-cookie boxes. Pickup dates have one fixed window, close automatically 72 hours beforehand, and can be closed globally or per product. There are no stock or quantity caps.

## Deployment

Create a brand-new Vercel project from this repository. Attach a new Redis integration, configure a new R2 bucket, add Stripe and Resend values, and register the Stripe webhook against the deployed `/api/stripe/webhook` URL. Keep `crumbie.com.au` unconnected until ownership and final launch approval are confirmed.

Before launch, replace every item labelled placeholder: product names, recipes, prices, stock photography, founder content, contact email, social links, pickup address, policies, domain and invoice behaviour.
