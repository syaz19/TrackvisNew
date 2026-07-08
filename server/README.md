Release stuck RFID tags

Place your Firebase service account JSON at `server/serviceAccountKey.json` then run:

```bash
cd server
node release_stuck_tags.js
```

This script will set `rfid_tags/{epc}` to `Status: "Available"` for any tag currently marked `In Use` that has no active visitor referencing it.
