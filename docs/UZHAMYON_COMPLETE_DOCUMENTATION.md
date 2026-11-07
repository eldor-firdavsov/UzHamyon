# UzHamyon — Complete Product & Technical Documentation

> Repository: eldor-firdavsov/UzHamyon  
> Branch reviewed: main  
> Scope: source-code audit of the current repository, not a production runtime certification  
> Product: Telegram-first personal finance management Mini App  
> UI language: Uzbek (Latin); default product currency: UZS

---

## 1. Executive summary

UzHamyon is a personal-finance management product delivered primarily as a Telegram Mini App. The Telegram bot is the entry point and also accepts natural-language financial messages. The Mini App is the main visual interface for reviewing balances, recording income and expenses, analysing cash flow, managing budgets and savings goals, importing financial records, and asking an AI financial assistant questions grounded in the user's stored financial data.

The repository contains:
- Next.js App Router application and React client components.
- Supabase Auth, Postgres, SSR integration, Row Level Security and migrations.
- Telegram WebApp authentication, bot webhook, reminders and action callbacks.
- AI services using Google Gemini and OpenRouter fallback.
- Transaction, analytics, budget, goal, category and import services.
- AI insight generation and confirmation-based financial action execution.
- Automated test scripts covering core product flows.

The primary in-app navigation is:
1. Bosh sahifa / Dashboard
2. Faoliyat / Transactions
3. Tahlil / Analytics and savings goals
4. AI / Financial assistant

Additional product areas are available as dedicated routes:
- Kategoriyalar
- Import
- Moliyaviy xulosalar / Insights
- Sozlamalar
- Onboarding

**Implementation distinction:** Dashboard, Transactions, Analytics, Goals, Budgets and AI routes currently render the large shared UzHamyonPrototypeApp component with different initial tabs. The /prototype route renders the same component with demo fallback enabled. Dedicated components such as GoalsManager, BudgetsManager, AnalyticsView, TahlilHub, AIAdvisorChat and TransactionsManager also exist, but they should not automatically be assumed to be the active route implementation. The route pages are the source of truth for the currently wired composition.

## 2. Product goals and user value

### Problems addressed
- Users lose track of where their money goes.
- Income and expenses are recorded inconsistently or not at all.
- Users lack a clear monthly and weekly view of cash flow.
- Users cannot easily compare spending by category.
- Users need a practical way to set spending limits and savings targets.
- Users want to record transactions conversationally in Telegram.
- Users need financial answers based on their own recorded data, not invented numbers.

### Product outcomes
- Centralise personal income and expense records.
- Show a calculated balance and period summaries.
- Make transaction capture quick and low-friction.
- Categorise transactions consistently, including title-based category suggestions.
- Make spending patterns understandable through analytics and insights.
- Track budget limits and savings-goal progress.
- Provide a grounded AI assistant that can answer questions and propose financial actions.
- Keep the experience inside Telegram while retaining browser-compatible routes.

## 3. Feature inventory and status legend

Status labels:
- **Implemented**: code and route/service implementation are present.
- **Partially implemented / integration caveat**: code exists, but active UI wiring or persistence needs verification.
- **Secondary component**: component/service exists, but current route composition does not prove it is used in the main user flow.
- **Not verified**: source alone cannot prove production configuration or successful external integration.
- **Recommended**: proposed roadmap item, not a claim that it exists.

| Feature | Status |
|---|---|
| Telegram Mini App initialisation | Implemented |
| Telegram-only sign-in | Implemented |
| User onboarding | Implemented |
| Dashboard and balance summary | Implemented |
| Income and expense transactions | Implemented |
| Automatic title-based category prediction | Implemented |
| Transaction search and type filters | Implemented |
| Month navigation | Implemented |
| Weekly cash-flow chart | Implemented |
| Category analytics | Implemented |
| Budget CRUD and progress | Implemented |
| Savings goals and contributions | Implemented |
| Goal feasibility calculation | Implemented |
| AI financial Q&A | Implemented |
| AI action proposals and confirmation | Implemented in code; production config/migrations required |
| AI-generated financial insights | Implemented |
| CSV/XLS/XLSX import | Implemented |
| Custom categories | Implemented |
| Profile edit and logout | Implemented |
| Telegram reminders | Implemented in code; production cron/secrets required |
| Telegram webhook idempotency | Implemented in code; migration required |
| Persistent AI action queue | Implemented in code; migration required |
| Direct bank API synchronisation | Not verified |
| Recurring transaction scheduler | Not verified; schema supports a recurring source marker |
| Multiple wallets/accounts/cards | Not verified in core schema |
| Live currency conversion | Not verified |
| PDF/Excel report export | Not verified |

## 4. Routes and navigation

| Route | Purpose | Current composition |
|---|---|---|
| / | Redirect | Authenticated → /dashboard; guest → /login |
| /login | Telegram sign-in instructions and bot deep link | Login page |
| /register | Legacy route | Redirects to /login; no email/password registration |
| /onboarding | New-user profile and finance setup | Standard wizard or Telegram onboarding |
| /dashboard | Main financial overview | Shared prototype, initial tab dash |
| /transactions | Transaction activity | Shared prototype, initial tab act |
| /analytics | Financial analysis and goals | Shared prototype, initial tab tahlil |
| /budgets | Budget entry point | Shared prototype, Tahlil |
| /goals | Savings-goal entry point | Shared prototype, Tahlil goals subtab |
| /ai | AI assistant | Shared prototype, initial tab ai |
| /advisor | Alternate AI route | Shared prototype, initial tab ai |
| /categories | Category management | CategoriesManager |
| /imports | Bank statement/spreadsheet import | ImportManager |
| /insights | Financial insights feed | InsightsFeed |
| /settings | Profile and management links, logout | Settings page |
| /prototype | Demo preview | Shared prototype with demo fallback |

