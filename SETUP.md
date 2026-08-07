# Trading Journal Application - Setup Guide

## Overview
This is a personal trading journal web application built with Next.js 16, React 19, Supabase, and Tailwind CSS. It provides a clean, intuitive interface for logging and managing trading entries.

## Features
- **User Authentication**: Email/password signup and login via Supabase Auth
- **Trading Journal**: Create, edit, view, and delete trading entries
- **Trade Details**: Track entry/exit prices, symbol, nature (long/short), trade type, time frame, price action patterns, and outcomes
- **Two-Screen Design**:
  - Screen 1: Login page (`/login`)
  - Screen 2: Journal dashboard (`/journal`) with list on left and right-side overlay sidebar for create/edit/view operations
- **Real-Time Sync**: Updates automatically reflect across the UI
- **Row-Level Security**: All data is isolated per user via Supabase RLS policies

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19
- **Styling**: Tailwind CSS 4
- **Form Validation**: React Hook Form + Zod
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth (email/password)
- **Icons**: Lucide React

## Installation & Setup

### Prerequisites
1. Supabase project with environment variables set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Steps

1. **Install dependencies** (already done):
   ```bash
   pnpm install
   ```

2. **Create the database schema** in Supabase:
   - Go to SQL Editor in your Supabase dashboard
   - Copy the entire content of `migrations/001_create_trading_journal.sql`
   - Paste and execute in the SQL editor
   - This creates:
     - `trading_journal` table with all required fields and enums
     - Indexes for performance
     - Row-Level Security (RLS) policies to isolate user data

3. **Set environment variables**:
   - All Supabase env vars should already be configured in your project
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set

4. **Run the development server**:
   ```bash
   pnpm dev
   ```
   - Open http://localhost:3000
   - You'll be redirected to /login

## Usage

### Authentication Flow
1. Navigate to `/login`
2. Click "Sign up" to create a new account or "Sign in" with existing credentials
3. After authentication, you're redirected to `/journal`

### Managing Trades

#### Creating a New Trade
1. Click "+ New Trade" button in the header
2. Right-side overlay sidebar opens
3. Fill in the form with trade details:
   - Entry date, symbol, entry/exit prices, quantity
   - Nature (long/short), type (swing/scalp/day/position)
   - Time frame, price action pattern
   - Whether sub-wave trades allowed
   - Outcome (win/loss)
   - Optional notes
4. Click "Save Trade" to submit

#### Viewing/Editing Trades
1. Click any trade card in the left list
2. Right-side overlay sidebar opens in "Edit" mode
3. Modify fields as needed
4. Click "Save Trade" to update
5. Or click "Delete Trade" to remove it

#### Closing the Sidebar
- Click the X button
- Click the semi-transparent backdrop
- Save/delete a trade

## Component Structure

```
/components
  ├── sidebar-overlay.tsx      # Right-side overlay container
  ├── journal-form.tsx         # Form for create/edit (inside sidebar)
  ├── journal-list.tsx         # List of trades (left side)
  └── journal-card.tsx         # Individual trade card
  └── ui/
      └── button.tsx           # Reusable button component

/app
  ├── page.tsx                 # Root redirect logic
  ├── layout.tsx               # Root layout
  ├── login/
  │   └── page.tsx             # Login/signup form
  └── journal/
      └── page.tsx             # Main dashboard with state management

/lib
  ├── supabase/
  │   ├── client.ts            # Browser Supabase client
  │   ├── server.ts            # Server Supabase client
  │   └── proxy.ts             # Auth cookie refresh helper
  └── types.ts                 # TypeScript types for trade data
```

## Database Schema

### Table: `trading_journal`
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users, cascading delete)
- `entry_date` (DATE)
- `symbol` (VARCHAR: EURUSD, GBPUSD, USDJPY, AUDUSD)
- `entry_price` (DECIMAL(10,5))
- `exit_price` (DECIMAL(10,5), nullable)
- `quantity` (DECIMAL(10,2))
- `nature` (VARCHAR: LONG, SHORT)
- `type` (VARCHAR: SWING, SCALP, DAY, POSITION)
- `time_frame` (VARCHAR: 1M, 5M, 15M, 1H, 4H, D, W)
- `price_action_pattern` (VARCHAR: BREAKOUT, PULLBACK, REVERSAL, CONTINUATION, RANGE)
- `allow_sub_wave` (BOOLEAN)
- `win` (BOOLEAN)
- `profit_loss` (DECIMAL(15,2), nullable, auto-calculated)
- `notes` (TEXT, nullable)
- `created_at` (TIMESTAMP with time zone)
- `updated_at` (TIMESTAMP with time zone)

### Indexes
- `idx_trading_journal_user_id` (for user data isolation)
- `idx_trading_journal_entry_date` (for sorting/filtering)

### Row-Level Security Policies
- Users can only SELECT, INSERT, UPDATE, DELETE their own trades
- All operations scoped by `auth.uid() = user_id`

## Form Validation

All form fields are validated using Zod:
- Entry date: Required
- Symbol: Required, must be one of the four pairs
- Entry/Exit prices: Required to be positive numbers
- Quantity: Required, positive number
- Nature, Type, Time Frame, Pattern: Required enum values
- Outcome: Required boolean (win/loss)
- Notes: Optional text

## Styling & Theme
- **Background**: Dark slate (`bg-slate-900`, `bg-slate-800`)
- **Text**: Light colors (`text-white`, `text-slate-200`)
- **Accents**: Blue for buttons, success green for wins, danger red for losses
- **Responsive**: Mobile-first design with Tailwind CSS
- **Animations**: Smooth sidebar slide-in transitions

## Troubleshooting

### "Not authenticated" redirect
- Ensure you're logged in via `/login`
- Check Supabase auth session in browser DevTools Storage > Cookies

### Form validation errors
- Check console for validation messages
- Ensure all required fields are filled
- Verify enum values match expected options

### Database errors
- Verify schema was created: Check Supabase SQL Editor history
- Confirm RLS policies are enabled
- Check browser/server clients are using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Styling issues
- Clear browser cache and rebuild (`pnpm build`)
- Verify Tailwind CSS is compiling

## Deployment

1. Push code to GitHub
2. Connect to Vercel
3. Ensure all environment variables are set in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy

## Future Enhancements
- Analytics dashboard (win rate, profit/loss stats)
- Advanced filtering and search
- Export trades to CSV
- Trade performance charts
- Mobile app version
