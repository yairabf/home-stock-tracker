# Home Assistant integration

Home Stock Tracker provides a local, read-only custom integration for viewing
household grocery, inventory, and low-stock data in Home Assistant. It does not
create services, webhooks, automations, or write requests to the inventory
service.

## Install

Copy the repository component into your Home Assistant configuration directory:

```bash
mkdir -p /config/custom_components
cp -R integrations/home-assistant/custom_components/home_stock_tracker \
  /config/custom_components/
```

Restart Home Assistant, then add **Home Stock Tracker** from
**Settings > Devices & services > Add integration**.

Enter the service origin, for example `http://inventory.local:3000`, and the
service bearer token. The URL must be an HTTP or HTTPS origin without an API
path. The integration validates the token against an authenticated read route
and stores it only in the Home Assistant config entry.

For a local repository checkout, run the component tests with:

```bash
integrations/home-assistant/.venv/bin/python -m pytest -q integrations/home-assistant/tests
```

## Entities

The integration polls the authenticated Home Stock Tracker REST API every five
minutes. All three entities use the same refresh, so their values describe one
consistent service response.

| Entity | State | Attributes |
| --- | --- | --- |
| `sensor.pending_groceries` | Pending grocery count | `items` from `GET /api/v1/grocery/items` |
| `sensor.tracked_inventory` | Count of current and uncertain inventory records | Separate `current` and `uncertain` records from `GET /api/v1/inventory` |
| `sensor.low_stock_recommendations` | Actionable recommendation count | `recommendations` from `GET /api/v1/inventory/predictions/low-stock` |

An empty successful response produces a state of `0`. A connection error,
authentication rejection, non-success response, or invalid response makes all
three entities unavailable. Home Assistant starts its normal reauthentication
flow when the service token is rejected.

The integration sends only authenticated `GET` requests to the documented
versioned REST routes. It never calls MCP, invokes predictions, or changes
grocery, product, inventory, purchase, or feedback data.
