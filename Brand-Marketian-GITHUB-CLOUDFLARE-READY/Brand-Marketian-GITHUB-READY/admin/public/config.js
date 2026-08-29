/* Brand Marketian — Content Studio configuration.
   Set the address of your Content API here once, then everyone who opens
   admin.brandmarketian.com is pointed at it automatically.

   - api:        the base URL of the backend API (the server/ app).
   - siteOrigin: the public website, used for the "Preview" button and for
                 building image URLs.

   You can leave api empty and instead type it on the login screen
   (Advanced → API address); it is then remembered on that device only. */
window.BM_CONFIG = {
  api: 'https://api.brandmarketian.com',
  siteOrigin: 'https://brandmarketian.com'
};
