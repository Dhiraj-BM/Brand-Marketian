/* Brand Marketian — Content Studio configuration.
   Set the address of your Content API here once, then everyone who opens
   admin.brandmarketian.com is pointed at it automatically.

   - api:        the base URL of the backend API (the server/ app).
   - siteOrigin: the public website, used for the "Preview" button and for
                 building image URLs.

   You can leave api empty and instead type it on the login screen
   (Advanced → API address); it is then remembered on that device only. */
window.BM_CONFIG = {
  // api.brandmarketian.com has no DNS record yet (confirmed via DNS lookup),
  // so the admin panel could not reach the backend at all. Pointing this at
  // the live Render service (already deployed and CORS-allowed for this
  // origin) restores login. Once a CNAME for api.brandmarketian.com is
  // added in Cloudflare and verified as a custom domain on the Render
  // service, swap this back to 'https://api.brandmarketian.com'.
  api: 'https://brand-marketian-api.onrender.com',
  siteOrigin: 'https://brandmarketian.com'
};