### Main navigation
The main prototype has four tabs: Bosh sahifa, Faoliyat, Tahlil and AI.

Desktop header includes brand, tabs, month selector, transaction CTA and profile menu. Mobile navigation uses MobileNavBar with four tabs and a detached plus button for adding a transaction. It implements pointer scrubbing, liquid-glass visuals and optional haptic feedback.

### URL and month state
Tab changes map to:
- Dashboard → /dashboard
- Activity → /transactions
- Analytics → /analytics
- AI → /advisor

The selected month uses month=YYYY-MM. The prototype also reads subtab state from the URL. Browser back/forward events restore tabs. Available months are derived only from months containing at least one valid transaction; empty months are not inserted.

## 5. Authentication and onboarding

### Telegram-only authentication
The intended production path is Telegram WebApp authentication. Email/password registration and login are intentionally not offered.

Flow:
1. User opens the Telegram bot or Mini App.
2. Telegram WebApp provides initData.
3. TelegramMiniAppInit calls ready() and expand().
4. It sets Telegram header/background colours.
5. Client posts initData to /api/auth/telegram.
6. Server verifies Telegram HMAC-SHA256 signature with the bot token.
7. Server validates auth_date freshness.
8. Server finds or creates the Supabase Auth identity.
9. Supabase session is returned and written to secure cookies.
10. User goes to onboarding if incomplete, otherwise Dashboard.

Verification rejects missing initData, missing hash, invalid signatures, stale/future timestamps outside tolerance, malformed user payloads and missing Telegram IDs.

### Internal Supabase identity
Telegram users map to a stable internal email of the form tg_<telegram_id>@telegram.uzhamyon.uz. A deterministic internal password is derived from server-side secret material and the bot token. These credentials are implementation details, not user-facing login credentials.

The service attempts sign-in, then recovery of an existing account, then automatic account creation. Admin recovery requires the service-role key.

### Session and request security
- Supabase SSR cookies are used for server-rendered routes.
- Telegram auth writes cookies with SameSite=None, Secure and root path for Telegram WebView compatibility.
- Server Supabase client reads cookies/bearer tokens.
- proxy.ts sanitises internal/auth headers and protects authenticated routes.
- Internal identity headers are signed and verified.
- API services perform authenticated-user checks.
- Database RLS policies provide row-level isolation.

### Standard onboarding wizard
The standard wizard collects:
1. Welcome/introduction.
2. Profile name.
3. Financial goals.
4. Declared monthly income.
5. Estimated monthly expenses by category.
6. Review/calculated totals and completion.

It stores draft progress as the user advances. It calculates total estimated expenses from category inputs and potential savings as declared income minus declared expenses.

Onboarding planning values are estimates. They are not transactions and must not be represented as verified account balance.

Goal options include car, house/major purchase, save more, reduce expenses, understand spending, emergency fund, reduce debt and other.

Expense planning categories include housing, groceries, transport, utilities, telecom/internet, health, education, entertainment, shopping and other.

### Telegram onboarding
Telegram onboarding is a shorter five-screen flow. It collects preferred name and financial goals. Goals include tracking expenses, saving more, reducing debt, understanding spending, building an emergency fund, saving for a large purchase/trip, balancing cash flow and improving financial habits. A no-specific-goal option is supported.

### Profile settings
Settings displays name/account information, indicates Telegram-linked accounts, edits first/last name, links to categories/imports/budgets/AI and provides logout. No user-facing email/password change flow was found.

## 6. Dashboard

Primary implementation: src/components/prototype/UzHamyonPrototypeApp.tsx  
Route: /dashboard

### Financial hero card
Displays:
- Current balance.
- Selected month's income.
- Selected month's expenses.
- Label that balance is calculated from the financial start date.

The prototype calculates current balance as lifetime income minus lifetime expenses. Monthly totals are calculated from transactions in the selected month. Amounts are stored as positive magnitudes; type determines direction.

### Cash-flow chart
- Groups the selected month into week-like day ranges.
- Shows income and expenses separately.
- Tapping a week highlights it and updates the selected-week summary.
- Month arrows move only between months containing transactions.

### Recent activity
Shows up to five newest transactions in the selected month. Each row displays category icon, description, category, date and amount. Selecting a row opens edit mode. “Barchasi” navigates to Activity.

### AI recommendation card
The prototype calculates the leading expense category and its percentage of monthly expenses. It displays a deterministic summary and a link to open AI. This card is not necessarily a generative AI answer.

### Goals and budgets summaries
Goals show name, saved amount, target amount, percentage and progress bar. Budget cards show category, spent amount, limit, percentage used and remaining/over-limit message.

Budget visual thresholds:
- Under 80%: on track.
- 80% to under 100%: near limit.
- 100% or more: over budget.

## 7. Transactions and Activity

Primary implementation: shared prototype transaction sheet and /api/transactions service.  
Route: /transactions

### Create transaction
Fields and behaviour:
- Type: income or expense.
- Amount: required, positive number.
- Description/title: required.
- Category: automatically predicted from title by default.
- Category can be manually changed.
- Date defaults to current local date.
- Time defaults to current local time.
- Date/time controls can be expanded and edited.
- “Hozirgi vaqtga sozlash” resets date/time to current local values.
- Save is disabled when required values are invalid or date is outside allowed bounds.

