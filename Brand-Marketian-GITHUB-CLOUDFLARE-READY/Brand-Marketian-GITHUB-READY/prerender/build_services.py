"""Generate /services/<slug> pages from the blog-article shell (nav, footer, styles, GTM).

Only facts already published on brandmarketian.com (Work, Pricing, Services, Home)
are used as proof. Re-run after nav/footer changes:  python build_services.py
"""
import re, json, pathlib, html

ROOT = pathlib.Path(r"C:\Users\Asus\Brand-Marketian\Brand-Marketian-GITHUB-CLOUDFLARE-READY\Brand-Marketian-GITHUB-READY")
FE = ROOT / "frontend"
SHELL = (FE / "blog-cpl-india-2026.html").read_text(encoding="utf-8")

head_end = SHELL.index("</head>")
art_start = SHELL.index('<div class="bm-art-wrap">')
art_end = SHELL.index("</article>")
HEAD = SHELL[:head_end]
NAV = SHELL[head_end:art_start]
FOOT = SHELL[art_end:]

# page lives one folder down: make every relative asset path absolute
def absolutize(s):
    return re.sub(r'(\s(?:href|src)=")(?![a-z]+:|/|#|data:)([^"]+)"', r'\1/\2"', s)
HEAD, NAV, FOOT = absolutize(HEAD), absolutize(NAV), absolutize(FOOT)
NAV = NAV.replace('data-sc-name="blog-cpl-india-2026"', 'data-sc-name="service"')
# the Services nav item is the active one on these pages (text colour + underline)
# (the prerender's scoped class name, e.g. "scp0"/"scp6", changes between builds, so match any)
def _nav_item(nav, href, on):
    m = re.search(rf'<a href="{re.escape(href)}" class="scp\d+"', nav)
    i = m.start(); j = nav.index("</a>", i)
    seg = nav[i:j]
    seg = seg.replace("scaleX(1)" if not on else "scaleX(0)", "scaleX(0)" if not on else "scaleX(1)")
    if on:
        seg = seg.replace("color: var(--color-text); font-weight: 500;", "color: var(--color-accent-700); font-weight: 700;", 1)
    else:
        seg = seg.replace("color: var(--color-accent-700); font-weight: 700;", "color: var(--color-text); font-weight: 500;", 1)
    return nav[:i] + seg + nav[j:]
NAV = _nav_item(_nav_item(NAV, "/blog", False), "/services", True)

EXTRA_CSS = """<style>
/* service pages — same flat editorial system as the long-reads */
.bm-svc-actions{display:flex;gap:12px;flex-wrap:wrap;margin:28px 0 0}
.bm-svc-actions .btn{text-decoration:none}
.bm-svc-proof{display:flex;flex-wrap:wrap;gap:0;margin:34px 0 0;border-top:2px solid var(--color-text);border-bottom:1px solid var(--color-divider)}
.bm-svc-proof div{flex:1 1 180px;padding:18px 18px 18px 0}
.bm-svc-proof div + div{padding-left:18px;border-left:1px solid var(--color-divider)}
.bm-svc-proof b{display:block;font-family:var(--font-heading);font-weight:800;letter-spacing:-.02em;font-size:30px;line-height:1.1;color:var(--color-text)}
.bm-svc-proof span{display:block;margin-top:6px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px;line-height:1.45;letter-spacing:.02em;color:color-mix(in srgb,var(--color-text) 58%,transparent)}
.bm-article .bm-steps{list-style:none;margin:0 0 30px;padding:0;counter-reset:st}
.bm-steps li{counter-increment:st;position:relative;padding:16px 0 16px 46px;border-bottom:1px solid var(--color-divider);font-size:17px;line-height:1.6}
.bm-steps li::before{content:counter(st,decimal-leading-zero);position:absolute;left:0;top:18px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;color:var(--color-accent-700)}
.bm-steps li b{display:block;font-family:var(--font-heading);font-size:18px;margin-bottom:2px}
.bm-faq details{border-bottom:1px solid var(--color-divider);padding:16px 0}
.bm-faq summary{cursor:pointer;font-family:var(--font-heading);font-weight:700;font-size:18px;line-height:1.35;list-style:none;display:flex;justify-content:space-between;gap:16px}
.bm-faq summary::-webkit-details-marker{display:none}
.bm-faq summary::after{content:"+";font-family:'IBM Plex Mono',ui-monospace,monospace;color:var(--color-accent-700)}
.bm-faq details[open] summary::after{content:"\\2212"}
.bm-faq details p{margin:10px 0 0;font-size:16.5px;line-height:1.65}
@media (max-width:560px){.bm-svc-proof div + div{padding-left:0;border-left:0;border-top:1px solid var(--color-divider)}}
</style>
"""

