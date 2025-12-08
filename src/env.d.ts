// Type declarations for Vite-style asset imports and ?url query imports
// This file allows importing assets like `import img from '/logo.png?url'` in TS
// and returns a string URL at runtime.

declare module '*?url' {
  const src: string;
  export default src;
}

// Common image extensions used by the project
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}
