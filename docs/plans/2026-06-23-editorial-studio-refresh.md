# Editorial Studio Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the Herzen Co. homepage into a quieter, sharper editorial studio experience that reads less machine-generated.

**Architecture:** Keep the static site architecture intact. Update homepage copy and structure in `index.html`, refine shared presentation in `assets/css/styles.css`, and extend `tests/site.test.mjs` with homepage-specific editorial checks while preserving SEO/AEO requirements.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js verification script.

---

### Task 1: Add Editorial Homepage Checks

**Files:**
- Modify: `tests/site.test.mjs`

**Steps:**
1. Add assertions that the homepage contains the editorial positioning phrase `messy middle`.
2. Add assertions that the homepage no longer contains generic machine-like section copy such as `Answering the questions buyers ask first`.
3. Run `node tests/site.test.mjs` and confirm it fails before the homepage refresh.

### Task 2: Rewrite Homepage For Editorial Studio Direction

**Files:**
- Modify: `index.html`

**Steps:**
1. Replace the current hero with a more confident founder-studio headline and human lead copy.
2. Replace the metrics strip with quieter proof notes.
3. Reduce the three-card catalog feel and make Product Leadership primary.
4. Add a point-of-view section that explains how Herzen Co. thinks.
5. Keep JSON-LD, canonical metadata, and one H1 intact.

### Task 3: Modernize Shared Styling

**Files:**
- Modify: `assets/css/styles.css`

**Steps:**
1. Tighten navigation spacing and button treatment.
2. Add editorial layout primitives for proof notes, primary offer, support paths, and point-of-view rows.
3. Reduce card heaviness and increase white space.
4. Keep mobile layouts stable.

### Task 4: Verify

**Steps:**
1. Run `node tests/site.test.mjs`.
2. Run the legacy-name scan.
3. Check the served homepage returns `200 OK`.