PROCESS = """<h2>How the first 90 days run</h2>
<ol class="bm-steps">
<li><b>Weeks 1–2 · Audit and setup</b>Account access, tracking, a competitor teardown and a 90-day roadmap you sign off on.</li>
<li><b>Weeks 3–6 · Build and launch</b>First creative batch live, campaigns structured, funnels and forms wired end to end.</li>
<li><b>Ongoing · Scale and report</b>Weekly optimisation, monthly reporting, and a clear plan for the next quarter.</li>
</ol>"""

REL = {
    "performance-marketing": ("Service", "Performance marketing", "Meta, Google and YouTube ads judged on cost per lead and return on ad spend."),
    "seo": ("Service", "SEO", "Technical fixes, linked content and local search that keep paying after the campaign stops."),
    "social-media-marketing": ("Service", "Social media marketing", "Calendar, reels and community run end to end, in English and Hinglish."),
    "d2c-growth": ("Service", "D2C growth", "From first order to repeat buyer, measured on margin rather than vanity ROAS."),
    "b2b-lead-generation": ("Service", "B2B lead generation", "Pipeline your sales team believes in, reported to closed deals."),
}
def related(keys, extra):
    out = ['<div class="bm-related"><h3>Related</h3><div class="bm-related-grid">']
    for k in keys:
        tag, t, d = REL[k]
        out.append(f'<a class="bm-rel-card" href="/services/{k}"><div class="bm-rel-tag">{tag}</div><h4>{t}</h4><p>{d}</p></a>')
    for href, tag, t, d in extra:
        out.append(f'<a class="bm-rel-card" href="{href}"><div class="bm-rel-tag">{tag}</div><h4>{t}</h4><p>{d}</p></a>')
    out.append("</div></div>")
    return "\n".join(out)

def faq(items):
    return '<h2>Questions we get asked</h2>\n<div class="bm-faq">' + "".join(
        f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in items) + "</div>"

PAGES = []

