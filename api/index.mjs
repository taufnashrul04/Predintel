// Vercel serverless entry: every /api/* request is rewritten here (see vercel.json) and handled
// by the same Express app the dev server uses. Express apps are plain (req, res) handlers.
export { default } from '../server/app.mjs'
