# Design Guidelines: Customer Invitation & Check-In App

## Design Approach
**System-Based Approach** - Drawing from Material Design and modern SaaS dashboard patterns (Notion, Linear, Asana) for a clean, efficient, data-focused interface. This utility-first application prioritizes clarity, workflow efficiency, and professional presentation.

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Background: 0 0% 100% (pure white)
- Surface: 210 40% 98% (subtle cool gray)
- Primary: 217 91% 60% (professional blue)
- Success: 142 71% 45% (green for checked-in status)
- Warning: 38 92% 50% (amber for pending confirmations)
- Text Primary: 222 47% 11% (near black)
- Text Secondary: 215 16% 47% (medium gray)
- Border: 214 32% 91% (light border)

**Dark Mode:**
- Background: 222 47% 11% (deep navy-black)
- Surface: 217 33% 17% (elevated dark surface)
- Primary: 217 91% 65% (slightly lighter blue)
- Success: 142 71% 50% (brighter green)
- Warning: 38 92% 55% (brighter amber)
- Text Primary: 210 40% 98% (near white)
- Text Secondary: 217 20% 70% (light gray)
- Border: 217 33% 25% (subtle border)

### B. Typography
- **Primary Font**: Inter (via Google Fonts CDN) - clean, modern sans-serif
- **Headings**: Font weights 700 (bold) for h1/h2, 600 (semibold) for h3/h4
- **Body**: Font weight 400 (regular), 500 (medium) for emphasis
- **Scale**: text-4xl (dashboard titles), text-2xl (section headers), text-lg (card headers), text-base (body), text-sm (labels/metadata)

### C. Layout System
**Spacing Units**: Consistently use Tailwind units 4, 6, 8, 12, 16 for predictable rhythm
- Component padding: p-6 (cards), p-4 (compact elements)
- Section spacing: space-y-6 (related items), space-y-8 (distinct sections)
- Container max-width: max-w-7xl for main content area
- Grid gaps: gap-6 (standard), gap-4 (compact grids)

### D. Component Library

**Navigation & Layout:**
- Sidebar navigation (fixed left, 280px width) with icon + label items
- Top bar with search, notifications, and user profile dropdown
- Breadcrumb navigation for nested views
- Mobile: Bottom navigation bar + hamburger menu

**Customer Management:**
- Data table with sortable columns, filters, and status badges
- Customer cards in grid layout (3-4 columns on desktop, 1-2 on tablet, 1 on mobile)
- Status badges: rounded-full px-3 py-1 text-xs with status-specific colors
- Action buttons positioned consistently in table rows (right-aligned)

**Forms & Input:**
- Input fields with floating labels or top-aligned labels
- Focus state: ring-2 ring-primary ring-offset-2
- File upload: Drag-and-drop zone with dashed border (border-dashed border-2)
- Multi-step forms with progress indicator at top

**Check-In Interface:**
- QR scanner: Full-screen camera view with overlay guide frame
- Phone search: Large centered search input with instant results below
- Success/error states: Toast notifications (top-right, slide-in animation)
- Customer confirmation card: Large display with photo, name, and check-in button

**Data Display:**
- Stat cards: 2x2 grid showing total invites, confirmed, checked-in, pending
- Real-time updates: Pulse animation on new check-ins
- Empty states: Centered icon + heading + description + CTA button

**Dashboard Sections:**
1. Stats overview (4 metric cards)
2. Recent check-ins (list with timestamps)
3. Upcoming invitations (table view)
4. Quick actions (add customer, send invites, scan QR)

### E. Interactive Elements

**Buttons:**
- Primary: bg-primary text-white, rounded-lg px-6 py-2.5
- Secondary: border-2 border-primary text-primary, rounded-lg px-6 py-2.5
- Ghost: hover:bg-surface text-primary
- Icon buttons: p-2 rounded-lg hover:bg-surface
- When overlaying images: backdrop-blur-sm bg-white/10 border border-white/20

**Modals & Overlays:**
- Modal backdrop: bg-black/50 backdrop-blur-sm
- Modal container: bg-background rounded-xl shadow-2xl max-w-2xl
- Slide-over panels for forms (right-side, 480px width)

**Icons:**
- Use Heroicons via CDN (outline for navigation, solid for actions)
- Size: w-5 h-5 (standard), w-6 h-6 (prominent), w-4 h-4 (compact)

**Animations:**
- Minimal and purposeful only
- Page transitions: fade-in
- Loading states: Simple spinner or skeleton screens
- Success states: Subtle scale + checkmark animation

## Images

**Dashboard Header:**
No large hero image. Instead, use abstract geometric patterns or subtle gradients as header backgrounds for visual interest without distraction.

**Customer Profile Images:**
Circular avatars (w-12 h-12 for list items, w-24 h-24 for detail views)
Fallback: Initials on colored background based on name hash

**Empty State Illustrations:**
Simple line-art illustrations for empty customer list, no pending invitations
Place in center of empty content areas

**Email Template:**
Company logo at top, QR code centered below invitation details
Use responsive email-safe HTML with inline styles

## Key Principles
- **Efficiency First**: Minimize clicks, prioritize frequent actions
- **Clear Hierarchy**: Use size, weight, and color to guide attention
- **Consistent Spacing**: Maintain rhythm with established spacing scale
- **Accessible Contrast**: Ensure WCAG AA compliance for all text
- **Responsive Design**: Mobile-first approach, enhance for larger screens
- **Professional Polish**: Clean, modern aesthetic that instills trust