The main prototype sends UZS for its standard quick transaction flow.

### Automatic category prediction
The UI uses predictCategoryFromTitle and category-matching helpers. It shows “AI Kategoriya (avtomatik)” when automatic classification is active.

User can accept the prediction, open category picker, select a manual category, or return to automatic prediction. Predicted categories are mapped to database categories compatible with the transaction type.

This is a local rule-based helper, distinct from Gemini/OpenRouter conversational AI.

### Edit and delete
Selecting a transaction opens the same sheet in edit mode. It pre-fills type, amount, category, description, date and time. Save uses PUT /api/transactions/{id}. Delete requires confirmation. Successful writes refresh data and invalidate financial caches. A synchronous in-flight guard prevents accidental double submission.

### Activity list
- Displays selected-month transactions.
- Groups rows by date.
- Sorts newest first.
- Searches description and category.
- Filters All, Income and Expense.
- Selecting a row opens edit mode.
- Includes empty and no-results states.

### Transaction validation
Server-side Zod schema enforces:
- Description length 1–255.
- Positive amount, max two decimal places.
- Type income or expense.
- Three-letter uppercase currency, default UZS.
- Real calendar date YYYY-MM-DD.
- Optional valid time.
- Optional category UUID.
- Optional merchant up to 255 characters.
- Optional notes up to 1,000 characters.
- Source manual, csv, excel or recurring.

Service:
- Requires authenticated user.
- Verifies category exists and is system-owned or user-owned.
- Verifies category type matches transaction type.
- Sets user_id server-side.
- Updates profiles.financial_start_date when a new transaction is earlier.
- Supports list, fetch one, update and delete.
- Filters by date range, type, category, search; supports sorting/pagination.
- Caps page size at 100 and uses deterministic sort tie-breakers.

Transaction source values include manual, csv, excel and recurring. A complete recurring scheduler was not verified.

## 8. Tahlil / Financial analytics

Primary implementation: Tahlil tab in shared prototype.  
Route: /analytics

### Prototype analytics UI
- Selected-month income and expenses.
- Weekly expense dynamics.
- Selected-week expense amount.
- Expense category breakdown sorted by descending amount.
- Top four categories shown individually; remaining categories grouped as “Boshqalar”.
- Amount, percentage and progress bar per category.
- Budget summary in the same analytics section.
- Goals available through the goals subtab.

### Analytics service
The separate analytics service supports query inputs:
- startDate
- endDate
- currency
- interval: day, week or month

It computes:
- Total income.
- Total expenses.
- Net cash flow.
- Savings rate.
- Transaction count.
- Average transaction amount.
- Expense and income category breakdowns.
- Trend buckets.
- Current-vs-previous-period comparisons for income, expenses and net.
- Largest expenses and largest income transactions.

Default date range is the current month. Currency can be inferred from latest transaction if not explicitly supplied. Service respects financial_start_date and returns zero-state data for windows before it.

**UI/API distinction:** the analytics service supports richer comparisons and trends than the primary prototype Tahlil screen visibly renders. A separate AnalyticsView exists; verify intended canonical experience before claiming every service metric is visible.

## 9. Budgets

Primary route: /budgets opens Tahlil in shared prototype.  
Secondary component: BudgetsManager.

### Budget model
- Name.
- Optional category.
- Amount/limit.
- Currency.
- Period type: monthly, weekly or custom.
- Start date.
- End date.

### Budget progress
Service calculates spent amount from expense transactions matching currency and date window, with optional category filter. It calculates remaining amount and percentage used.

Statuses:
- on_track
- near_limit at 80% or more
- over_budget at 100% or more

### Budget actions
Create, list, fetch one, update, delete and refresh. Separate manager displays total planned budget, spent and remaining metrics. Service checks overlapping budgets for same user, currency, category and date window.

### Prototype budget sheet
The main prototype form uses expense category and monthly limit. It creates a monthly budget for the currently selected month, with first/last day as bounds. It supports editing and deletion.

## 10. Savings goals

Primary route: /goals opens goals subtab inside Tahlil.  
Secondary component: GoalsManager.

### Goal model
- Name.
- Target amount.
- Current amount.
- Currency.
- Optional target date.
- Tracking strategy: manual, category_linked or account_linked.
- Status: in_progress, completed or cancelled.

### Goal list and summary
Separate manager supports filters All, In progress and Completed, and summary metrics for total saved, total target and remaining amount. Prototype shows each goal's saved amount, target amount and percentage.

### Create/edit
Fields: name, target amount, initial current amount in separate manager, optional target date and status when editing. Relevant UI defaults currency to UZS.

### Contributions and withdrawals
ContributeModal supports deposit/add and withdraw, amount and optional note. Withdrawals are sent as negative contribution values. Server validates non-zero amount and goal service/database prevent invalid negative saved totals.

### Goal feasibility
Service calculates historical monthly net cash flow, average income/expense, average net savings, active months, remaining target and months until target date. Feasibility statuses:
- feasible
- challenging
- unlikely
- not_applicable

GoalAIFeedbackModal presents a status and recommendation selected from computed feasibility. Its displayed recommendation is not necessarily a live LLM response.

## 11. Categories

Route: /categories  
Component: CategoriesManager

### System categories
Shared read-only categories are stored with is_system=true and no user owner.

Expense categories in translation map:
- Housing / Rent
- Utilities
- Groceries
- Dining Out
- Transportation
- Healthcare
- Entertainment
- Shopping
- Education
- Personal Care
- Miscellaneous

