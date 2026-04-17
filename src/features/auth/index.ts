// Only export the provider component for use in layout.tsx
// Individual hooks should be imported directly from their files
// to avoid pulling client hooks into server components
export { AuthProvider } from './components';
