import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = process.env.PUBLIC_SITE_URL || "https://sunionpeaks.pages.dev";
const visibleInSitemap = (page) => {
  const pathname = new URL(page).pathname;
  return pathname !== "/" && !/^\/404(?:\.html|\/)?$/.test(pathname) && !pathname.startsWith("/admin");
};

export default defineConfig({
  site,
  integrations: [mdx(), sitemap({ filter: visibleInSitemap })],
  vite: {
    plugins: [tailwindcss()]
  }
});