Income categories:
- Salary
- Freelance / Consulting
- Investments
- Gifts & Grants
- Other Income

### Custom categories
Users can create custom categories with name, type, optional description, icon and hex colour.

UI includes total/expense/income counts, All/Expense/Income filters, custom category list, create/edit/delete, system category list, empty states and notifications.

System categories cannot be edited/deleted by ordinary users. Service checks ownership and system status. Unique database indexes prevent duplicate category names of the same type within system/user scope.

### Category integrity
Transaction category must be system-owned or belong to the authenticated user. Category type must match transaction type. Database triggers enforce cross-reference ownership.

## 12. AI assistant

Primary UI: AI tab in shared prototype.  
API: POST /api/ai/advisor  
Service: src/lib/ai/advisorService.ts

### Conversational Q&A
Suggested prompts include:
- How much did I save compared with last month?
- How can I reduce food expenses?
- Can I reach my annual savings goal?
- Which category did I overspend in?

Interface includes empty hero, suggested prompt cards, input, send, user/assistant bubbles, typing indicator, error/retry, history view and new conversation action.

### Verified financial context
Server does not trust client-supplied financial facts. It gathers profile planning values, transactions, categories, budgets and goals for the authenticated user.

It calculates lifetime income/expenses, transaction count, monthly totals, category spending shares, largest expenses, month comparisons, small expense patterns, budget and goal context.

Declared onboarding values are explicitly labelled planning estimates, not actual transactions or verified balance.

### AI provider routing
- Tries direct Gemini when GEMINI_API_KEY is configured.
- Falls back to OpenRouter when configured.
- Uses OPENROUTER_MODEL, defaulting in code to google/gemini-2.5-flash.
- Has additional fallback model attempts including OpenAI and DeepSeek identifiers.
- Returns deterministic fallback when providers are unavailable or no key is configured.

Gemini structured JSON is also used for financial action extraction.

### Deterministic fallback
When AI generation is unavailable, a fallback answers a subset of questions from verified facts. With no transactions it explicitly says there is no recorded financial data and does not invent amounts.

### Conversation persistence caveat
Database tables ai_conversations and ai_messages exist. Advisor service creates/validates conversation, saves user message and assistant answer with evidence metadata. API exposes list and message retrieval.

However, the current main prototype chat handler manages local conversation state and does not visibly pass conversationId to the advisor endpoint. Backend persistence therefore does not prove the main UI's history is fully wired to persistent history. Verify before release.

## 13. AI financial actions and Telegram conversational input

This is distinct from ordinary Q&A.

### Natural-language input
Telegram bot accepts messages such as:
- “Tushlikka 45 000 so‘m ishlatdim”
- “Bozorlik 200 000 so‘m”
- “Taksiga 18 000 so‘m”
- “Oylik maoshim 5 000 000 so‘m tushdi”

Gemini structured JSON extraction classifies intent and extracts transaction/goal parameters.

### Intents
- action_proposal
- financial_query
- clarification
- casual_chat

### Supported extracted actions
- Create income transaction.
- Create expense transaction.
- Create savings goal.
- Update savings goal.
- Contribute to savings goal.

### Confirmation workflow
1. Parse message.
2. Extract proposed action(s).
3. Build Uzbek preview.
4. Save pending action.
5. Ask user to confirm or cancel.
6. Execute only after confirmation.
7. Report database-confirmed result.

Pending action expires after 15 minutes. Execution lock lasts two minutes to prevent duplicate concurrent execution. Store checks internal user and Telegram identity where present.

### Atomic execution
Migration 011 defines execute_pending_ai_action_atomic. It locks pending action, checks identity, status and expiry, prevents duplicate execution, recovers stale locks, executes all actions in one database transaction, rolls back all if any action fails, and stores final result/status.

Production requires migration and correct service-role/RPC configuration.

### Multiple action engines
Repository contains financialActionEngine.ts and Gemini action extraction/execution modules. Confirm final precedence and ensure all writes go through one audited confirmation path.

## 14. Insights / financial alerts

Route: /insights  
Component: InsightsFeed  
API: /api/ai/insights

The insights service scans recent transactions and active budgets to generate evidence-grounded records.

Insight types:
- spending_spike
- budget_alert
- savings_opportunity
- anomaly
- recurring_charge
- general

Statuses:
- new
- viewed
- dismissed
- resolved

Confidence:
- low
- medium
- high

UI supports fetch/filter by status, generate fresh insights, mark resolved, dismiss/hide, refresh and empty/healthy state.

The service is described as deterministic and evidence-grounded. Do not assume every insight is LLM-generated.

## 15. Spreadsheet and bank-statement import

Route: /imports  
Component: ImportManager  
API prefix: /api/imports

### Formats and limits
- CSV
- XLSX
- XLS
- Maximum file size: 10 MB

### Flow
1. Select file or drag into drop zone.
2. Server parses CSV or first worksheet.
3. Inspect headers.
4. Infer column mapping.
5. User can adjust mapping.
6. Normalise and validate rows.
7. Query existing transactions for duplicate detection.
8. Preview valid, invalid and duplicate rows.
9. Choose duplicate strategy.
10. Confirm import.
11. Insert valid rows and record job result.
12. Show imported/skipped counts and link to transactions.

### Mapping
Required: date, description, amount.  
Optional: type, category, merchant, notes.  
Defaults: expense type, USD currency, auto date format.

Header matching includes English, Uzbek and Russian keywords.

