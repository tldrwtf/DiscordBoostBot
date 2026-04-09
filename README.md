# Discord Boost Bot Documentation

## Overview
This bot is a guild-only Discord order system for boosting services. It is built with TypeScript, `discord.js` v14, and SQLite, and it is designed to move an order from a public product panel to a private ticket, then through payment confirmation, booster assignment, proof-based completion, and final closure.

The codebase is currently structured around a single interaction router in `src/interactionHandler.ts`, a product/pricing source of truth in `src/catalog.ts`, a pricing engine in `src/pricing.ts`, and a synchronous SQLite repository in `src/db/ordersRepository.ts`.

## Tech Stack
- Node.js 25+
- TypeScript with `NodeNext` module resolution
- `discord.js` v14
- `dotenv`
- `node:sqlite` via `DatabaseSync`
- `tsx` for development execution

## Project Structure
- `src/index.ts`: bot startup, client initialization, command registration on ready, and global interaction error handling
- `src/interactionHandler.ts`: all slash command, button, select menu, modal, and context menu logic
- `src/catalog.ts`: product definitions, panel content, promo image mapping, rank/package/trophy configuration
- `src/pricing.ts`: quote engine and validation logic
- `src/components.ts`: Discord component builders and custom IDs
- `src/embeds.ts`: embed and attachment builders for public panels, wizard previews, tickets, claims, and completed jobs
- `src/config.ts`: `.env` loading and runtime config validation
- `src/permissions.ts`: role-based authorization checks
- `src/db/ordersRepository.ts`: SQLite schema and order/audit log persistence
- `src/draftStore.ts`: in-memory ephemeral wizard state per user
- `promo_images/`: images used for public product panels and ticket summaries

## First-Time Setup Guide
This section is written for someone who has never created or run a Discord bot before.

### Step 1: Install the required tools
1. Install Node.js `25` or newer.
2. Install Git if you want to clone the repository instead of downloading it as a ZIP.
3. Make sure you have a Discord account with permission to manage the server where the bot will run.

### Step 2: Create the Discord application
1. Open the Discord Developer Portal.
2. Click **New Application**.
3. Enter a name for the bot application and create it.
4. Open the application after it is created.
5. In **General Information**, copy the **Application ID**. You will use this later as `DISCORD_CLIENT_ID`.

### Step 3: Add the bot user and copy the token
1. Open the **Bot** tab in the Developer Portal.
2. If the application does not already have a bot user, click **Add Bot**.
3. In the bot settings, reset or copy the bot token.
4. Store that token safely. You will place it in `.env` as `DISCORD_TOKEN`.

### Step 4: Enable the required Discord settings
1. In the **Bot** tab, enable **Message Content Intent**.
2. Leave the bot configured for guild/server usage. This project is designed for servers, not for direct messages.
3. Save the changes before leaving the page.

Why this matters:
- The bot listens for proof images posted directly in ticket messages.
- Without **Message Content Intent**, Discord may not provide the message data the bot needs for attachment-based proof handling.

### Step 5: Invite the bot to your Discord server
1. Use the application's install flow in the Developer Portal to generate an invite link for the bot.
2. Choose the server where you want the bot to live.
3. Authorize the bot.
4. Make sure the bot can:
   - view channels
   - send messages
   - read message history
   - attach files
   - embed links
   - create and manage ticket channels

For a first setup, giving the bot broad server permissions is the simplest option. You can tighten them later once the flow is working.

### Step 6: Prepare the Discord server itself
Create or choose the following Discord objects before starting the bot:
- One public text channel where staff can deploy product panels
- One category for private order tickets
- One text channel for booster claim posts
- One text channel for completed job logs
- Optionally one text channel for audit logs
- One support role
- One manager role
- One admin role
- One booster role

### Step 7: Turn on Developer Mode and collect IDs
1. In the Discord client, enable **Developer Mode**.
2. Copy the server ID for the target server.
3. Copy the ID of each required channel and category.
4. Copy the ID of each required role.

You will need these values for the `.env` file.

### Step 8: Download the project
1. Clone the repository or download it as a ZIP.
2. Open a terminal in the project folder.
3. Run:

```powershell
npm.cmd install
```

### Step 9: Create the `.env` file
1. Copy `.env.example` to `.env`.
2. Fill in every required value.