# ─────────────────────────────── Performance marketing
PAGES.append(dict(
 slug="performance-marketing", name="Performance marketing", form="Performance ads",
 title="Performance Marketing Agency in India | Brand Marketian",
 desc="Meta, Google and YouTube performance marketing judged on qualified leads, cost per lead and return on ad spend. See our approach, pricing and real campaign results.",
 h1="Performance marketing agency in India",
 dek="Meta, Google and YouTube campaigns built to make money back. Every rupee is tracked to a lead or a sale, and reviewed every week against your cost per lead and return on ad spend.",
 proof=[("₹30L+", "monthly ad spend managed across Meta and Google"), ("736", "leads for one function hall, Google and Meta combined"), ("₹13.04", "cost per lead on one Meta Lead Ads campaign")],
 body="""
<p>Most ad accounts we audit are not short of budget. They are short of a clear number. Spend is spread across campaigns nobody has touched in weeks, tracking broke two website updates ago, and the monthly report is full of reach and clicks rather than enquiries and revenue.</p>
<p>Our performance marketing work starts from the other end. We agree what a qualified lead or a profitable order looks like for your business, wire tracking so every one is counted, and then run Meta, Google and YouTube against that single number.</p>

<h2>Performance marketing built around business outcomes</h2>
<p>Paid media only works when the ad, the landing page, the form and the follow-up are built as one system. We own all four, which is why we can be held to cost per qualified lead rather than cost per click.</p>

<h3>Meta ads management</h3>
<p>Facebook and Instagram campaigns for lead generation and sales: Lead Ads with qualifying questions, catalogue and dynamic product ads for D2C, and retargeting that reaches people who visited but did not buy. Six new creative sets a month are A/B tested on the Growth plan, so the account never runs on tired ads.</p>

<h3>Google Ads and search campaigns</h3>
<p>Search campaigns that capture people already looking for what you sell, Performance Max where it earns its place, and negative keyword hygiene that stops budget leaking into irrelevant searches. For local businesses we connect Google Ads with your Google Business Profile so calls and direction requests are counted too.</p>

<h3>YouTube and video campaigns</h3>
<p>Short video cutdowns from the same shoot that feeds your Reels, used for reach at the top of the funnel and retargeting further down. We report video on what it does to search volume and conversion rates, not on views alone.</p>

<h3>Creative testing and landing page CRO</h3>
<p>We regularly find a large part of a cost-per-lead problem sitting after the click: an eight-field form, a page that loads slowly on 4G, or an instant form with no qualifying question. Landing pages and lead forms are included in the Growth plan, and we test them as seriously as the ads.</p>

<h3>Retargeting and full-funnel campaigns</h3>
<p>Cold audiences see proof and a clear offer. Warm audiences see objection-handling and urgency. Leads get a WhatsApp follow-up within minutes rather than a call back tomorrow. <a href="/blog-whatsapp-funnels">Here is how we set up WhatsApp follow-up that people do not mute.</a></p>

<h2>How we track CPL, CAC, ROAS and qualified leads</h2>
<p>In week one we define a qualified lead with you and set up conversion tracking through Google Analytics 4, Google Tag Manager and the Meta pixel and Conversions API. From then on, every report leads with cost per qualified lead or return on ad spend. For lead businesses we connect your CRM or sales sheet, so campaigns are judged on leads your team actually calls back.</p>
<p>If you want to know whether your current numbers are healthy, our <a href="/blog-cpl-india-2026">2026 cost-per-lead benchmarks for India</a> break typical ranges down by category.</p>

<h2>Performance marketing results</h2>
<div class="bm-callout"><h4>Sri Sai Convention Hall · wedding and function hall</h4>
<p>The hall needed enquiries, not awareness, and every lead had to be tracked back to the rupee spent. We ran Google Ads and Meta Lead Ads side by side and optimised only for cost per lead across both. The result was <strong>736 leads</strong> in total, with a <strong>₹13.04 cost per lead on Meta</strong> against ₹683.72 on Google, a 52× efficiency gap that decided where the next rupee went.</p></div>
<div class="bm-callout"><h4>First Fiddle · paid ads and funnels</h4>
<p>We built a paid-ads and funnel system from zero for a franchise consulting business, which has since generated a <strong>₹100Cr+ pipeline</strong> for this single client.</p></div>
<p>We also run performance ads for fashion D2C brand Libas. Every figure above comes from the real ad accounts shown on our <a href="/work">Work page</a>.</p>
""" + PROCESS + """
<h2>Performance marketing pricing</h2>
<p>Meta and Google Ads management is part of our <strong>Growth plan at ₹49,999 a month</strong>. That includes six ad creative sets and copy a month, landing pages and lead forms, WhatsApp lead follow-up setup and up to ₹1L a month of ad budget managed. Google, YouTube and programmatic at larger budgets sit in Dominate at ₹89,999 a month. Prices exclude 18% GST, ad spend is billed separately, and plans run month to month. <a href="/pricing">Compare every plan.</a></p>
""",
 faqs=[("Do you manage both Meta Ads and Google Ads?", "Yes. Most accounts run both, because each reaches buyers at a different moment. We report them against the same cost-per-lead or ROAS target so budget can move to whichever is working."),
       ("Who owns the ad accounts?", "You do. Ad accounts sit in your business name and you keep full access. There is no lock-in, and plans run month to month with 30 days' notice."),
       ("How fast do campaigns go live?", "Tracking and account structure are done in week one. First campaigns are usually live inside 10 working days."),
       ("What ad budget do I need?", "It depends on your category and your target cost per lead. The Growth plan covers management of up to ₹1L a month of spend. <a href=\"/blog-marketing-budget-by-stage\">This guide breaks down spend by business stage.</a>"),
       ("What counts as a qualified lead?", "We define it with you in week one, for example a genuine enquiry with a working phone number in your service area, and report against that rather than raw form fills.")],
 rel=(["d2c-growth", "b2b-lead-generation", "seo"], [("/blog-best-performance-marketing-agency-india", "Guide", "How to choose a performance marketing agency in India", "What to check before you hand over your ad budget.")]),
 cta=("Want a second opinion on your ad account?", "Book a free audit. We will benchmark your live campaigns and show you the fastest win, with no pitch and no pressure."),
))

