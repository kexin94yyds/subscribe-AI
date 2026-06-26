# Appwrite Cloud Sync Table

MonoExpire uses Appwrite as the Supabase replacement for cloud sync.

## GitHub Student Pack

Appwrite is available through GitHub Student Developer Pack as an Education plan. Use the Appwrite Cloud project values in `.env.local`.

## Project Env

```env
VITE_APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=<PROJECT_ID>
VITE_APPWRITE_DATABASE_ID=<DATABASE_ID>
VITE_APPWRITE_TABLE_ID=monoexpire_items
```

## Auth

Enable Email Magic URL auth in Appwrite Auth. Add each app URL as an allowed platform/hostname, including local web development and any production or Capacitor callback host you use.

## Table

Create one table named `monoexpire_items`.

Rows use a deterministic Appwrite row ID derived from `item_type:item_id`, so the same local item updates the same cloud row across devices.

Columns:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `item_type` | string | yes | `subscription`, `reminder`, or `goal` |
| `item_id` | string | yes | MonoExpire local item ID |
| `payload_json` | string | yes | JSON string for the item payload |
| `updated_at` | string | yes | ISO timestamp used for conflict resolution |
| `deleted_at` | string | no | Empty string means active; ISO timestamp means tombstone |
| `device_id` | string | no | MonoExpire device ID |

Permissions:

- Enable row-level security / document security for the table.
- Grant authenticated users permission to create rows.
- The client writes per-row read, update, and delete permissions for the current user.

Indexes:

- Optional: add a key index on `item_type`.
- Optional: add a key index on `item_id`.