Required values:
- `DISCORD_TOKEN`: bot token from the Developer Portal
- `DISCORD_CLIENT_ID`: application ID from the Developer Portal
- `DISCORD_GUILD_ID`: Discord server ID where the bot will run
- `ORDER_HERE_CHANNEL_ID`: default public channel used when `/deploy-order-panel` is run without a channel argument
- `BOOST_TICKET_CATEGORY_ID`: category where private tickets are created
- `CLAIM_ORDERS_CHANNEL_ID`: channel where paid jobs are posted for boosters
- `COMPLETED_JOBS_CHANNEL_ID`: channel where completed orders are logged
- `SUPPORT_ROLE_ID`: support role ID
- `MANAGER_ROLE_ID`: manager role ID
- `ADMIN_ROLE_ID`: admin role ID
- `SERVER_BOOSTERS_ROLE_ID`: booster role ID

Optional values:
- `AUDIT_LOG_CHANNEL_ID`: channel for audit embeds
- `DATABASE_PATH`: SQLite file path, defaults to `./data/orders.sqlite`
- `EUR_TO_USD_RATE`: exchange rate used when the configured product currency is EUR

### Step 10: Verify the project before you run it
Run these commands from the project root:

```powershell
npm.cmd run check
npm.cmd run build
```

If either command fails, fix that problem before continuing.

### Step 11: Register the slash commands
Run:

```powershell
npm.cmd run register:commands
```

This registers the bot's guild-scoped slash commands for the server configured in `.env`.

Important:
- Re-run this command when slash command definitions change.
- Re-run this command when enabled products change and the available `/order` choices should update.

### Step 12: Start the bot
For development:

```powershell
npm.cmd run dev
```

For a built/runtime launch:

```powershell
npm.cmd run start
```

When the bot starts successfully, you should see:
- a login message
- the number of recovered active orders from SQLite

### Step 13: Deploy the bot for ongoing use
For a basic deployment:
1. Place the project on a machine that stays online.
2. Install Node.js `25` or newer on that machine.
3. Copy the project files and your `.env` file there.
4. Run `npm.cmd install`.
5. Run `npm.cmd run build`.
6. Run `npm.cmd run start`.

For long-term uptime:
- Configure your host or operating system to restart the bot automatically after a reboot or crash.
- Keep the `.env` file and `data/` directory persistent.
- Re-run `npm.cmd run register:commands` after command-definition changes.

### Step 14: Perform a first real test
1. Run `/deploy-order-panel` as staff.
2. Click the panel button or run `/order`.
3. Complete the selection flow and confirm a ticket is created.
4. Confirm payment as staff.
5. Search for a booster.
6. Claim the order as a booster.
7. Upload a proof image in the ticket or use **Submit Proof Link**.
8. Complete the order.
9. Confirm the completed job log is posted.
10. Close the ticket.

If those steps work, the bot is configured correctly enough for normal use.

## Required Environment Configuration
All runtime configuration comes from `.env`. Start by copying `.env.example` to `.env`.

Required keys:
- `DISCORD_TOKEN`: bot token
- `DISCORD_CLIENT_ID`: application/client ID
- `DISCORD_GUILD_ID`: target guild ID
- `ORDER_HERE_CHANNEL_ID`: fallback text channel used if `/deploy-order-panel` is run without a channel argument
- `BOOST_TICKET_CATEGORY_ID`: category where new private order tickets are created
- `CLAIM_ORDERS_CHANNEL_ID`: channel where paid jobs are posted for boosters to claim
- `COMPLETED_JOBS_CHANNEL_ID`: channel where completed jobs are logged
- `SUPPORT_ROLE_ID`: staff role with ticket/payment permissions
- `MANAGER_ROLE_ID`: additional staff role
- `ADMIN_ROLE_ID`: additional staff role
- `SERVER_BOOSTERS_ROLE_ID`: role allowed to claim jobs

Optional keys:
- `AUDIT_LOG_CHANNEL_ID`: if set, audit embeds are posted here for state transitions
- `DATABASE_PATH`: defaults to `./data/orders.sqlite`
- `EUR_TO_USD_RATE`: defaults to `1.08`, must be a positive number

