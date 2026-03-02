-- Constrain auth_header_name to safe values.
-- Allows: NULL (no auth header), 'Authorization' (used by bearer auth), or X- prefixed headers.
-- Blocks dangerous standard HTTP headers (Host, Content-Length, Transfer-Encoding, etc.)

alter table public.notification_endpoints
  add constraint notification_endpoints_auth_header_name_safe
  check (
    auth_header_name is null
    or auth_header_name = 'Authorization'
    or auth_header_name ~ '^X-[A-Za-z0-9][A-Za-z0-9-]{0,62}$'
  );
