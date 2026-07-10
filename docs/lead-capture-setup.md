# Lead Capture Setup Checklist

The site now has the lead capture flow built in. Current direction: Calendly for scheduled calls, ClickUp as the CRM, and privacy policy held until the end.

## Required

1. ClickUp Personal API Token
   - Generate this from ClickUp avatar menu > Settings > Apps > API Token.
   - Add it in Vercel as `CLICKUP_API_TOKEN`.

2. ClickUp List ID
   - This is the List where new website leads should become tasks.
   - Add it in Vercel as `CLICKUP_LIST_ID`.

3. Optional ClickUp routing
   - `CLICKUP_STATUS` if new leads should land in a specific status.
   - `CLICKUP_ASSIGNEES` as comma-separated ClickUp user IDs if leads should be assigned.
   - `CLICKUP_TAGS` as comma-separated labels such as `inbound,website`.

4. Confirm lead inbox fallback
   - Current fallback email is `Lupe@herzenco.co`.
   - The contact form uses this only if the production delivery path is not configured yet.

## Optional But Recommended

5. Lead magnet delivery preference
   - Keep the current text download.
   - Replace it with a designed PDF.
   - Deliver it automatically by email after form submission.

6. Email follow-up sequence
   - A 3-email sequence works well:
     - Delivery email with checklist
     - Product system follow-up
     - Invitation to book a call

7. Privacy policy
   - Hold for now.
   - Add before final production launch if form submissions are stored in ClickUp or another platform.

## Vercel Environment Variables

Set one of these delivery paths:

### ClickUp Delivery

- `CLICKUP_API_TOKEN`
- `CLICKUP_LIST_ID`
- `CLICKUP_STATUS` optional
- `CLICKUP_ASSIGNEES` optional
- `CLICKUP_TAGS` optional

### Email Delivery

- `RESEND_API_KEY`
- `LEAD_NOTIFY_TO`
- `LEAD_FROM`

### Webhook Delivery

- `LEAD_WEBHOOK_URL`
- `LEAD_WEBHOOK_SECRET` optional, if the destination expects a bearer token

## Current Built-In Behavior

- Contact form posts to `/api/leads`.
- If ClickUp delivery is configured, each form submission becomes a ClickUp task.
- `Book a call` links route to Calendly: `https://calendly.com/herzenco/xelerate-intro-call`.
- If delivery is not configured, contact inquiries fall back to a prefilled email to `Lupe@herzenco.co` so leads are not silently lost.
- Lead magnet forms do not fall back to email; they show a setup warning until delivery is configured.
- Successful submissions redirect to `/thank-you/`.
- Vercel Analytics events are queued for:
  - `Contact Page Viewed`
  - `Book Call Clicked`
  - `Lead CTA Clicked`
  - `Lead Form Submitted`
  - `Lead Magnet Clicked`
  - `Lead Magnet Downloaded`
  - `Lead Thank You Viewed`
