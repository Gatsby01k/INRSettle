-- Audit rows are append-only at the database boundary. The application role
-- may INSERT and SELECT but any UPDATE/DELETE fails, even if a future code path
-- accidentally attempts it. A database owner can still perform controlled
-- maintenance by explicitly disabling the trigger; production access to that
-- role must therefore be tightly restricted and audited separately.

CREATE OR REPLACE FUNCTION "prevent_audit_log_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION "prevent_audit_log_mutation"();
