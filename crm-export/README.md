# GuestFlow CRM Export — Integration Guide for EstimatePRO

This folder contains the CRM code built in GuestFlow. GuestFlow collects
leads at trade shows and events; EstimatePRO reads the same data so sales
teams can track and follow up. Both apps share a **Supabase PostgreSQL**
database as the common backbone.

---

## Architecture

```
GuestFlow (event check-in app)
  └── writes to Supabase PostgreSQL
        └── tables: companies, contacts, visits

EstimatePRO (internal sales tool)
  └── reads from the same Supabase PostgreSQL database
        └── same tables via the CRM pages below
```

---

## Step 1 — Connect EstimatePRO to the Supabase database

Tell the EstimatePRO agent:

> "Add a `DATABASE_URL` secret in Replit Secrets pointing to the shared
> Supabase PostgreSQL connection string. This is the same database used by
> GuestFlow. Use the **Transaction pooler** connection string from Supabase
> (port 6543) for serverless compatibility."

The connection string format is:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

You can find this in:
**Supabase Dashboard → Project → Connect → Transaction pooler**

---

## Step 2 — Add the schema tables

Copy the contents of `backend/schema-fragment.ts` into EstimatePRO's
`shared/schema.ts`. The three tables (`companies`, `contacts`, `visits`)
already exist in the Supabase database (GuestFlow created them), so running
`db:push` will just register them in Drizzle — no data will be lost.

After pasting, run:
```
npm run db:push
```

---

## Step 3 — Add the storage interfaces and methods

Copy the contents of `backend/storage-fragment.ts` into EstimatePRO's
`server/storage.ts`:

1. Paste the **interfaces** (`CompanyWithStats`, `ContactWithStats`,
   `ContactDetail`, `CompanyDetail`, `VisitDetail`, `AcePocFrequency`)
   near the top, alongside existing interfaces.
2. Add the **method signatures** to the `IStorage` interface.
3. Uncomment and paste the **method implementations** into the
   `DatabaseStorage` class.

Make sure these are imported at the top of storage.ts:
```ts
import { companies, contacts, visits } from "@shared/schema";
import { eq, sql, asc, desc } from "drizzle-orm";
```

---

## Step 4 — Add the API routes

Copy the contents of `backend/routes-fragment.ts` into EstimatePRO's
`server/routes.ts` inside the `registerRoutes` function. Uncomment the
route blocks. Replace `requireAuth` with whatever your auth middleware
is called if it has a different name.

---

## Step 5 — Add the frontend pages

Copy the four files from `frontend/` into EstimatePRO's `client/src/pages/`:

- `CrmCompanies.tsx`
- `CrmContacts.tsx`
- `CrmContactDetail.tsx`
- `CrmCompanyDetail.tsx`

Then register the routes in `client/src/App.tsx`:

```tsx
import CrmCompanies from "@/pages/CrmCompanies";
import CrmContacts from "@/pages/CrmContacts";
import CrmContactDetail from "@/pages/CrmContactDetail";
import CrmCompanyDetail from "@/pages/CrmCompanyDetail";

// Inside your <Switch> or router:
<Route path="/crm/companies" component={CrmCompanies} />
<Route path="/crm/companies/:id" component={CrmCompanyDetail} />
<Route path="/crm/contacts" component={CrmContacts} />
<Route path="/crm/contacts/:id" component={CrmContactDetail} />
```

Add sidebar links pointing to `/crm/companies` and `/crm/contacts`.

---

## Step 6 — Install missing dependency (if needed)

The Contacts and Contact Detail pages use `xlsx` for Excel export.
If EstimatePRO doesn't already have it, install it:

```
npm install xlsx
```

---

## What the pages do

| Page | Route | Description |
|---|---|---|
| CrmCompanies | `/crm/companies` | List of all companies with visit counts. Searchable, CSV export. |
| CrmCompanyDetail | `/crm/companies/:id` | All contacts + visit history for one company. Ace POC ranking. |
| CrmContacts | `/crm/contacts` | All individual contacts. Sortable, searchable, CSV + Excel export. |
| CrmContactDetail | `/crm/contacts/:id` | Full visit history for one contact with date/POC filters. |

---

## Data flow

When a guest checks in at an event via GuestFlow:
1. Their info is saved to the `leads` table (raw form submission)
2. Their company is upserted into `companies` (case-insensitive match)
3. They are upserted into `contacts` (matched by email)
4. A `visit` record is created linking the contact + company + event

EstimatePRO reads this data in real time — no sync needed.