### Parser behaviour
- Excel serial dates.
- ISO-like dates.
- DD.MM.YYYY and slash-separated date formats.
- Positive/negative amounts.
- Parentheses for negative numbers.
- Currency symbols and common currency labels.
- Explicit transaction type columns.
- Sign-based type inference when type is absent.
- Decimal comma handling.
- Header-based mapping.

### Duplicate strategy
- skip
- import_all

The service compares date, amount, description and type over the relevant date range to identify likely duplicates.

### Security
Formula-injection sanitisation is present. Route checks extension and size. Import jobs and transactions are user-scoped. Database triggers verify import-job ownership.

### Provider caveat
UI copy mentions Humo, Uzcard, Click, Payme, Ipak Yo‘li and Kapitalbank. Reviewed implementation is a generic CSV/Excel parser, not verified direct bank API connectivity. Treat these names as statement/export sources only where their files match parser/mapping.

## 16. Telegram bot and notifications

### Bot capabilities
- Send Telegram messages.
- Send WebApp buttons.
- Send inline callback buttons.
- Acknowledge callback queries.
- Edit messages.
- Set chat menu button to open Mini App.
- Resolve Telegram users to Supabase sessions.
- Process messages and callback queries.
- Handle action confirmation/cancellation.
- Answer financial questions through advisor service.

Default Mini App URL in code is https://uzhamyon.vercel.app/, overridable by TELEGRAM_MINIAPP_URL.

### Webhook
Route: /api/telegram/webhook

It accepts Telegram updates, validates update ID, optionally checks webhook secret, claims update before processing, skips duplicate/concurrent updates, marks success/failure and distinguishes transient errors from permanent errors.

Migration 010 creates persistent webhook tracking. Memory fallback exists for tests/offline conditions but is not durable across serverless instances.

### Daily reminder
Route: /api/telegram/reminders  
Vercel cron schedule: 0 15 * * * UTC, intended as 20:00 Asia/Tashkent.

Reminder:
- Fetches registered Telegram users.
- Builds personalised Uzbek message.
- Reminds user to record income/expenses.
- Provides natural-language examples.
- Adds Mini App open button.
- Tracks sent, blocked and failed results.
- Pauses between messages to respect Telegram rate limits.

The GET endpoint also exposes diagnostic recipient information when not triggered for execution. Review whether that should be protected or redacted in production.

## 17. Data model

Core financial schema is created in supabase/migrations/007_spendsense_financial_schema.sql, with later migrations extending profile/onboarding state, financial timeline, webhook idempotency and pending AI actions.

| Table | Purpose | Main fields |
|---|---|---|
| profiles | User profile and onboarding | id, names, email, onboarding fields, declared income/expenses, financial start date |
| categories | System and user categories | id, user_id, name, type, description, icon, color, is_system |
| transactions | Income and expense records | id, user_id, category_id, description, amount, currency, type, transaction_date, merchant, notes, source, import_job_id |
| budgets | Spending limits | id, user_id, category_id, name, amount, currency, period_type, start_date, end_date |
| financial_goals | Savings targets | id, user_id, name, target_amount, current_amount, currency, target_date, tracking_strategy, status |
| import_jobs | Import history | id, user_id, filename, status, row counters, error_summary |
| insights | Financial alerts | id, user_id, type, title, explanation, status, confidence, evidence metadata, period |
| ai_conversations | AI conversation headers | id, user_id, title, timestamps |
| ai_messages | User/assistant messages | id, conversation_id, user_id, role, content, evidence references |
| pending_ai_actions | Confirmable AI actions | action ID, user/Telegram IDs, actions JSON, preview, status, expiry and execution lock |
| telegram_webhook_updates | Update deduplication | update ID, chat/user IDs, status and timestamps |

### Financial amount semantics
Transaction amounts are positive magnitudes. Direction is determined by type income/expense. Currency is a three-letter uppercase code. UZS is the main UI default, while schema/services support other currencies.

### Profile planning data
- declared_monthly_income
- declared_monthly_expenses
- target_expense_reduction_percent
- target_monthly_expenses
- onboarding_completed
- onboarding_step
- onboarding_data
- financial_start_date

Planning values must remain separate from transaction-derived actuals.

### Integrity and RLS
Schema defines unique category indexes, positive transaction amount constraints, budget date-range constraints, goal amount constraints, user ownership immutability triggers, category/import-job cross-reference checks, AI message/conversation ownership checks and updated_at triggers.

Financial tables enable RLS. Policies restrict records to the authenticated owner, while system categories are shared/readable. RLS must remain enabled in production.