# ─────────────────────────────── SEO
PAGES.append(dict(
 slug="seo", name="SEO", form="End-to-end",
 title="SEO Agency in Delhi NCR | Brand Marketian",
 desc="SEO for Indian brands: technical fixes, service and commercial pages, local SEO, content clusters and AI search visibility, reported against enquiries and revenue.",
 h1="SEO agency in Delhi NCR and India",
 dek="Be the answer, not the ad. Technical fixes, pages built for the searches your buyers actually make, local SEO and visibility in AI search, measured on enquiries rather than rankings alone.",
 proof=[("50+", "brands served across industries in India"), ("15+", "brands built from scratch"), ("₹89,999", "a month, with SEO and Google Business Profile in the Dominate plan")],
 body="""
<p>SEO is the one channel that keeps paying after the campaign stops. It is also the easiest to get wrong: rankings for keywords nobody buys from, blog posts that never link to a service page, and technical problems nobody notices until traffic drops.</p>
<p>We run SEO as part of the same system as your ads and social, so the keywords we target are the ones that already convert in paid search, and the content we publish sends readers to pages built to turn them into enquiries.</p>

<h2>Technical SEO</h2>
<p>We start with a full crawl: status codes, redirects, canonical tags, indexation, sitemaps, internal links, Core Web Vitals and how your pages render for Google. Broken pages get fixed or redirected, duplicate URLs get consolidated, and slow templates get lighter. This is unglamorous work, and it is usually where the quickest gains are.</p>

<h2>Service and commercial SEO</h2>
<p>Most service businesses try to rank one page for ten different services. We build a dedicated page for each commercial intent, with a clear title and heading, real proof, pricing where you publish it and a direct route to enquire, so each page can compete for its own searches.</p>

<h2>Local SEO</h2>
<p>For businesses serving Delhi, Gurgaon, Noida or several cities, we set up and maintain your Google Business Profile, keep your name, address and phone number consistent across directories, and build location pages only where there is genuine local substance behind them. <a href="/blog-local-seo-multi-location">Here is how we approach local SEO for multi-location brands.</a></p>

<h2>Content clusters</h2>
<p>We plan articles in groups around each service: a main page supported by buyer guides, benchmarks and comparisons that answer the questions people ask before they enquire. Every article links to the service it supports. A human writer and an editor own every published piece; AI helps with research and drafts only.</p>

<h2>Authority building</h2>
<p>Links still matter, but one relevant editorial mention is worth more than a hundred directory listings. We build authority through original data, expert commentary, case studies and genuine industry profiles, never through bulk guest-post packages.</p>

<h2>AI search visibility</h2>
<p>AI answer engines pull from well-structured, indexed web content. Clear entity information, structured data, specific first-hand answers and consistent brand details across the web are what make a brand citable in AI Overviews and chatbot answers. That comes from strong SEO fundamentals rather than a separate trick.</p>

<h2>SEO reporting and revenue attribution</h2>
<p>Monthly reports lead with non-brand clicks, enquiries from organic search and which pages produced them, taken from Google Search Console and Google Analytics 4. Rankings are reported, but they are not the goal.</p>

<div class="bm-callout"><h4>Client work</h4><p>We handle website and SEO for Nakul Associates, a professional services firm, alongside SEO work within our full-funnel accounts. <a href="/work">See the brands we work with.</a></p></div>
""" + PROCESS + """
<h2>SEO pricing</h2>
<p>SEO and Google Business Profile management are included in our <strong>Dominate plan at ₹89,999 a month</strong>, alongside ads, social, email and WhatsApp automation and website management. Prices exclude 18% GST and plans run month to month. If you need a standalone SEO project, such as a technical audit or a site migration, we scope and quote it up front. <a href="/pricing">Compare every plan.</a></p>
""",
 faqs=[("How long does SEO take to show results?", "Meaningful movement typically starts in three to four months for a technically healthy site, with compounding gains over six to twelve months. Anyone promising page-one rankings in weeks is targeting keywords nobody searches for or cutting corners."),
       ("Do you guarantee rankings?", "No. Nobody controls Google's rankings, and guarantees are a warning sign. We commit to the work, the reporting and the business metrics we agree with you."),
       ("Is your content AI-written?", "AI assists research and drafts. A human writer and an editor own every published piece."),
       ("Do you do local SEO for businesses outside Delhi NCR?", "Yes. We work with brands across India and set up local SEO for any city where you genuinely serve customers.")],
 rel=(["performance-marketing", "social-media-marketing", "b2b-lead-generation"], [("/blog-best-seo-agency-delhi-ncr", "Guide", "How to choose an SEO agency in Delhi NCR", "What to check before you believe any promise of page one.")]),
 cta=("Want to know what is holding your site back?", "Book a free audit. We will crawl your site, check how Google sees it and show you the biggest quick wins."),
))