Behavioral notes:
- `DISCORD_CLIENT_ID` also accepts `CLIENT_ID` as a fallback alias.
- `DISCORD_GUILD_ID` also accepts `GUILD_ID` as a fallback alias.
- `embedFooter` is hardcoded in code to `Elite Boosters`.
- `rootDir` is the current working directory and is used to resolve promo image files.

## Discord Server Setup
The bot expects the guild to have:
- One text channel for public product panels
- One category to hold private boost tickets
- One text channel for booster claim posts
- One text channel for completed job logs
- Optionally one text channel for audit log messages
- Three staff roles: support, manager, admin
- One booster role: server boosters

The bot should have permission to:
- View and send messages in all operational channels
- Create channels in the ticket category
- Manage channels and permission overwrites for tickets
- Manage messages in tickets
- Attach files and embed links

Developer Portal requirement:
- Enable the **Message Content Intent** for the application. The proof-upload listener relies on `MESSAGE_CREATE` attachment data, and Discord does not reliably include attachments for guild messages without that intent.

## Installation and Runtime Commands
Windows commands used in this repository:
- `npm.cmd install`
- `npm.cmd run dev`
- `npm.cmd run check`
- `npm.cmd run build`
- `npm.cmd run start`
- `npm.cmd run register:commands`

Recommended setup sequence:
1. Run `npm.cmd install`
2. Copy `.env.example` to `.env`
3. Fill every required ID and token
4. Run `npm.cmd run check`
5. Run `npm.cmd run build`
6. Run `npm.cmd run register:commands`
7. Run `npm.cmd run dev` or `npm.cmd run start`

Important:
- Re-run `npm.cmd run register:commands` whenever command definitions change.
- The command set is guild-scoped in `src/index.ts` and is registered on startup with `application.commands.set(commands, config.guildId)`.

## Command Surface
### Slash Commands
`/deploy-order-panel`
- Staff-only unless the member also has `ManageGuild`
- Arguments:
  - `service` (required): one enabled product from `src/catalog.ts`
  - `channel` (optional): target text channel
- Behavior:
  - Posts a product-specific public embed with the product image and a single button
  - Responds ephemerally to the command user with the deployment confirmation

`/order`
- Available to guild users
- Argument:
  - `service` (required): one enabled product from `src/catalog.ts`
- Behavior:
  - Starts the order wizard ephemerally with the product preselected

### User Context Menu
`Manage Order`
- Staff-only
- Run on a target user
- Shows an ephemeral embed summarizing that user’s active orders

## Startup Behavior
On startup, the bot:
1. Loads and validates environment configuration
2. Creates the SQLite repository and ensures tables exist
3. Creates the in-memory draft store
4. Logs in the Discord client
5. Registers the current command set for the configured guild
6. Reads active orders from SQLite
7. Attempts to re-sync each active ticket summary message

Current caveat:
- Ticket resync depends on guild channel cache lookups. If a relevant channel is not in cache, sync can fail until the channel is available in cache.
- The bot also listens to `messageCreate` so it can detect proof attachments posted directly in ticket channels.

## Public Panel Flow
Each product has its own public panel content defined in `src/catalog.ts`:
- `panelTitle`
- `panelDescription`
- `panelButtonLabel`
- `promoImagePath`

When a staff member runs `/deploy-order-panel service:<product>`:
1. The bot looks up the enabled product in the catalog
2. It builds a public embed using the product’s panel text
3. It attaches the product promo image from `promo_images/`
4. It posts a single product button whose custom ID includes the product ID

The public panel is not interactive beyond opening the order wizard. Pricing is not computed from the public embed; pricing comes from the quote engine inside the order flow.

## Ephemeral Order Wizard Flow
The order wizard is always ephemeral.

Entry points:
- Clicking a public product panel button
- Running `/order service:<product>`

Wizard state:
- Stored per user in `DraftStore`
- Drafts expire after 15 minutes of inactivity
- Drafts are reset when a user starts a fresh flow from a panel or `/order`

Wizard components are built from `src/components.ts`:
- Product select
- Service select: `Boost` or `Carry`
- Ranked profile select when applicable
- Current value select
- Desired value select
- Package select
- Numeric range modal trigger for trophy-based products

Wizard completion rules:
- Ranked products require:
  - service mode
  - profile when the product has more than one profile
  - current value
  - desired value