## 18. API endpoint inventory

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/telegram | Verify initData and establish Supabase session |
| GET | /api/transactions | List with filters, sorting and pagination |
| POST | /api/transactions | Create transaction |
| GET | /api/transactions/{id} | Fetch transaction |
| PUT | /api/transactions/{id} | Update transaction |
| DELETE | /api/transactions/{id} | Delete transaction |
| GET | /api/analytics | Deterministic analytics |
| GET | /api/budgets | List budgets with progress |
| POST | /api/budgets | Create budget |
| GET | /api/budgets/{id} | Fetch budget |
| PUT | /api/budgets/{id} | Update budget |
| DELETE | /api/budgets/{id} | Delete budget |
| GET | /api/goals | List goals |
| POST | /api/goals | Create goal |
| GET | /api/goals/{id} | Fetch goal |
| PUT | /api/goals/{id} | Update goal |
| DELETE | /api/goals/{id} | Delete goal |
| POST | /api/goals/{id}/contributions | Add/withdraw goal contribution |
| GET | /api/categories | List categories; optional type filter |
| POST | /api/categories | Create custom category |
| GET | /api/categories/{id} | Fetch category |
| PUT | /api/categories/{id} | Update custom category |
| DELETE | /api/categories/{id} | Delete custom category |
| POST | /api/ai/advisor | Ask financial question or simulate budget scenario |
| GET | /api/ai/conversations | List AI conversations |
| GET | /api/ai/conversations/{id} | Fetch conversation messages |
| GET | /api/ai/insights | List insights; optional status filter |
| POST | /api/ai/insights | Generate/save insights |
| PUT | /api/ai/insights/{id} | Update insight status |
| POST | /api/imports/preview | Preview spreadsheet import |
| POST | /api/imports/commit | Commit validated rows |
| GET | /api/imports/jobs | List import jobs |
| GET | /api/imports/jobs/{id} | Fetch import job |
| GET/POST | /api/telegram/reminders | Diagnostics or trigger reminder broadcast |
| POST | /api/telegram/webhook | Receive Telegram bot updates |
| GET | /api/telegram/webhook | Webhook service status |
| GET | /api/timeline/available-months | User transaction-derived timeline |

Advisor simulation mode accepts action=simulate, categoryName and percentageReduction. It returns a simulation, not an executed transaction.

## 19. Architecture and technology

### Frontend
- Next.js App Router.
- React interactive client components.
- TypeScript.
- Tailwind CSS and custom CSS.
- Inter typography.
- Lucide icons.
- Zod validation.
- Shared Bento components, page headers, skeletons, modals and number inputs.

### Backend
- Next.js route handlers.
- Server-side service modules in src/lib.
- Supabase Auth and Postgres.
- Supabase SSR client.
- Supabase RLS and database triggers.
- Telegram Bot API via server-side HTTP requests.

### AI
- Google Gemini API.
- OpenRouter fallback.
- Structured JSON extraction.
- Deterministic financial calculations and fallback answers.
- Pending-action confirmation and execution.
- Evidence references stored with assistant messages.

### Hosting/operations
- Vercel deployment is implied by vercel.json and default Mini App URL.
- Vercel Cron invokes daily reminder endpoint.
- Production environment variables and Supabase migrations are required.

### Key repository paths
| Path | Responsibility |
|---|---|
| src/app/ | Pages and API routes |
| src/components/prototype/UzHamyonPrototypeApp.tsx | Main shared finance UI |
| src/components/transactions/ | Dedicated transaction components |
| src/components/analytics/ | Analytics/Tahlil components |
| src/components/goals/ | Goal manager and modals |
| src/components/budgets/ | Budget manager and modal |
| src/components/categories/ | Category manager, icons and prediction |
| src/components/imports/ | Import UI |
| src/components/ai/ | AI chat and insights UI |
| src/components/onboarding/ | Onboarding flows |
| src/components/telegram/ | Telegram Mini App initialisation |
| src/lib/transactions/ | Transaction schema/service |
| src/lib/analytics/ | Analytics schema/service |
| src/lib/goals/ | Goal schema/service |
| src/lib/budgets/ | Budget schema/service |
| src/lib/categories/ | Category schema/service/prediction |
| src/lib/imports/ | Spreadsheet parser/validation/service |
| src/lib/ai/ | AI provider/advisor/action extraction/execution |
| src/lib/telegram/ | Bot/auth/reminders/webhook idempotency |
| src/lib/supabase/ | Supabase clients/config |
| supabase/migrations/ | Database schema and policies |
| tests/ | Automated tests |
| scripts/ | Operational scripts |

## 20. Environment configuration

Variables referenced in source:

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Public Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Public Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Server-only privileged Supabase access |
| TELEGRAM_BOT_TOKEN | Telegram API and initData verification |
| TELEGRAM_BOT_USERNAME | Bot username for sign-in deep link |
| NEXT_PUBLIC_TELEGRAM_BOT_USERNAME | Public bot username fallback |
| TELEGRAM_MINIAPP_URL | Mini App URL used by bot |
| TELEGRAM_WEBHOOK_SECRET | Optional webhook secret |
| CRON_SECRET | Optional Vercel cron bearer secret |
| GEMINI_API_KEY | Direct Gemini provider key |
| OPENROUTER_API_KEY | OpenRouter fallback key |
| AI_API_KEY | Alternative OpenRouter-compatible key |
| OPENROUTER_MODEL | Preferred OpenRouter model identifier |

Never commit actual secrets. A public anon key is not a service-role secret, but production should use correct environment configuration. Never expose service-role key or bot token to client code.

## 21. MVP roadmap

The roadmap below groups repository capabilities into sensible product releases. It is recommended sequencing, not proof of historical release order.

### MVP 1 — Core personal finance
Goal: user can securely enter UzHamyon, record transactions and understand basic balance.

Scope:
- Telegram Mini App launch and Telegram-only auth.
- Supabase user profile.
- Basic onboarding and preferred name.
- Dashboard balance.
- Monthly income/expense totals.
- Create/edit/delete income and expense.
- System categories.
- Automatic title-based category suggestion.
- Activity list.
- Search and income/expense filters.
- Month navigation.
- Weekly cash-flow visualisation.
- Empty/error states and logout.

Acceptance:
- Unauthenticated users cannot access protected finance pages.
- Telegram initData is cryptographically verified.
- Users can only access their own transactions.
- Saved transactions update balance and totals.
- Edit/delete refreshes totals.
- UI does not report success before database confirmation.