# ─────────────────────────────── Social media
PAGES.append(dict(
 slug="social-media-marketing", name="Social media marketing", form="Social media",
 title="Social Media Marketing Agency Delhi NCR | Brand Marketian",
 desc="Social media marketing for Indian brands: strategy, Instagram management, Reels, content calendars and community, in English and Hinglish. Plans from ₹24,999 a month.",
 h1="Social media marketing agency in Delhi NCR",
 dek="Content that stops the scroll. A calendar, a look and a community, your organic presence run end to end and tuned to how your audience actually scrolls.",
 proof=[("₹24,999", "a month to start, with 12 posts and 4 reels"), ("524K", "views on one creator Reel for the OPPO F29 5G launch"), ("50+", "brands served across industries in India")],
 body="""
<p>Posting every day is not a strategy. Plenty of brands have a full grid and an empty inbox. Social media starts paying when every post has a job: build trust, answer an objection, show the product in use, or give someone a reason to message you today.</p>

<h2>Social strategy before content production</h2>
<p>Before we design a single post we look at who buys from you, what they ask before buying and which competitors they compare you with. That becomes a monthly content calendar with a clear mix of formats and a small number of themes you can own.</p>

<h2>Instagram management</h2>
<p>Page setup and optimisation, post and carousel design, captions in English and Hinglish, and scheduling. Our Launch plan covers Instagram and Facebook; Growth adds LinkedIn and YouTube.</p>

<h2>Reels and short-form video</h2>
<p>Hooks, scripts, shoots and edits built for the first three seconds, plus ad cutdowns from the same footage. <a href="/blog-nine-reels-beat-2l-budget">Here is what nine Reels that outperformed a ₹2L ad budget had in common.</a></p>

<h2>Content calendars and creative systems</h2>
<p>A consistent look matters more than any single post. We build templates, colour and type rules so your feed, your ads and your website look like one company, and so new content can be produced quickly without losing that consistency.</p>

<h2>Community management</h2>
<p>Comments and DMs are answered, not left for a week. Buying questions are routed to your team or into a WhatsApp follow-up, so interest turns into a conversation.</p>

<h2>Social and paid media together</h2>
<p>Every Launch plan includes ₹3–5K a month of audience-building ads. Posts that perform organically get promoted, and the winners feed your paid campaigns. Because one team runs both, there is no gap between the content calendar and the ad account.</p>

<h2>D2C and B2B social media</h2>
<p>For D2C brands, social is about product proof, creators and launches that drive store visits. For B2B, it is founder-led LinkedIn content, case studies and proof that shortens a sales cycle. We run a different plan for each.</p>

<div class="bm-callout"><h4>Client work</h4><p>We run content and creative for Fabindia and social and Reels for Community Chulha. For OPPO's F29 5G launch we matched the brand with a creator whose audience crosses beauty, fashion and tech; the sponsored Reel reached <strong>524K views</strong>, verified live on her profile. <a href="/work">See the work.</a></p></div>
""" + PROCESS + """
<h2>Social media pricing</h2>
<p>Our <strong>Launch plan is ₹24,999 a month</strong>: Instagram and Facebook, 12 posts and 4 reels a month, audience-building ads, a monthly content calendar, community management and a monthly report. <strong>Growth at ₹49,999</strong> adds LinkedIn and YouTube, 20 posts and 8 reels a month, plus Meta and Google Ads management. Prices exclude 18% GST and plans run month to month. <a href="/pricing">Compare every plan.</a></p>
""",
 faqs=[("Do you create content in Hindi or Hinglish?", "Yes. Copy is written in English and Hinglish as standard, matched to how your audience actually talks."),
       ("Do you shoot the content or do we?", "Either. We can plan and shoot Reels, work with footage you send, or combine both. Video production is bundled from ₹24,999 a month."),
       ("Which platforms do you manage?", "Launch covers Instagram and Facebook. Growth adds LinkedIn and YouTube. Dominate covers all platforms plus influencer coordination."),
       ("Who owns the content?", "You do. Source files are handed over every month, and there is no lock-in.")],
 rel=(["performance-marketing", "d2c-growth", "seo"], [("/influencer-marketing", "Service", "Influencer marketing", "Creators picked on numbers, measured in orders and revenue.")]),
 cta=("Want a feed that brings in enquiries?", "Book a free audit. We will review your profiles and show you what we would change first."),
))

