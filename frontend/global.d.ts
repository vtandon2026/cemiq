// global.d.ts
// Tells TypeScript that CSS files can be imported as side-effects
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}