# Customer Check-In Application

## Overview

A comprehensive customer invitation and check-in management system that enables businesses to track visitor arrivals through QR codes and manual check-in methods. The application features a dashboard for monitoring customer status, invitation management, and bulk import capabilities for streamlined customer onboarding.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server, configured for fast HMR (Hot Module Replacement)
- **Wouter** for lightweight client-side routing instead of React Router
- **TanStack Query** (React Query) for server state management, data fetching, and caching

**UI Component System**
- **Shadcn/ui** component library built on Radix UI primitives for accessible, unstyled components
- **Tailwind CSS** for utility-first styling with custom design tokens
- **Design system** following Material Design and modern SaaS patterns (Notion, Linear, Asana)
- **Theme support** with light/dark mode toggle using CSS variables and class-based switching
- Custom color palette with professional blue primary, green success states, and amber warnings

**State Management Strategy**
- Server state managed through TanStack Query with disabled automatic refetching
- Form state handled by React Hook Form with Zod schema validation
- Local UI state managed through React hooks (useState, useEffect)
- No global state management library (Redux/Zustand) - keeping state localized to components

**Component Organization**
- Reusable UI components in `/client/src/components/ui/` (Shadcn primitives)
- Feature components in `/client/src/components/` (AddCustomerDialog, CustomerTable, etc.)
- Page components in `/client/src/pages/` for route-level views
- Example components in `/client/src/components/examples/` for documentation

### Backend Architecture

**Server Framework**
- **Express.js** for HTTP server and REST API endpoints
- **TypeScript** with ES modules for type safety across the stack
- Development server with Vite middleware integration for SSR-like experience
- Custom logging middleware for API request/response tracking

**API Design Pattern**
- RESTful endpoints under `/api` prefix
- CRUD operations for customers (`/api/customers`)
- Specialized endpoints for QR generation (`/api/generate-qr`) and check-in flows (`/api/check-in/phone`)
- Consistent error handling with status codes and JSON error responses
- Request/response logging limited to 80 characters for readability

**Data Layer**
- **Drizzle ORM** for type-safe database queries and migrations
- Repository pattern implemented through `IStorage` interface and `DatabaseStorage` class
- Database operations abstracted from route handlers for testability
- Schema definitions co-located in `/shared/schema.ts` for client/server sharing

### Data Storage

**Database Technology**
- **PostgreSQL** via Neon serverless connection pooling
- WebSocket connection using `ws` package for serverless compatibility
- Connection pooling with `@neondatabase/serverless` driver

**Schema Design**
- Single `customers` table with status enum ('pending', 'confirmed', 'checked-in')
- UUID primary keys generated via PostgreSQL `gen_random_uuid()`
- Unique QR codes generated server-side using `crypto.randomUUID()`
- Timestamp tracking for invitation and check-in events
- Drizzle-Zod integration for automatic validation schema generation from database schema

**Data Access Patterns**
- Lookup by ID, phone number, or QR code
- Search functionality with case-insensitive matching across name, email, phone
- Ordered queries using created timestamp (descending)
- Separate methods for status updates and check-in operations

### External Dependencies

**Third-Party Libraries**

*Data Processing*
- **PapaParse** - CSV parsing for customer import functionality
- **XLSX** - Excel file processing for bulk customer data
- **date-fns** - Date formatting and manipulation

*QR Code Generation*
- **qrcode** library for generating QR code data URLs
- Server-side generation at 400px width
- QR codes contain URLs to guest check-in flow

*Validation & Forms*
- **Zod** - Runtime type validation for API payloads and form inputs
- **React Hook Form** - Form state management with validation
- **@hookform/resolvers** - Zod integration for form validation

*UI & Styling*
- **Radix UI** - Headless accessible component primitives (20+ component packages)
- **class-variance-authority** - Type-safe CSS variant management
- **clsx** & **tailwind-merge** - Conditional className composition
- **cmdk** - Command palette interface component
- **Lucide React** - Icon library

*Build & Development Tools*
- **@replit/vite-plugin-runtime-error-modal** - Development error overlay
- **@replit/vite-plugin-cartographer** - Replit-specific tooling
- **esbuild** - Server-side bundling for production
- **tsx** - TypeScript execution for development

**External Services**
- Google Fonts CDN for Inter font family
- Neon PostgreSQL serverless database (connection via DATABASE_URL environment variable)

**Build & Deployment Strategy**
- Client builds to `/dist/public` via Vite
- Server bundles to `/dist/index.js` via esbuild with external packages
- Production mode serves static files from Express
- Development mode uses Vite middleware for HMR
- Database migrations managed through Drizzle Kit CLI (`db:push` command)