# ─────────────────────────────── D2C growth
PAGES.append(dict(
 slug="d2c-growth", name="D2C growth", form="End-to-end",
 title="D2C Marketing Agency in India | Brand Marketian",
 desc="D2C growth marketing for Indian brands: Meta and Google catalogue ads, store CRO, creator-led growth, and email and WhatsApp retention, judged on contribution margin.",
 h1="D2C growth marketing agency in India",
 dek="From first sale to repeat buyer. Reels and creators at the top, catalogue ads in the middle, WhatsApp and email retention at the bottom, all judged on the profit left after costs.",
 proof=[("15+", "brands built from scratch"), ("₹30L+", "monthly ad spend managed across Meta and Google"), ("50+", "brands served across industries in India")],
 body="""
<p>Growing a D2C brand in India is not only about buying more traffic. Rising ad costs, discount-hungry buyers and marketplace competition mean the brands that win are the ones that make the second, third and fourth order cheaper than the first.</p>
<p>That is why we judge D2C accounts on contribution margin and repeat revenue, not on a headline ROAS that looks good in a screenshot.</p>

<h2>From first purchase to repeat revenue</h2>
<p>We map the full path: how people discover you, what makes them buy the first time, and what brings them back. Each stage gets its own creative, its own channel and its own number, so you can see exactly where growth is coming from.</p>

<h2>Meta and Google catalogue ads</h2>
<p>Dynamic product ads on Meta, Shopping and Performance Max on Google, and retargeting built around your catalogue. Product feeds are cleaned and structured so the right products reach the right people.</p>

<h2>D2C creative testing</h2>
<p>Creative is the biggest lever in D2C advertising. We test hooks, formats and offers every month and move budget to what wins. Reels, user-style content and creator footage feed both organic and paid.</p>

<h2>Landing page and store CRO</h2>
<p>Product pages, checkout flow, trust signals and site speed on mobile. A small lift in conversion rate makes every rupee of ad spend work harder, which is why store CRO is part of the D2C plan rather than an afterthought.</p>

<h2>Creator-led growth</h2>
<p>We pick creators on audience data, not follower counts, then run the best creator posts as ads. <a href="/influencer-marketing">See how our influencer marketing works.</a></p>

<h2>Email and WhatsApp retention</h2>
<p>Welcome flows, abandoned cart recovery, post-purchase follow-up and win-back campaigns on email and WhatsApp. <a href="/blog-whatsapp-funnels">Here is how we keep WhatsApp reply rates high without annoying people.</a></p>

<h2>Festive campaign strategy</h2>
<p>Diwali, Raksha Bandhan, wedding season and sale events are planned months ahead, with creative, budgets and stock aligned. <a href="/blog-festive-ad-calendar-d2c">This is the festive ad calendar we run for D2C brands.</a></p>

<div class="bm-callout"><h4>Client work</h4><p>We built pet care D2C brand The Pet Foundry from scratch, run performance ads for fashion D2C brand Libas, and handle e-commerce growth for Om Books International. <a href="/work">See the work.</a></p></div>
""" + PROCESS + """
<h2>D2C growth pricing</h2>
<p>Full D2C growth, including store CRO, creator coordination, email and WhatsApp automation and Google, YouTube and programmatic ads, is part of our <strong>Dominate plan at ₹89,999 a month</strong>. Newer brands often start on <strong>Growth at ₹49,999</strong> with Meta and Google Ads and landing pages. Prices exclude 18% GST, ad spend is billed separately, and plans run month to month. <a href="/pricing">Compare every plan.</a></p>
""",
 faqs=[("Do you work with Shopify stores?", "Yes. We work with Shopify and other e-commerce platforms, and can build or rebuild the store if needed. Website development is quoted separately."),
       ("Do you manage marketplaces like Amazon?", "Marketplace presence is part of our e-commerce work. Tell us which marketplaces matter to you and we will include them in the plan."),
       ("What metric do you report on?", "Contribution margin and repeat revenue first, with blended ROAS, cost per order and new versus returning customers alongside."),
       ("Can you launch a brand from scratch?", "Yes. We have built 15+ brands from scratch, including brand identity, website, content and the first campaigns.")],
 rel=(["performance-marketing", "social-media-marketing", "seo"], [("/blog-best-d2c-growth-agency-india", "Guide", "How to choose a D2C growth agency in India", "What separates a growth partner from an ad-buying vendor.")]),
 cta=("Want to grow without discounting?", "Book a free audit. We will review your store, ads and retention and show you where the margin is leaking."),
))