- Numeric range products require:
  - service mode
  - current value
  - desired value
- Breakpoint products require:
  - service mode
  - current value
  - desired value
- Package products require:
  - service mode
  - selected package

When the draft becomes complete:
1. The bot computes a quote
2. It creates a private ticket channel
3. It posts the ticket summary and action buttons
4. It writes the order to SQLite
5. It clears the draft
6. It edits the ephemeral interaction reply to point the user to the created ticket

### Numeric Modal Flow
Numeric range products use a modal instead of select menus.

Current implementation:
- This is used for `trophies`
- The user enters `current` and `desired` values in text inputs
- On submit, the values are validated by the pricing engine

## Private Ticket Creation
New ticket channels are created in `BOOST_TICKET_CATEGORY_ID`.

Ticket channel permissions:
- `@everyone`: denied `ViewChannel`
- Customer: allowed to view/send/read/attach/embed
- Support, manager, admin roles: allowed to view/send/read/attach/embed
- Bot user: allowed to view/send/read/attach/embed/manage channels/manage messages

Ticket metadata stored on creation:
- order ID
- customer snapshot
- product and service mode
- profile/package/current/desired selection data
- native subtotal and total
- USD total
- price breakdown
- promo image path

The first ticket message:
- Mentions the support role
- Includes the ticket summary embed
- Includes action buttons for staff and boosters

## Ticket Action Buttons
The ticket summary message always includes two rows of buttons.

Row 1:
- `Confirm Payment`
- `Search Booster`

Row 2:
- `Complete Order`
- `Submit Proof Link`
- `Close Ticket`

Enablement rules:
- `Confirm Payment`: enabled only in `AWAITING_PAYMENT`
- `Search Booster`: enabled only in `PAID`
- `Complete Order`: enabled only in `IN_PROGRESS`
- `Submit Proof Link`: enabled only in `IN_PROGRESS`
- `Close Ticket`: disabled only once the ticket is already `CLOSED`

## Order State Machine
The implemented order status flow is:

`AWAITING_PAYMENT -> PAID -> SEARCHING_BOOSTER -> IN_PROGRESS -> COMPLETED -> CLOSED`

There is also a `CANCELLED` status in types and filtering logic, but no current interaction flow writes that status.

### 1. Awaiting Payment
Initial state after ticket creation.

Allowed actor:
- Staff only for payment confirmation

### 2. Paid
Reached when staff clicks `Confirm Payment`.

Effects:
- `paid_at` is set
- ticket summary is refreshed
- audit log entry is written
- optional audit channel embed is posted

Allowed next actor:
- Staff only for booster search

### 3. Searching Booster
Reached when staff clicks `Search Booster`.

Effects:
- Claim message is posted in `CLAIM_ORDERS_CHANNEL_ID`
- Booster role is pinged
- Claim message ID is stored on the order
- ticket summary is refreshed
- audit log entry is written

Allowed next actor:
- Booster role members can claim

### 4. In Progress
Reached when a booster claims the order.

Effects:
- assigned booster ID and name snapshot are stored
- `assigned_at` is set
- ticket permission overwrite is added for the booster
- claim message is updated to show who claimed it
- ticket summary is refreshed
- an informational embed is posted in the ticket instructing the booster to upload proof or use the backup proof-link modal

### 5. Completed
Reached when the assigned booster or staff clicks `Complete Order` and proof is found.

Proof requirement:
- Proof can come from either:
  - the newest qualifying image attachment posted in the ticket by the assigned booster, with acting staff attachments also considered at completion time
  - a direct image URL submitted through the `Submit Proof Link` modal by the assigned booster or acting staff member
- Supported Discord image attachments posted by the assigned booster in an in-progress ticket are persisted immediately
- Proof links must be direct `http` or `https` image URLs ending in `png`, `jpg`, `jpeg`, `webp`, or `gif`
- Completion compares the saved proof record against the latest qualifying attachment and uses whichever one is newer
- If neither a qualifying attachment nor a saved proof link exists, completion is rejected

Effects:
- proof attachment URL is stored
- `completed_at` is set
- completed-job embed is posted to `COMPLETED_JOBS_CHANNEL_ID`
- ticket summary is refreshed
- audit log entry is written

### 6. Closed
Reached when staff clicks `Close Ticket`.

