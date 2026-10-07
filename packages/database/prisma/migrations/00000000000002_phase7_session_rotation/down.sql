-- Reverses 00000000000002_phase7_session_rotation. Dropping this column loses the
-- rotation-chain pointer for any session rows that had it set, but no session is
-- otherwise affected — refresh/revocation still work from the other columns alone.
ALTER TABLE "sessions" DROP COLUMN "rotatedToSessionId";
