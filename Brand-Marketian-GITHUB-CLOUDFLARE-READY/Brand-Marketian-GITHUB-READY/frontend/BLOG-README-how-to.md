# Brand Marketian — clickable blog + article pages

This adds a real, readable blog: every card on `blog.html` now opens a full
article page, styled to match your site, with complete SEO built in.

## 1. Where the files go

**All of these files go in your `frontend/` folder** — the same folder that
already has `blog.html`, `index.html`, `brand.css`, etc.

New files (add these):

- `blog-article.css` ............ shared styling for every article page
- `blog-article-template.html` .. copy this to create future posts
- `blog-cpl-india-2026.html`
- `blog-festive-ad-calendar-d2c.html`
- `blog-nine-reels-beat-2l-budget.html`
- `blog-whatsapp-funnels.html`
- `blog-local-seo-multi-location.html`
- `blog-marketing-budget-by-stage.html`

Replace these two (they're updated versions of files you already have):

- `blog.html` ..... cards are now clickable and link to the articles
- `sitemap.xml` ... the 6 new articles are added so Google finds them

## 2. How to publish it (GitHub → Cloudflare)

Your site deploys automatically from GitHub. So you just need to add these
files to the repo and Cloudflare rebuilds the site.

Easiest way (in the browser, no tools):

1. Go to your repo → the `.../frontend` folder on GitHub.
2. Click **Add file → Upload files**.
3. Drag in all the new files **and** the updated `blog.html` and
   `sitemap.xml` (uploading a file with the same name replaces it).
4. Scroll down, write a short message like "Add clickable blog articles",
   and click **Commit changes**.
5. Cloudflare will redeploy in a minute or two. Refresh
   `brandmarketian.com/blog` and click any card.

(If you use git on your computer instead: drop the files into `frontend/`,
then `git add .`, `git commit -m "Add blog articles"`, `git push`.)

## 3. Where the SEO lives (keywords, description, meta tags)

Every article page has its SEO in a clearly-marked block at the **top of the
file**, between these comment lines:

    <!-- ================= SEO — edit this block ================= -->
    ...
    <!-- ================= /SEO ================= -->

In there you can edit:

- **Title** — the blue clickable line in Google + the browser tab
- **Description** — the grey summary under it (aim ~150 characters)
- **Keywords** — a short comma-separated list
- **Canonical** — the page's own URL (must match the file name)
- **Social share** (og: / twitter:) — the preview on WhatsApp, LinkedIn, X
- **Structured data** (the JSON-LD block) — helps Google show it as an article

To change SEO for a page: open that page's `.html`, edit the values inside
that block, save, and commit again. That's it.

## 4. Adding a NEW blog post later

1. **Copy** `blog-article-template.html` and rename it, e.g.
   `blog-my-new-topic.html`.
2. Fill in the SEO block at the top (change `noindex` to `index, follow`),
   then write the article where it says "ARTICLE START".
3. **Add a card** to `blog.html` so it shows in the list. Find the `all = [`
   list (near the bottom) and add one line, for example:

       { tag: 'Playbook', title: 'My new topic', excerpt: 'One line...', read: '5 min read', date: 'Sep 2026', href: 'blog-my-new-topic.html' },

4. **Add one line** to `sitemap.xml` copying an existing article line and
   changing the file name.
5. Commit. Done.

## 5. About your admin panel

Your admin panel manages the main marketing pages (home, services, pricing…)
and their content. These blog articles keep their SEO **in the files** — which
is exactly how `blog.html` and every other page on your site already works,
and it's the strongest setup for Google because the tags are in the page
itself, not added later by JavaScript.

If you'd like each article's SEO to be **editable from inside the admin
dashboard** instead of the file, that's possible too — it's a bit more setup
because it touches your admin app and backend. Ask and it can be added as a
next step.