Effects:
- `closed_at` is set
- customer loses `ViewChannel`, `SendMessages`, and `AttachFiles`
- assigned booster, if present, also loses `ViewChannel`, `SendMessages`, and `AttachFiles`
- ticket is renamed with a `closed-` prefix if not already prefixed
- ticket summary is refreshed
- audit log entry is written

Operationally, closed tickets are intended to become staff-only archives.

## Booster Claim Flow
Booster claiming is driven from the claim channel, not from the ticket itself.

Claim post behavior:
- Sent to `CLAIM_ORDERS_CHANNEL_ID`
- Pings `SERVER_BOOSTERS_ROLE_ID`
- Shows customer, service, selection, USD total, and ticket link
- Includes a claim button

Claim rules:
- Only members with the booster role can claim
- Only orders in `SEARCHING_BOOSTER` can be claimed
- The repository update is conditional, so the first successful claimant wins

## Permissions Model
### Staff
Defined as any member with one of:
- `SUPPORT_ROLE_ID`
- `MANAGER_ROLE_ID`
- `ADMIN_ROLE_ID`

Staff can:
- deploy product panels
- use the `Manage Order` context menu
- confirm payment
- search for boosters
- complete any order
- close tickets

### Boosters
Defined as members with `SERVER_BOOSTERS_ROLE_ID`.

Boosters can:
- claim posted jobs
- complete an order only if they are the assigned booster

### Customers
Customers can:
- click public product panels
- use `/order`
- progress through the ephemeral wizard
- access and chat in their private ticket until it is closed

## Product Catalog and Pricing Rules
All pricing and product behavior comes from `src/catalog.ts` and `src/pricing.ts`.

### Shared Pricing Rules
- `Boost` uses the base subtotal
- `Carry` multiplies the native subtotal by `2`
- If the product currency is `USD`, USD total equals native total
- If the product currency is `EUR`, USD total is `nativeTotal * EUR_TO_USD_RATE`
- Missing or invalid price paths are rejected with an error; the bot does not estimate prices

### Ranked
Selection mode:
- `ranked`

Profiles:
- `Diamond to Mythic`
- `Mythic to Pro`

Diamond to Mythic path:
- `Diamond 1 -> Diamond 2`: 3 EUR
- `Diamond 2 -> Diamond 3`: 3 EUR
- `Diamond 3 -> Mythic 1`: 3 EUR

Diamond to Mythic options:
- `Diamond 1`
- `Diamond 2`
- `Diamond 3`
- `Mythic 1`

Mythic to Pro path:
- `Mythic 1 -> Mythic 2`: 35 EUR
- `Mythic 2 -> Mythic 3`: 70 EUR
- `Mythic 3 -> Pro`: 135 EUR

Mythic to Pro options:
- `Mythic 1`
- `Mythic 2`
- `Mythic 3`
- `PRO`

Notes:
- Ranked orders require both current and desired values
- When multiple profiles exist, a profile must be chosen before the draft is complete
- Pricing is computed by walking linked steps from current to desired

### Trophies
Selection mode:
- `numeric_range`

Requirements:
- Current and desired values must be integers
- Desired must be greater than current
- Values must remain between `0` and `150000`
- Values must be multiples of `1000`

Pricing brackets:
- `0-10000`: 6 USD per 1000
- `10000-20000`: 8 USD per 1000
- `20000-30000`: 12 USD per 1000
- `30000-40000`: 14 USD per 1000
- `40000-50000`: 15 USD per 1000
- `50000-60000`: 16 USD per 1000
- `60000-70000`: 20 USD per 1000
- `70000-80000`: 22 USD per 1000
- `80000-90000`: 24 USD per 1000
- `90000-100000`: 30 USD per 1000
- `100000-125000`: 36 USD per 1000
- `125000-150000`: 40 USD per 1000

### Brawler
Selection mode:
- `breakpoints`

Supported milestone options:
- `0`
- `750`
- `900`
- `1000`
- `1100`
- `1200`
- `1300`
- `1400`
- `1500`
- `1600`
- `1700`
- `1800`
- `1900`
- `2000`

