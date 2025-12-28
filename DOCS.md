# Eviqo MQTT Gateway

This addon bridges your Eviqo EV charger to MQTT, enabling seamless integration with Home Assistant through auto-discovery.

## Features

- **Automatic Entity Discovery**: Sensors and controls automatically appear in Home Assistant
- **Real-time Updates**: Charging status, power, voltage, and session data
- **Charging Control**: Start/stop charging sessions via Home Assistant switch
- **Current Limit Control**: Adjust charging current via slider (0-48A)

## Entities Created

### Sensors
- **Status**: Current charger state (unplugged, plugged, charging, stopped)
- **Voltage**: Line voltage (V)
- **Power**: Current charging power (kW)
- **Amperage**: Current draw (A)
- **Session Duration**: Current session length
- **Session Power**: Energy delivered this session (kWh)
- **Session Cost**: Cost of current session

### Controls
- **Charging**: Switch to start/stop charging
- **Current Limit**: Number slider to set max charging current (A)

### Binary Sensors
- **Connectivity**: Online/offline status

## Configuration

### MQTT Settings

The addon supports two MQTT configuration methods:

#### Auto-Discovery (Recommended)
If you have the Mosquitto broker addon installed, MQTT settings will be automatically discovered. Just leave the MQTT fields empty.

#### Manual Configuration
If using an external MQTT broker, configure:
- **mqtt_host**: MQTT broker hostname or IP
- **mqtt_port**: MQTT broker port (default: 1883)
- **mqtt_username**: MQTT username (if required)
- **mqtt_password**: MQTT password (if required)

### Eviqo Credentials

Enter your Eviqo app credentials:
- **eviqo_email**: Your Eviqo account email
- **eviqo_password**: Your Eviqo account password

### Advanced Options

- **topic_prefix**: MQTT topic prefix (default: `eviqo`)
- **discovery_prefix**: Home Assistant discovery prefix (default: `homeassistant`)
- **poll_interval**: Update interval in milliseconds (default: 30000)
- **debug**: Enable debug logging

## Docker Standalone Usage

You can also run this as a standalone Docker container:

```bash
docker run -d \
  --name eviqo-mqtt \
  -e EVIQO_EMAIL=your@email.com \
  -e EVIQO_PASSWORD=yourpassword \
  -e MQTT_HOST=192.168.1.100 \
  -e MQTT_PORT=1883 \
  ghcr.io/tsightler/eviqo-mqtt-amd64
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| EVIQO_EMAIL | Yes | - | Eviqo account email |
| EVIQO_PASSWORD | Yes | - | Eviqo account password |
| MQTT_HOST | No | localhost | MQTT broker host |
| MQTT_PORT | No | 1883 | MQTT broker port |
| MQTT_USERNAME | No | - | MQTT username |
| MQTT_PASSWORD | No | - | MQTT password |
| EVIQO_TOPIC_PREFIX | No | eviqo | MQTT topic prefix |
| HASS_DISCOVERY_PREFIX | No | homeassistant | HA discovery prefix |
| EVIQO_POLL_INTERVAL | No | 30000 | Poll interval (ms) |
| LOG_LEVEL | No | info | Log level (debug, info, warn, error) |

## Troubleshooting

### Entities not appearing
1. Check the addon logs for errors
2. Verify MQTT connection is working
3. Try restarting the addon

### Authentication errors
- Verify your Eviqo credentials are correct
- Ensure you can log into the Eviqo mobile app

### Debug logging
Enable debug mode in the addon configuration to see detailed logs.

## Support

For issues and feature requests, please visit:
https://github.com/tsightler/eviqo/issues
