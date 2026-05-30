# Trade Gate Supabase Schema

This folder contains the forward schema for Trade Gate's normalized database model.

Apply the migration in `migrations/20260529190000_trade_gate_core_schema.sql` in the Supabase SQL editor or with the Supabase CLI. The app keeps the existing `trade_gate_state` JSON sync as the compatibility cache, then writes normalized rows as a best-effort secondary sync when these tables exist.

The intended migration path is:

1. Apply the core schema.
2. Keep `trade_gate_state` as fallback.
3. Let new saves populate normalized tables.
4. Move reads from JSON snapshots to normalized tables feature by feature.
5. Move chart images to Supabase Storage and store only `storage_path` in `trade_gate_instrument_images`.
