# chiranjitkar.com — Photography Studio & Portfolio Knowledge Base

This folder contains the complete, structured content, FAQs, services, pricing, agreements, policies, and biography extracted from the website backup of **chiranjitkar.com**.

---

## Directory Structure

* [**README.md**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/README.md): Overview and table of contents.
* [**about.md**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/about.md): Full biography, educational background, professional training under Praveen Bhat, photography philosophy, and credentials.
* [**services.md**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/services.md): Complete service catalog, packages (Model Portfolio & Headshots, Editorial & Fashion Session, Complete Campaign & Bridal Production), A La Carte solo sessions, and collaboration packages with transparent pricing.
* [**faqs.md**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/faqs.md): All 40 frequently asked questions categorized into General & Practice, Collaborations, Legal/Model Releases, and Identity Verification.
* [**agreements-and-policies.md**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/agreements-and-policies.md): Model release agreements, paid collaboration terms, verification procedure (Razorpay & Aadhaar/PAN), terms of service, and privacy guidelines.
* [**contact.md**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/contact.md): Official contact channels, email, phone/WhatsApp, studio location, and social media handles.
* [**portfolio/**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/portfolio/): Categorized master photography portfolio containing 21 analyzed high-resolution photos across 5 luxury categories (`editorial/`, `beauty-portraits/`, `ethnic-bridal/`, `black-and-white/`, `lifestyle-street/`) and [**portfolio.json**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/portfolio/portfolio.json).
* [**data.json**](file:///Users/chiranjitkar/Documents/Gemini/chiranjitkar.com/data.json): Comprehensive structured JSON export for use in modern web frameworks (Next.js, Astro, Gatsby) or programmatic APIs.

---

## Quick Facts
* **Artist:** Chiranjit Kar
* **Specialties:** Fashion, Editorial, Commercial, Catalog, Street Style, Portrait, Beauty, Conceptual
* **Training:** Praveen Bhat Academy (Mentored by Praveen Bhat & Krishan Thapa)
* **Base Location:** Agartala, Tripura, India (previously Delhi & Mumbai)
* **Contact:** `iamchiranjitkar@hotmail.com` | `+91 7005238823`

---

## Studio Operations Workspace

The site now includes a private operations workspace at `/studio.html` and a private client session page at `/session.html`. Website inquiries are stored in the Cloudflare D1 database and appear in the Sales inbox. A team member can convert an inquiry into a project, set its booked session length and overtime rate, assign staff, create production tasks, record charges and payments, and publish review or delivery links to the client portal.

### Workflow

1. Sales follows up with an inquiry, confirms the scope, then creates a project with the agreed session duration and overtime rate.
2. Sales confirms the booking, records payment/deposit details, schedules the shoot, and assigns the photographer, filmmaker, and other team members.
3. Sales shares the generated private client link using the agreed contact channel. The client link is a bearer link; regenerate it from the project if it is lost or exposed. Regeneration revokes the old link.
4. At shoot time, the client opens the private link and generates a one-time start code. The photographer enters that code in the staff workspace to record the server-side start time.
5. The timer shows the booked time, then the 30-minute grace period, then accumulating overtime. After the client generates a finish code, the photographer enters it to record the end time. The server rounds any chargeable overtime up to 30-minute blocks and creates an overtime invoice at the rate stored on that booking.
6. The team uses tasks and project stages for editing, client review, and delivery. Sales records payments and can attach a payment URL. Editors or filmmakers can publish HTTPS review and delivery links to the client portal.

### Staff roles

| Role | Main access |
| --- | --- |
| Administrator | Team accounts, all projects, billing, assignments, and settings |
| Sales | Inquiries, all projects, client links, scheduling, and billing |
| Photographer | Assigned projects, session timer, project tasks, and client-approved session close |
| Filmmaker | Assigned projects, tasks, and video review/delivery links |
| Editor / Retoucher | Assigned projects, tasks, and proof/delivery links |

Passwords are stored as salted HMAC-SHA-256 hashes keyed with the server-only APP_SECRET; staff passwords must be at least 20 characters. Staff sessions use secure, HTTP-only cookies and expire after eight hours. Activity events record project changes and client approval events. Administrators can invite or disable staff accounts and reset passwords; temporary passwords are shown once and should be shared privately. Team members can change their password from the account control in the workspace.

### Current service boundaries

- Client approval codes are generated on the client's private session page and shown only on that page; the client shares the code with the photographer. Sending OTPs by SMS or email is not enabled.
- The invoice ledger calculates and records charges, balances, and payment status. It does not process or automatically collect card/UPI payments; Sales can attach a payment-provider URL and reconcile the payment received.
- Proof galleries and final media remain in your chosen secure file service. The portal stores HTTPS links to those resources; it does not upload or host large photo/video files itself.
- Staff should add a project task for each editing/review/delivery handoff and assign an owner and due date. The workspace refreshes project/task activity periodically while open.

### Cloudflare deployment resources

The Pages Functions API uses the `chiranjitkar-studio-ops` D1 database configured in `wrangler.toml`. Schema changes are in `migrations/`; they have been applied to the production database. `APP_SECRET`, `OWNER_EMAIL`, and `OWNER_INITIAL_PASSWORD` are production Pages secrets. After the owner account has signed in for the first time, remove `OWNER_INITIAL_PASSWORD` from Pages secrets. Do not place credentials or client links in this repository.
