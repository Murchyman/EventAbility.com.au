import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import UnoCSS from "unocss/astro";
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";
import partytown from '@astrojs/partytown'
import compress from "astro-compress";

export default defineConfig({
  adapter: netlify({
    imageCDN: false,
  }),
  output: "server",
  security: {
    checkOrigin: true,
  },
  
  site: "https://socialspot.com.au",
  trailingSlash: "ignore",
  integrations: [react(), sitemap(), UnoCSS({ injectReset: true }), compress(),partytown({ config: { forward: ["dataLayer.push"] } })],
});
