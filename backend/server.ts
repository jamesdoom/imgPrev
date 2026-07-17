import { createApp } from "./app";
import { getServerBinding } from "./serverConfig";

const { host, port } = getServerBinding();
const app = createApp();

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