Configured step ladder:
- `0 -> 750`: 11.25 USD
- `750 -> 900`: 5 USD
- `900 -> 1000`: 2.3 USD
- `1000 -> 1100`: 4 USD
- `1100 -> 1200`: 4.5 USD
- `1200 -> 1300`: 5 USD
- `1300 -> 1400`: 5.5 USD
- `1400 -> 1500`: 7.5 USD
- `1500 -> 1600`: 7.5 USD
- `1600 -> 1700`: 8.5 USD
- `1700 -> 1800`: 10.5 USD
- `1800 -> 1900`: 12.5 USD
- `1900 -> 2000`: 13.5 USD

Important:
- Only exact configured breakpoints are accepted
- If a path is not configured, the order is rejected

### Prestige
Selection mode:
- `breakpoints`

Options:
- `I`
- `II`
- `III`

Configured steps:
- `I -> II`: 30 EUR
- `II -> III`: 77 EUR

### Winstreak
Selection mode:
- `package`

Packages:
- `50 wins`: 23 USD
- `69 wins`: 33 USD
- `101 wins`: 51 USD
- `111 wins`: 63 USD
- `125 wins`: 77 USD
- `200 wins`: 115 USD

Package orders require a selected package and do not use current/desired progression steps.

## Persistence Model
SQLite schema is initialized automatically in `OrdersRepository`.

### `orders` table
Stores:
- customer snapshot
- product and service mode
- ranked profile if applicable
- current/desired/package values
- selection summary
- native subtotal and total
- native currency
- USD total
- status
- ticket channel/message IDs
- claim message ID
- assigned booster snapshot
- proof attachment URL
- proof source and proof update timestamp
- timestamps
- JSON metadata

### `audit_logs` table
Stores:
- order ID
- action
- actor ID
- details
- timestamp

Audit actions currently written by code include:
- `ORDER_CREATED`
- `PAYMENT_CONFIRMED`
- `BOOSTER_SEARCH_POSTED`
- `BOOSTER_ASSIGNED`
- `ORDER_COMPLETED`
- `TICKET_CLOSED`

## Embeds and Message Types
### Public Product Panel
- Product-specific title and description
- Product promo image
- Single product button

### Wizard Preview
- Product
- Service mode
- Ranked profile when applicable
- Current/desired/package values
- Native total
- USD total
- Product image when available

### Ticket Summary
- Customer
- Service mode
- Order status
- Selection summary
- Native total
- USD total
- Ranked profile if applicable
- Assigned booster if applicable
- Price breakdown
- Stored proof image when available, otherwise the product promo image

### Claim Post
- Customer
- Service mode
- Selection
- USD total
- Ticket link

### Completed Job Log
- Customer
- Booster
- Service
- Starting and final values
- Total price
- Status
- Proof image if available

## Error Handling
Global interaction error handling lives in `src/index.ts`.

Behavior:
- Exceptions are logged to the console
- Repliable interactions receive an ephemeral error message
- If the interaction was already replied to or deferred, the bot uses `followUp`
- Otherwise it uses `reply`

## Operational Notes and Caveats
- This is a guild-only bot; interactions outside a guild are rejected
- There is no automated test suite in the repo
- SQLite access is synchronous
- Draft selections live only in memory; they are not persisted across restarts
- Active orders are persisted and ticket summaries are re-synced on startup
- Promo images must exist in `promo_images/` and stay aligned with `src/catalog.ts`
- Product pricing and validation live in code, not in the public panel art
- The public panel is product-specific, but the actual price shown to staff/customers comes from the quote engine during order creation

## Recommended Manual Validation
After configuration or pricing changes, validate:
1. `/deploy-order-panel` for each product
2. Public panel button -> ephemeral wizard flow
3. `/order` flow
4. Ranked profile and step selection
5. Trophy modal validation
6. Breakpoint validation for Brawler and Prestige
7. Package selection for Winstreak
8. Ticket creation and support ping
9. Payment confirmation
10. Booster search post
11. Booster claim
12. Proof upload, proof-link fallback, and completion
13. Completed jobs log
14. Ticket closure and visibility removal

## Source of Truth Reminder
If behavior in this document and code ever diverge, the code in these files is authoritative:
- `src/interactionHandler.ts`
- `src/catalog.ts`
- `src/pricing.ts`
- `src/components.ts`
- `src/embeds.ts`
- `src/db/ordersRepository.ts`