# ─────────────────────────────── B2B lead gen
PAGES.append(dict(
 slug="b2b-lead-generation", name="B2B lead generation", form="End-to-end",
 title="B2B Lead Generation Agency in India | Brand Marketian",
 desc="B2B lead generation for Indian companies: Google intent campaigns, LinkedIn, landing pages, lead scoring and CRM routing, reported to pipeline and closed deals.",
 h1="B2B lead generation agency in India",
 dek="Pipeline your sales team believes in. We build demand with search and content, capture it with intent campaigns, and report to closed deals, not to form fills.",
 proof=[("₹30L", "B2B deal closed within three months for Divine Home India"), ("₹100Cr+", "pipeline built for one client from scratch"), ("₹30L+", "monthly ad spend managed across Meta and Google")],
 body="""
<p>B2B marketing is judged by one question from the sales team: are these leads any good? Long cycles, several decision makers and high deal values mean a cheap lead that never converts is worse than no lead at all.</p>
<p>So we build B2B lead generation backwards from the sale: who signs, what they need to believe, and which signals show a lead is worth a salesperson's time.</p>

<h2>Build pipeline, not just leads</h2>
<p>We agree the definition of a qualified lead with your sales team in week one, then optimise campaigns towards that definition. Reports show pipeline and closed deals by source, so you can see which channels produce revenue rather than just activity.</p>

<h2>Google intent campaigns</h2>
<p>Search campaigns that reach buyers actively looking for your product or service, with tight keyword control and landing pages matched to each intent. For most B2B businesses this is the fastest source of qualified demand.</p>

<h2>LinkedIn demand generation</h2>
<p>LinkedIn campaigns targeted by job title, company size and industry, paired with founder-led content and case studies that build credibility before a sales conversation starts.</p>

<h2>Landing pages and lead qualification</h2>
<p>Offer, landing page, form, WhatsApp follow-up and handoff to your sales system, built as one system. Forms ask the questions your sales team needs, so unqualified leads are filtered out before anyone picks up the phone.</p>

<h2>Lead scoring and CRM routing</h2>
<p>Leads are scored and routed straight into your CRM, whether that is HubSpot or a shared sheet, with source data attached. Sales sees where each lead came from, and marketing sees what happened to it.</p>

<h2>Sales enablement</h2>
<p>Case studies, pitch material and follow-up sequences that help your team close. SEO content clusters are mapped to revenue pages, so organic search keeps adding pipeline over time.</p>

<h2>B2B results</h2>
<div class="bm-callout"><h4>Divine Home India · home décor, Delhi</h4>
<p>A Delhi décor label needed a working B2B sales pipeline from zero, in three months, with no existing brand presence. We built the brand from scratch and pointed every conversation at closing wholesale and direct-buyer deals. The result was a <strong>₹30L B2B deal closed within three months</strong>, with an ₹80L pipeline targeted by Diwali.</p></div>
<div class="bm-callout"><h4>First Fiddle · paid ads and funnels</h4>
<p>A paid-ads and funnel system built from zero for a franchise consulting business has generated a <strong>₹100Cr+ pipeline</strong> for this single client.</p></div>
""" + PROCESS + """
<h2>B2B lead generation pricing</h2>
<p>Lead generation, with Meta and Google Ads, landing pages, lead forms and WhatsApp follow-up, is part of our <strong>Growth plan at ₹49,999 a month</strong>. Full B2B programmes with SEO, LinkedIn, email automation and website management sit in <strong>Dominate at ₹89,999</strong>. Prices exclude 18% GST, ad spend is billed separately, and plans run month to month. <a href="/pricing">Compare every plan.</a></p>
""",
 faqs=[("Do you run LinkedIn ads?", "Yes, where your buyers are on LinkedIn and your deal values support its costs. For many Indian B2B businesses, Google search brings cheaper qualified demand, so we test both."),
       ("Can you integrate with our CRM?", "Yes. We route leads into HubSpot, other CRMs or a shared sheet, with source tracking attached."),
       ("How do you define a qualified lead?", "Together with your sales team in week one, based on the criteria they use to decide whether to follow up, such as company size, role, budget or location."),
       ("Do you work with offline or field sales teams?", "Yes. The Divine Home India pipeline was built for offline deals. We connect marketing to however your team actually sells.")],
 rel=(["performance-marketing", "seo", "d2c-growth"], [("/blog-best-b2b-marketing-agency-delhi-ncr", "Guide", "How to choose a B2B marketing agency in Delhi NCR", "What to ask before you sign a B2B retainer.")]),
 cta=("Want leads your sales team calls back?", "Book a free audit. We will review your funnel from ad to CRM and show you where qualified leads are being lost."),
))

