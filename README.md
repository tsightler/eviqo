# EVIQO Project

This monorepo contains packages for interacting with the EVIQO L2 EVSE, including an API client that implements authentication and websocket parsing, and an MQTT gateway.

The initial versions of the API were ported from the [evipy project](https://github.com/zacharyasmith/evipy) and much credit should go to the author of that project for the initial reverse engineering work.

## Packages

| Package | Description |
|---------|-------------|
| [eviqo-client-api](./packages/eviqo-client-api) | Node.js/TypeScript client library for EVIQO L2 EVSE  |
| [eviqo-mqtt](./packages/eviqo-mqtt) | EVIQO-to-MQTT gateway with Home Assistant auto-discovery support |

## Quick Start

### Client API

```typescript
import { EviqoWebsocketConnection, WS_URL } from 'eviqo-client-api';

const client = new EviqoWebsocketConnection(
  WS_URL,
  null,
  'user@example.com',
  'password'
);

client.on('widgetUpdate', (update) => {
  console.log(`${update.widgetStream.name}: ${update.widgetValue}`);
});

await client.run();
```

### MQTT Gateway

```bash
# Set credentials
export EVIQO_EMAIL="user@example.com"
export EVIQO_PASSWORD="password"
export MQTT_HOST="localhost"

# Run the gateway
npx eviqo-mqtt
```

## Development

This is an npm workspaces monorepo.

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Build specific package
npm run build -w eviqo-client-api
npm run build -w eviqo-mqtt
```

## License

MIT
