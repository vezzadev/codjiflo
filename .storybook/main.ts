import type { StorybookConfig } from "@storybook/react-vite";
import type { Plugin, PluginOption } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react-swc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Strip "use client" directives since Storybook is client-only
function stripUseClientDirective(): Plugin {
  return {
    name: "strip-use-client",
    transform(code, id) {
      if (id.includes("node_modules")) return null;
      if (!id.match(/\.[tj]sx?$/)) return null;

      const newCode = code.replace(/^['"]use client['"];?\s*/m, "");
      if (newCode !== code) {
        return { code: newCode, map: null };
      }
      return null;
    },
  };
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": resolve(__dirname, "../src"),
    };

    // Filter out existing React plugins and add our configured one
    config.plugins = (config.plugins || []).filter((plugin) => {
      const p = plugin as PluginOption & { name?: string };
      return !p?.name?.includes("vite:react");
    });

    // Add React SWC plugin (automatic JSX runtime)
    config.plugins.push(react());

    // Strip "use client" directives (not needed in Storybook)
    config.plugins.push(stripUseClientDirective());

    // Increase chunk size warning limit for Storybook bundles
    config.build = config.build || {};
    config.build.chunkSizeWarningLimit = 1200;

    return config;
  },
};

export default config;
