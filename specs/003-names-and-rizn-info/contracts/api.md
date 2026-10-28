# HTTP API Contract Changes: First Names and RIZN Youth Info

| Method & path | Change |
|---|---|
| `POST /api/crew/entries` | Optional multipart field `firstNames`: JSON `{ "<passId>": "Ben" }`. Keys must be passes in `passIds[]`. An empty string or omission means no name. Errors: `400 invalid_request` with the message "First name only" for an invalid name, or a pass that isn't in this entry. |
| `PATCH /api/crew/entries/:id` | Same field. A key with `""` clears that pass's name. Passes not listed keep their names. |
| `GET /api/crew/passes?q=` | Also matches first names. Each hit adds `firstName: string \| null`. |
| `GET /api/crew/passes/scan` | The hit adds `firstName`. |
| `DELETE /api/crew/entries/:id` | Also clears the first names of its passes. |
| `GET /api/qr.svg?to=rizn` | QR code for `PUBLIC_URL/rizn`. Any other `to` value returns the join QR code. |
| `GET /rizn` (page) | Public, no auth, no event window. |

`EntryCard.displayName` now uses first names where they are set. No other type changes.
