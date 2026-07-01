# Herzen Co. Marketing Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static, SEO/AEO-ready Herzen Co. marketing website that leads with product leadership and presents custom builds and custom project management solutions as supporting services.

**Architecture:** The site will be plain HTML, CSS, and a tiny amount of JavaScript so it is fast, crawlable, and simple to deploy from an empty workspace. Each public route is a folder with an `index.html`; shared styling lives in `assets/css/styles.css`; tests verify public brand consistency, metadata, structured data, and crawler files.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js test script, generated/local visual assets.

---

### Task 1: Add Site Verification Test

**Files:**
- Create: `tests/site.test.mjs`

**Steps:**
1. Write a Node.js test that checks all expected public pages and crawler files exist.
2. Assert no public file contains legacy source brand names.
3. Assert each page has title, meta description, canonical URL, Open Graph tags, one H1, and JSON-LD where appropriate.
4. Run `node tests/site.test.mjs` and confirm it fails before implementation because files are missing.

### Task 2: Build Static Site

**Files:**
- Create: `index.html`
- Create: `product-leadership/index.html`
- Create: `custom-builds/index.html`
- Create: `pricing/index.html`
- Create: `process/index.html`
- Create: `resources/index.html`
- Create: `faq/index.html`
- Create: `about/index.html`
- Create: `contact/index.html`
- Create: `assets/css/styles.css`
- Create: `assets/js/main.js`
- Create: `assets/img/*`

**Steps:**
1. Build shared header, footer, CTA, and page sections.
2. Lead homepage and navigation with Product Leadership.
3. Add service pages for Product Leadership and Custom Builds, with project management positioned as a scoped support path.
4. Add answer-ready FAQ/resource sections for AEO.
5. Add responsive styling, accessible controls, and visual assets.

### Task 3: Add Technical SEO Files

**Files:**
- Create: `robots.txt`
- Create: `sitemap.xml`
- Create: `llms.txt`
- Create: `site.webmanifest`

**Steps:**
1. Add crawl instructions, sitemap references, and public entity summary.
2. Add structured data to core pages.
3. Keep all public files under the Herzen Co. brand only.

### Task 4: Verify

**Steps:**
1. Run `node tests/site.test.mjs`.
2. Run a legacy-name scan across public files.
3. Start a local static server and confirm the homepage returns successfully.