### MVP 2 — Financial planning and control
Goal: users can interpret spending, create limits and track savings targets.

Scope:
- Expanded financial onboarding.
- Category analytics and period trends.
- Income/expense breakdown.
- Budget CRUD and progress.
- Budget threshold states and overlap protection.
- Savings goals CRUD.
- Contributions and withdrawals.
- Goal feasibility.
- Custom categories.
- CSV/XLS/XLSX import preview.
- Column mapping and duplicate detection.
- Import commit and job history.
- Profile edit and settings.

Acceptance:
- Budget totals use matching expense transactions, currency and date range.
- Goal progress reflects persisted amounts.
- Withdrawals cannot create negative saved balance.
- Import preview shows errors before commit.
- Duplicate strategy is explicit.
- Imported rows are owned by authenticated user.
- Custom categories cannot be used by another user.

### MVP 3 — AI and Telegram automation
Goal: users ask questions and record financial actions conversationally with explicit confirmation.

Scope:
- AI financial Q&A grounded in verified context.
- Deterministic fallback answers.
- AI conversation/message persistence.
- Financial insights.
- Budget scenario simulation.
- Telegram bot and Mini App menu button.
- Natural-language transaction extraction.
- Multi-action extraction.
- Goal creation/update/contribution through AI.
- Clarification questions.
- Pending-action preview and confirm/cancel.
- Atomic execution.
- Webhook deduplication.
- Daily transaction reminders.

Acceptance:
- AI uses authenticated user's context only.
- AI does not invent financial figures.
- Proposed financial writes require confirmation.
- Expired/cancelled actions cannot execute.
- Duplicate webhook updates cannot execute twice.
- Multi-action execution is atomic.
- Reminder endpoint is protected by production secrets.

### Post-MVP recommendations
Not verified as implemented:
- Recurring transaction schedules.
- Multiple wallets/accounts.
- Direct bank/provider sync.
- Trusted live FX rates and conversion.
- PDF/Excel exports.
- Notification preferences and opt-out.
- Advanced forecasting.
- Shared household budgets.
- Debt/loan tracking.
- Subscription tracking.
- Account data export/deletion workflow.
- Admin dashboard and monitoring.
- AI safety evaluation and cost controls.

## 22. Edge cases and business rules

### Transactions
- Amount > 0, maximum two decimals.
- Description mandatory.
- Type income/expense only.
- Category type must match transaction type.
- Date must be a real calendar date.
- Page size capped at 100.
- Date range start cannot exceed end.
- Search sanitised before query construction.
- user_id is assigned server-side.
- Month selector only shows months with actual transactions.

### Budgets
- Positive amount.
- End date cannot precede start date.
- Three-character currency.
- Category must be system or user-owned.
- Overlapping budgets checked by user/currency/category/window.
- Spending includes expenses only.

### Goals
- Positive target.
- Current amount non-negative.
- Contribution cannot be zero.
- Withdrawal cannot reduce saved amount below zero.
- Status in_progress/completed/cancelled.
- Target date optional.

### Imports
- CSV/XLSX/XLS only.
- 10 MB maximum.
- Empty/malformed files rejected.
- Date/description/amount required.
- Invalid rows not committed.
- Duplicate strategy explicit.
- Formula-triggering values sanitised.

### AI actions
- Proposal is not execution.
- Confirmation/cancellation explicit.
- 15-minute expiry.
- Two-minute execution lock.
- User and Telegram identity checked.
- Atomic database execution required.
- Client-supplied financial context is not authoritative.

### Telegram webhook
- Update ID required.
- Optional secret checked.
- Duplicate/concurrent updates skipped.
- Transient errors retryable.
- Permanent errors acknowledged to avoid endless retries.

## 23. Repository audit findings and implementation risks

These are code-level items to verify, not all confirmed production bugs.

### 23.1 Large monolithic main UI
UzHamyonPrototypeApp.tsx contains navigation, Dashboard, Activity, Analytics, Goals, Budgets, AI and modal sheets in one large client component.

Risk: changes to one area can affect unrelated tabs; testability/maintainability reduced.

Recommendation: split into DashboardTab, ActivityTab, AnalyticsTab, GoalsTab, AIAssistantTab, TransactionSheet, BudgetSheet, GoalSheet, ContributionSheet, MonthPicker and shared data hooks.

### 23.2 Two generations of UI components coexist
Dedicated GoalsManager, BudgetsManager, AnalyticsView, TahlilHub, AIAdvisorChat, TransactionsManager and transaction modals coexist with the prototype component.

Recommendation: identify one canonical implementation per feature, verify imports/tests, then remove unused code only after reference checks.

### 23.3 Demo mode isolation
/prototype enables demo fallback and contains hard-coded demo transactions, budgets and goals. Authenticated routes disable demo fallback.

Recommendation: keep demo mode explicit, labelled and isolated from production user data.

### 23.4 AI chat history wiring
Backend persists conversations/messages and exposes list/retrieval endpoints. Main prototype chat manages local conversation state and does not visibly pass conversationId to advisor endpoint.

Recommendation: load /api/ai/conversations, pass active conversation ID to POST /api/ai/advisor, fetch messages when opening a conversation, and add reload-persistence tests.

### 23.5 Transaction time semantics
Transaction schema accepts transaction_time. Service maps it into created_at on insert, while core transactions table has no dedicated transaction_time column. Prototype API mapper does not visibly restore a separate time field.