def render(p):
    url = f"https://brandmarketian.com/services/{p['slug']}"
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Service", "@id": url + "#service", "name": p["h1"], "serviceType": p["name"],
         "description": p["desc"], "url": url,
         "provider": {"@type": "Organization", "@id": "https://brandmarketian.com/#org", "name": "Brand Marketian", "url": "https://brandmarketian.com/"},
         "areaServed": [{"@type": "Country", "name": "India"}]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://brandmarketian.com/"},
            {"@type": "ListItem", "position": 2, "name": "Services", "item": "https://brandmarketian.com/services"},
            {"@type": "ListItem", "position": 3, "name": p["name"], "item": url}]},
        {"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", a)}}
            for q, a in p["faqs"]]}]}
    e = html.escape
    seo = f"""<!-- ================= SEO — generated by build_services.py ================= -->
<title>{e(p['title'])}</title>
<meta name="description" content="{e(p['desc'])}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta name="author" content="Brand Marketian">
<meta name="theme-color" content="#ff6600">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Brand Marketian">
<meta property="og:title" content="{e(p['title'])}">
<meta property="og:description" content="{e(p['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://brandmarketian.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(p['title'])}">
<meta name="twitter:description" content="{e(p['desc'])}">
<meta name="twitter:image" content="https://brandmarketian.com/og-image.png">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=2)}
</script>
<!-- ================= /SEO ================= -->"""
    head = re.sub(r"<!-- =+ SEO — edit this block =+ -->.*?<!-- =+ /SEO =+ -->", lambda m: seo, HEAD, flags=re.S)
    head = head.replace('<meta name="bm-page" content="blog">', f'<meta name="bm-page" content="service-{p["slug"]}">')
    head = head.replace("<!-- Pre-rendered static HTML. Edit the template in /prerender/src/blog-cpl-india-2026.html then run: node prerender/build.mjs -->",
                        "<!-- Generated static page. Edit the content in build_services.py (see /prerender/README.md) and re-run it. -->")
    head = head.replace("</head>", "") + EXTRA_CSS + "</head>"
    proof = "".join(f"<div><b>{v}</b><span>{l}</span></div>" for v, l in p["proof"])
    rel_keys, rel_extra = p["rel"]
    main = f"""<div class="bm-art-wrap">
    <nav class="bm-crumb"><a href="/">Home</a><span>/</span><a href="/services">Services</a><span>/</span>{p['name']}</nav>
    <header class="bm-art-hero">
      <span class="bm-eyebrow">{p['name']}</span>
      <h1>{p['h1']}</h1>
      <p class="bm-dek">{p['dek']}</p>
      <div class="bm-svc-actions"><a class="btn btn-primary" href="/contact">Book a free audit →</a><a class="btn btn-secondary" href="/pricing">See pricing</a></div>
      <div class="bm-svc-proof">{proof}</div>
    </header>
  </div>

  <div class="bm-article">
{p['body']}
{faq(p['faqs'])}
  </div>

  <div class="bm-cta">
    <h3>{p['cta'][0]}</h3>
    <p>{p['cta'][1]}</p>
    <a class="btn btn-primary" href="/contact">Book a free audit →</a>
  </div>

{related(rel_keys, rel_extra)}
"""
    foot = FOOT.replace(f"<option>{p['form']}</option>", f"<option selected>{p['form']}</option>", 1)
    return head + NAV + main + foot

out = FE / "services"
out.mkdir(exist_ok=True)
for p in PAGES:
    (out / f"{p['slug']}.html").write_text(render(p), encoding="utf-8", newline="")
    print("wrote services/" + p["slug"] + ".html")
