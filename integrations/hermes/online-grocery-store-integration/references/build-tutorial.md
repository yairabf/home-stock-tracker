# Build a store-specific grocery cart skill

This tutorial promotes a new store adapter without moving vendor fulfillment
into Home Stock Tracker. Work only with placeholders until a store owner has
approved the integration and the isolated browser is ready.

## 1. Record the store contract

Before provisioning anything, document the following in the store-specific
skill, outside this portable bundle:

- Store slug and display name.
- Absolute HTTPS base and login URLs.
- Store locale and language.
- Intended account owner and authorized platform identities.
- Home Stock Tracker MCP connection as the authoritative grocery-list source.
- Supported read and cart operations.
- Packaged and weighted quantity semantics.
- Who may approve an exact product preference.
- Prohibited operations: checkout, payment, address changes, order submission,
  substitutions, and any action beyond the authorized cart operation.

A generic grocery item and an exact store SKU are separate facts. Never infer
brand, package, fat level, dietary variant, variety, certification, vintage, or
substitution from the generic item.

### Generate the inert starter

Use only non-secret public store metadata. The output root must already exist:

```bash
npm run store-skill:scaffold -- \
  --store-slug example-store \
  --display-name "Example Store" \
  --base-url https://store.example \
  --login-url https://store.example/login \
  --locale en-US \
  --output-root /path/to/private-skills
```

The generator refuses existing targets and has no force, merge, or refresh
mode. Its `adapter.mjs` validates `status`, `cart`, `search`, and `ensure`, then
returns `not_implemented` without browser or network activity. Malformed calls
return `error`; neither result permits a mutation.

Implement store behavior only after completing read-only discovery. Use
`lib/preferences.mjs` to validate and atomically save exact-product choices in
the ignored local `data/preferences.json`. A lookup is only a revalidation
candidate. It never authorizes first-result selection, substitution, package
conversion, or cart mutation.

## 2. Protect reference integrations

If an existing production integration is used for architectural reference,
verify it before and after the work:

1. Hash its checked-in skill and helper files.
2. Record only a privacy-safe, read-only browser/authentication status.
3. Do not write, mount, restart, stop, remove, or otherwise operate its profile
   or container while developing this store.
4. Compare the same hashes and status after the work.
5. Stop and investigate any unexpected difference.

Do not place live paths, ports, session state, account labels, cookies, or
credentials from a reference integration in documentation, source control, or
the new store's resources.

## 3. Allocate isolated resources

Each store uses a separate set of resources:

| Resource              | Required form                                   |
| --------------------- | ----------------------------------------------- |
| Skill                 | `<store>-shared-cart`                           |
| Browser container     | `<store>-browser`                               |
| Host WebDriver port   | Unique, checked before use                      |
| Host noVNC port       | Unique, checked before use                      |
| Browser profile       | One persistent directory dedicated to the store |
| Session state         | One private file dedicated to the store         |
| Browser adapter       | One store-specific implementation               |
| Preferences           | One non-secret store-specific registry          |
| Selectors and parsers | Store-specific locale and modal rules           |

Check existing Docker containers and listening ports before provisioning. Never
select ports by assumption. Do not share a profile between Chromium instances,
reuse another store's session-state file, copy selectors or product IDs, or run
two adapters against one browser profile.

## 4. Use a persistent private browser

Use a pinned `selenium/standalone-chromium` image with a dedicated persistent
Chromium user-data directory. Bind Selenium WebDriver and noVNC to host loopback
only. Keep the profile and private session-state file outside replaceable source
and application directories, with restrictive file permissions.

The adapter records a live WebDriver session and probes that session directly
for liveness. Reuse a healthy recorded session. Recreate it against the same
dedicated profile only after proving the old session is dead.

Grid `/status` can report `ready: false` while its one available slot is occupied
by a healthy browser session. Do not treat that status alone as failure or create
a duplicate session. Probe the recorded session first.

## 5. Hand off login privately

The account holder enters all authentication data directly in the shared browser:

