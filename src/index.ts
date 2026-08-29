import { app } from './app';
import 'dotenv/config';
import { env } from './schemas/env.schema';

const ENVIRONMENT = env.NODE_ENV;
const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running in ${ENVIRONMENT} mode on port ${PORT}`);
});