Recommendation: decide whether transaction time is first-class. If yes, add a dedicated column or define a consistent timestamp/timezone contract. Test Tashkent local time and UTC conversion.

### 23.6 Currency defaults differ
Some database definitions default to USD, while main prototype and management UIs commonly use UZS. Import mapping defaults to USD.

Recommendation: establish UZS as product default and align schema defaults, imports, API validation and forms. Never mix different currencies in one total without conversion.

### 23.7 SSR hydration and client re-fetch
Some route pages hydrate up to 300 transactions, budgets and goals, then prototype loads session and re-fetches transactions paginated.

Risk: duplicate network work and data snapshot differences.

Recommendation: standardise initial data contract and cache invalidation; keep pagination without redundant first-load requests.

### 23.8 Budgets/goals are navigation aliases
/budgets and /goals render shared prototype with Tahlil selected, not dedicated manager pages. Separate manager components also exist.

Recommendation: decide whether these are separate destinations or Tahlil tabs and align routes, page titles, navigation and deep links.

### 23.9 Legacy migration history
Migration 001 is labelled as a homework-management schema with teacher/student/task tables. Financial schema appears in migration 007. This suggests reused/legacy migration history.

Recommendation: do not rewrite applied migrations casually. Verify production migration history and create any clean baseline only through controlled database migration plan.

### 23.10 Production dependencies not proven by source
Source cannot prove Telegram token validity, webhook registration, Supabase config, applied migrations, AI keys/quotas, cron activation, live RLS state, reminder delivery or production performance.

### 23.11 Reminder diagnostic exposure
Reminders GET can return registered Telegram recipient details when not triggered for execution. Confirm production access is restricted or recipient details are removed from public diagnostics.

### 23.12 AI write safety
Deterministic and Gemini action engines coexist. Confirm routing precedence and ensure every financial write uses one audited confirmation/execution path. A model response alone must never claim a transaction is saved.

## 24. Tests and quality assurance

Repository test files cover:
- Telegram auth/browser flow.
- Telegram integration/security/reliability.
- AI advisor pipeline.
- AI financial actions.
- Gemini action execution.
- Transactions.
- Categories.
- Analytics.
- Budgets.
- Goals and savings calculations.
- Imports.
- Onboarding.
- Calendar/month selector.
- Balance calculations.
- Date/time validation.
- Mobile modal scroll.
- Navigation and SSR.

Package scripts include:
- npm test
- npm run test:integration
- npm run test:all
- npm run build
- npm run lint

**Execution status:** tests were not executed as part of this source review. Test file presence does not prove current branch passes. Run CI/local tests with correct environment before release.

## 25. Release checklist

### Product
- [ ] Confirm canonical UI implementation for each feature.
- [ ] Verify first-time and returning Telegram onboarding.
- [ ] Verify empty/loading/error states.
- [ ] Confirm UZS and multi-currency rules.
- [ ] Verify AI history persistence.
- [ ] Verify budget/goal deep links.
- [ ] Verify insight generation/status changes.
- [ ] Verify import formats and duplicate handling.

### Security
- [ ] Verify Telegram initData HMAC.
- [ ] Keep service-role key and bot token server-only.
- [ ] Verify RLS on all financial tables.
- [ ] Verify ownership checks on writes.
- [ ] Verify webhook secret.
- [ ] Verify cron secret.
- [ ] Restrict reminder diagnostics.
- [ ] Verify pending-action identity/expiry.
- [ ] Verify atomic RPC and least-privilege permissions.

### Data
- [ ] Apply/verify migrations 007–011 as required.
- [ ] Confirm production migration history.
- [ ] Verify system category seeds.
- [ ] Verify financial_start_date.
- [ ] Verify no currency mixing.
- [ ] Verify withdrawals cannot make goal balance negative.
- [ ] Verify import job ownership.

### Operations
- [ ] Set required environment variables.
- [ ] Register Telegram webhook.
- [ ] Verify bot username and Mini App URL.
- [ ] Verify Vercel cron schedule.
- [ ] Run build and lint.
- [ ] Run unit and integration suites.
- [ ] Test real Telegram Mini App on iOS and Android.
- [ ] Test slow network, expired sessions and webhook retries.
- [ ] Monitor AI failures and cost.

## 26. Source files reviewed

The review included, among others:
- src/app route pages and API handlers.
- src/components/prototype/UzHamyonPrototypeApp.tsx.
- Navigation, Telegram initialisation and onboarding components.
- Category, import, insight, budget and goal components.
- Transaction, analytics, goal, budget, category and import services/schemas.
- AI advisor, provider client, action extraction, pending-action store and executor.
- Telegram auth, bot, reminders and webhook idempotency.
- Supabase server/client/config and proxy.
- Supabase migrations 001–011.
- package.json, README.md, vercel.json and tests directory.

## 27. Final product definition

UzHamyon is a Telegram-first personal finance application with a transaction ledger at its core. Its value is to make financial recording easy, convert transaction history into useful analysis, help users set budgets and savings goals, and provide a conversational AI layer that explains the user's own financial data and proposes confirmed actions.

The product trust model depends on three principles:

1. **Recorded data is the source of truth.** Balances, charts and AI facts derive from persisted transactions and clearly labelled planning estimates.
2. **The user owns every financial write.** Manual actions require explicit save; AI-proposed actions require explicit confirmation.
3. **Each user's financial data is isolated.** Authentication, server-side ownership checks, RLS and database constraints must remain in place.

This document separates code-backed functionality from recommendations and items requiring production verification. Update it whenever routes, schema, AI action pipeline or Telegram integration change.