1. Provision the browser and verify its loopback-only listeners.
2. Create the WebDriver session that the adapter will later reuse.
3. Navigate that session to the store login page.
4. From the account holder's trusted computer, create an authenticated SSH tunnel
   to the host-local noVNC port:

   ```text
   ssh -N -L <local-port>:127.0.0.1:<remote-novnc-port> <ssh-user>@<server>
   http://127.0.0.1:<local-port>/?autoconnect=1&resize=scale
   ```

5. The account holder opens the local URL and enters email, password, OTP,
   CAPTCHA, passkey, or other challenge directly in the browser.
6. Resume automation only after a privacy-safe read verifies the intended
   authenticated account in that same session.

The tunnel endpoint is local, not a public share link. Do not expose an
unauthenticated noVNC endpoint on a LAN or the Internet. Never ask for, receive,
log, return, or type authentication material in chat. Request an expiring OTP
only after the account holder confirms the shared browser is visible. Never log
or return a WebDriver session ID.

## 6. Continue safely

After successful login, begin the read-only discovery phase described in the
adapter contract. Do not add a product to the vendor cart until the exact product
and final quantity are authorized and the adapter can verify the resulting cart.

## 7. Discover the live store read-only

Before implementing any cart mutation, document the following with read-only
browser operations:

- Positive logged-in and logged-out markers and privacy-safe intended-account
  verification.
- Search URL or form, locale behavior, visible product-card selector, stable
  product identifier, and exact name, brand, size, unit, availability, and price
  extraction.
- Hidden carousel or duplicate-card behavior and product-dialog selectors.
- Plus and minus controls, quantity increment, cart row, quantity, total, empty
  cart selectors, and visible-text parser fallback.
- Delivery, address, substitution, or fulfillment modals.
- Loading, stale-element, and interrupted-mutation behavior.

Do not save page source when it contains private account information. Do not
inspect or export cookies, authorization headers, local storage, or browser
tokens.

## 8. Fulfill a Home Stock Tracker grocery list

When the service is the source of truth, use this sequence:

1. Read the pending grocery list through its authenticated MCP contract.
2. Preserve each generic name and explicit requested quantity and unit.
3. Resolve an approved exact store product from a valid saved preference or an
   authorized choice from live search results.
4. Call the store adapter's idempotent `ensure` operation.
5. Read and verify the final vendor cart.
6. Leave every Home Stock Tracker line pending until an actual purchase is
   reported.

Adding an item to a vendor cart must never call purchase completion, record an
inventory purchase, or remove a pending grocery line. Importing an actual vendor
order is separate future work and must prevent double-counting between grocery
completion and inventory-only purchase recording.

## 9. Authorize callers and protect privacy

A shared vendor cart and browser do not grant access to private conversations.
Resolve each caller's exact platform identity, compare it with the explicit store
account allowlist, and keep conversation history separate from shared cart state.

Before claiming cross-channel support, perform skill discovery in a fresh
session and a harmless real read-only inbound request from each authorized
channel. Do not simulate another person's inbound identity.

## 10. Verify an implemented adapter

Run these cases against each real store adapter before enabling routine cart
fulfillment:

| Area           | Required cases                                                           |
| -------------- | ------------------------------------------------------------------------ |
| Session        | Missing state, dead session, live reuse, container restart               |
| Authentication | Logged out, successful handoff, expired login, wrong account             |
| Search         | No result, one result, many results, hidden duplicate                    |
| Cart           | Empty, populated, parser fallback, localized decimals                    |
| Quantity       | Packaged unit, weighted increment, already above target                  |
| Preference     | Missing, confirmed, disappeared, materially changed                      |
| Modal          | Delivery, address, or fulfillment interruption after the first increment |
| Mutation       | Verified success, not found, uncertain transport with no retry           |
| Channels       | Local discovery and a real read-only request per authorized channel      |
| Isolation      | Reference hashes and privacy-safe authenticated status unchanged         |

Do not promote an adapter that cannot prove these states. Keep all live commands
in the account holder's approved execution environment and never embed secrets
in an agent prompt or repository document.

The scaffold's automated tests prove only generator validation, overwrite
protection, inert command behavior, and preference-registry rules. They do not
replace this live verification matrix for an implemented retailer adapter.
