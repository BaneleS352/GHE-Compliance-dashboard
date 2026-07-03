# Hollywoodbets GHE Declaration System — Rework Plan (Post-Figma Feedback)

## Context

Figma testing feedback identified three critical failures in the current build:

1. **Visual disconnect** — The landing/login screens feel bold and premium but the authenticated app (form, tables, dashboard) reverts to a generic SaaS admin aesthetic. The brand energy from the landing does not carry through.
2. **Broken form layout** — The declaration form has significant unused blank space. The root cause is a conflicting scroll architecture: `main` is `overflow-y-auto` and the inner form div also sets `overflow-y-auto` with `h-full`, creating a scroll conflict that prevents the form from filling the viewport properly. The sticky sidebar nav never actually sticks because the scroll container is the inner div, not the page.
3. **Design non-compliance** — The app must feel bold, tech-forward, cohesive, and premium — not generic. The chrome (sidebar + topbar) must visually connect to the landing experience.

This plan is a full rework to resolve all three issues.

---

## Files to Modify

1. **`src/app/App.tsx`** — Full rework (single file, all screens)
2. **`src/styles/theme.css`** — Minor token update (background slightly warmer purple-tint)

---

## Root Architecture Fixes

### Fix 1 — AppShell scroll architecture

**Problem:** `<main>` has `overflow-y-auto` and inside `NewDeclarationScreen` the form content div also has `overflow-y-auto h-full`. This creates two competing scroll containers. The inner scroll never gets a resolved height from `h-full` because the `overflow-y-auto` on `main` means `main` itself has no fixed height — it grows to fit content.

**Fix:** Remove the inner `overflow-y-auto` scroll wrapper on the form. Let `<main>` be the single scroll container. Make the form section nav sidebar use `position: sticky; top: 0` within the natural document flow.

```jsx
// AppShell main — unchanged, remains the single scroll surface
<main className="flex-1 overflow-y-auto bg-background p-7">
  <NewDeclarationScreen />
</main>

// NewDeclarationScreen — remove inner scroll div, use sticky sidebar
<div className="flex gap-6 items-start"> {/* items-start is critical */}
  <aside className="w-52 flex-shrink-0 hidden lg:block">
    <div className="sticky top-0"> {/* sticks within main's scroll */}
      ...section nav...
    </div>
  </aside>
  <div className="flex-1 min-w-0 space-y-7 pb-10"> {/* natural block, no scroll */}
    ...sections...
  </div>
</div>
```

Remove the `useRef(scrollRef)` scroll listener approach — instead use `IntersectionObserver` on each section heading to track which section is in view within `main`'s scroll context.

### Fix 2 — Form uses full width

With the inner scroll removed and `flex-1 min-w-0` on the form content column, the form fills the remaining width after the sidebar. The `min-w-0` prevents flex children from overflowing. No more blank space.

---

## Visual Rework — Design System

### Colour & ground

The authenticated app must carry the landing page's brand energy. The landing uses a **dark purple gradient** backdrop. The authenticated interior uses a **light background with white cards** (as per the original brief: "white content surfaces"). The bridge between them is the **chrome** — sidebar and topbar must both be dark.

| Surface | Current | Fixed |
|---|---|---|
| TopBar | `bg-white border-b` (generic white) | Dark gradient `linear-gradient(135deg, #0f0225, #39156F)` matching sidebar |
| Sidebar | Dark gradient ✓ | Keep — but refine |
| Main background | `#F7F8FC` | `#F4F0FC` (warmer purple-tint, less gray) |
| Cards | White `shadow-sm` | White, with `border-primary/10` (purple-tinted border), `shadow-md` |
| Section headers in form | Generic uppercase text + divider | Purple numbered badge + bold title, card has a `border-l-4 border-primary` accent |

### TopBar redesign

- Background: `linear-gradient(135deg, #0f0225 0%, #39156F 100%)` — connects visually to sidebar
- Logo: `Hollywood_Group_Logo.png` left
- System title: white text
- Notification bell: white icon with yellow dot
- User avatar: purple circle with white initials; name in white
- Divider between logo area and user area: `rgb(255 255 255 / 0.15)`

### Sidebar

- Already has dark gradient — refine to match TopBar gradient exactly
- Active nav item: yellow (`#F8D74A`) with dark text — keep this, it's strong
- Inactive items: `text-[#c4b5fd]` (lavender) — keep
- Toggle button: keep Menu/ChevronLeft pattern

### Form section cards

Each `<FS>` section card gets:
- Left purple accent border: `style={{ borderLeft: "4px solid #4F1D95" }}`
- Section header number badge: gradient purple `linear-gradient(135deg, #4F1D95, #6d28d9)`
- White card background: `bg-white rounded-2xl shadow-md`
- Inner padding: `p-6 lg:p-8`
- Field label: `text-sm font-semibold text-foreground` (normal casing — not uppercase)
- Field hint: `text-xs text-muted-foreground mt-0.5`

### Form field inputs

```
h-11 rounded-xl px-4 text-sm border border-border bg-white
focus:ring-2 focus:ring-primary/20 focus:border-primary
```
Consistent height across all inputs and selects. Error state: `border-red-400`.

### KPI cards (My Declarations + Approver Dashboard)

- `bg-white rounded-2xl border border-primary/10 shadow-md p-5`
- Icon container: colored background circle (specific per card type)
- Number: `text-3xl font-black tracking-tight` (bolder than current)
- Label: `text-xs font-medium text-muted-foreground mt-1`
- Trend: `text-[11px] font-bold mt-2`

