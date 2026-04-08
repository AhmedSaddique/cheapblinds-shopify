---
description: Build Tailwind CSS for Shopify theme
---
1. Ensure Node.js is installed.
2. Install Tailwind CSS locally if not already:
   // turbo
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   ```
3. Initialize Tailwind configuration (run once):
   // turbo
   ```bash
   npx tailwindcss init -p
   ```
4. Edit `tailwind.config.js` to set the `content` paths to include all Liquid and HTML files:
   ```js
   module.exports = {
     content: [
       "./**/*.liquid",
       "./assets/**/*.css",
       "./sections/**/*.liquid",
       "./templates/**/*.liquid",
     ],
     theme: {
       extend: {},
     },
     plugins: [],
   };
   ```
5. Update `styles/tailwind.css` to include Tailwind directives:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
6. Build the Tailwind CSS output to the assets folder:
   // turbo
   ```bash
   npx tailwindcss -i ./styles/tailwind.css -o ./assets/tailwind-built.css --minify
   ```
7. Include the generated `tailwind-built.css` in your theme layout after `base.css` to ensure utilities have higher precedence.
8. Optionally, remove or rename conflicting generic classes in `base.css` (e.g., `.hidden`, `.text-body`) or increase Tailwind utility specificity using `@layer utilities`.
9. Test by adding a Tailwind class (e.g., `bg-primary`) to a Liquid template and verify the style is applied.
