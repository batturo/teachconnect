import { app } from './app.js';
import { startScheduler } from './lifecycle.js';

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`TeachConnect server listening on http://localhost:${port}`);
  startScheduler();
});