### Tables

- Header row: `bg-[#EDE8FF]` (lavender — branded, not generic gray)
- Column header text: `text-primary text-[11px] font-bold uppercase tracking-wide`
- Row hover: `hover:bg-secondary/30` (lavender tint, not gray)
- Table card: white with `border-primary/10 shadow-md`

### Buttons

- Primary (Submit): `linear-gradient(135deg, #4F1D95, #6d28d9)` white text `h-11 px-6 rounded-xl`
- Secondary (Save Draft): white bg, `border border-primary/30` purple border, `text-primary` text
- Ghost (Filters, Export): `bg-white border border-border hover:bg-muted`

---

## Screen-by-Screen Changes

### Landing + Login (combined entry)
- **No changes needed** — this screen is already correct and bold
- Keep the 58/42 split, dark purple gradient left, white login right

### AppShell (wraps all authenticated screens)
- TopBar → dark gradient (see above)
- Sidebar → refine gradient to match TopBar
- Main → `bg-[#F4F0FC]` background

### New Declaration Form

**Layout fix** (critical):
- Remove inner `overflow-y-auto` div + `scrollRef`
- Use `IntersectionObserver` with `rootMargin` to track active section in `main`'s scroll
- Section sidebar: `sticky top-0` in normal document flow
- Form content: `flex-1 min-w-0 space-y-7` — fills full available width

**Section 1 — TeamMemberDetails:**
Fields: Name, TeamMemberCode, Manager Name, Company, Department, Team, Role/Position
Layout: 2-column grid `grid-cols-2 gap-5`, Role/Position spans full width (`col-span-2`)

**Section 2 — Declaration Details:**
Fields on same row with correct alignment:
- Row 1 (2-col): GHE Received/Given selector | Who from/to selector
- Row 2 (full): Counterparty name
- Row 3 (full): Contact person name
- Row 4 (3-col equal): Bidding process | Existing relationship | Contract negotiation
All three relationship dropdowns: Yes / No / Unsure / N/A

**Section 3 — GHE Details:**
- Category dropdown (full width) with inline definition callout
- Description textarea (full width, 4 rows)
- 2-col row: Reason/Occasion | Date
- Instances dropdown (half width)
- Value + currency selector (3-col: 2+1 split)
- VAT threshold amber alert at end of section

**Section 4 — Supporting Documents:**
- Working drag-and-drop file upload (PDF preferred, PNG, JPG, DOCX, max 20 MB)
- File list with name, size, download, delete

**Section 5 — Declaration & Undertaking:**
- 6 compliance bullet items
- Policy reference links (non-clickable)
- Confirmation checkbox
- Save Draft + Submit buttons right-aligned

**Functionality (all buttons must work):**
- Save Draft → top-page `DraftBanner` toast (auto-dismiss 4s)
- Submit → validate all `*` fields, scroll to first error → on success show `SuccessModal` (confetti CSS animation) → "View Declaration" opens `DeclarationDetailView` with approval workflow tracker

### My Declarations

**KPI cards (5):** Total Declarations, Pending, Approved, Declined, Total Value
- Use 5-column grid `grid-cols-5`
- Total Value shows sum in Rand (e.g. "R 67.6K")

**Filter bar:** Search input + Type chip filters (All/Gift/Hospitality/Entertainment) + Status chip filters (All/Draft/Pending/Approved/Declined) + Export to Excel button

**Table:**
- Header row: lavender `bg-[#EDE8FF]`
- Type badges: purple/teal/amber per type
- Status badges: color-coded
- View button: opens `DeclarationDetailView` inline (replaces full page)
- Export per-row: downloads CSV

### Approver Dashboard

**KPI row (6 cards):** Pending Queue, Approved This Month, Declined, Escalated, Avg Processing, Total Value

**My Next Step box:** Yellow left-border card, shows 2 overdue items, "View My Actions" CTA

**Pending Approvals mini-table:** 4 rows, links to Approval Queue

**Two charts (recharts):**
1. Grouped bar chart: Approved vs Declined per month
2. Donut pie: Declarations by type (Gift/Hospitality/Entertainment)

### Approval Queue

Standard table with Review button opening Approval Detail.

### Approval Detail

2-column: left = declaration read-only fields + audit trail; right = three approver decision blocks (Line Manager, HR, CEO) each with 4 radio options + notes textarea.

---

## Token Updates (`src/styles/theme.css`)

Only update `--background`:
```css
--background: #F4F0FC; /* warmer purple-tint, was #F7F8FC */
```

---

## Verification

1. App opens on Landing+Login combined screen — dark purple left, white login right
2. Sign in as TeamMember→ New Declaration form loads without blank space; form fills width
3. Sticky sidebar nav highlights correct section as user scrolls
4. All required fields (*) show red error + auto-scroll to first error on Submit attempt
5. Submit with valid data → confetti modal → "View Declaration" shows detail + workflow tracker
6. Save Draft → top-page green toast appears and auto-dismisses
7. File upload: click or drag PDF/PNG/JPG/DOCX → file appears in list with size; delete works
8. My Declarations → 5 KPI cards, type/status filters work, View opens detail, Export downloads CSV
9. Approver Dashboard → 6 KPIs, My Next Step box, charts render
10. TopBar and Sidebar both have dark gradient — visually cohesive with landing
11. Form section cards have left purple accent border
12. Table headers are lavender (`#EDE8FF`), not generic gray
