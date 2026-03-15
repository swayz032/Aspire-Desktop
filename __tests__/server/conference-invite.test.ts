/**
 * Conference Invitation Pipeline — Unit Tests
 *
 * Tests the critical data integrity fixes:
 * 1. Lookup endpoint filters out users without resolved auth user_id
 * 2. Invite endpoint rejects missing/invalid invitee_suite_id
 * 3. No suite_id ↔ user_id mismatch possible in the pipeline
 *
 * Law #3: Fail closed — no silent fallbacks
 * Law #6: Tenant isolation — suite_id and user_id must never be swapped
 */

// ─── Extracted Logic Under Test ──────────────────────────────────────────────
// These mirror the actual server logic from livekit.ts so we can unit test
// without spinning up Express.

/** Simulates the lookup endpoint's user resolution + filter (livekit.ts:442-448) */
function filterLookupResults(
  members: Array<{ email: string | null; suite_id: string; owner_name: string; business_name: string }>,
  userIdMap: Record<string, string>,
) {
  return members
    .filter((row) => row.email && userIdMap[row.email!])
    .map((row) => ({
      userId: userIdMap[row.email!],
      suiteId: row.suite_id,
      name: row.owner_name || 'Unknown',
      businessName: row.business_name || '',
    }));
}

/** Simulates the client-side invite payload construction (conference.tsx:207-211) */
function buildInvitePayload(
  suiteId: string | undefined,
  memberId: string,
  roomName: string,
): { invitee_suite_id: string; invitee_user_id: string; room_name: string } | null {
  // Law #3: Fail closed — suiteId must be present
  if (!suiteId) return null;
  return {
    invitee_suite_id: suiteId,
    invitee_user_id: memberId,
    room_name: roomName,
  };
}

/** Simulates server-side UUID validation (livekit.ts:738-760) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateInviteRequest(body: {
  invitee_suite_id?: string;
  invitee_user_id?: string;
  room_name?: string;
}): { valid: boolean; error?: string } {
  if (!body.invitee_suite_id || !body.invitee_user_id || !body.room_name) {
    return { valid: false, error: 'invitee_suite_id, invitee_user_id, and room_name are required' };
  }
  if (!UUID_RE.test(body.invitee_suite_id)) {
    return { valid: false, error: 'invitee_suite_id must be a valid UUID' };
  }
  if (!UUID_RE.test(body.invitee_user_id)) {
    return { valid: false, error: 'invitee_user_id must be a valid UUID' };
  }
  return { valid: true };
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const SUITE_ID_A = '11111111-1111-1111-1111-111111111111';
const SUITE_ID_B = '22222222-2222-2222-2222-222222222222';
const USER_ID_ALICE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID_BOB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Conference Invite Pipeline', () => {
  describe('Lookup endpoint — user resolution filter', () => {
    it('returns users with resolved auth user_id', () => {
      const members = [
        { email: 'alice@test.com', suite_id: SUITE_ID_A, owner_name: 'Alice', business_name: 'Alice Co' },
      ];
      const userIdMap = { 'alice@test.com': USER_ID_ALICE };

      const results = filterLookupResults(members, userIdMap);

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe(USER_ID_ALICE);
      expect(results[0].suiteId).toBe(SUITE_ID_A);
    });

    it('filters OUT users without resolved auth user_id (Law #3: fail closed)', () => {
      const members = [
        { email: 'alice@test.com', suite_id: SUITE_ID_A, owner_name: 'Alice', business_name: 'Alice Co' },
        { email: 'orphan@test.com', suite_id: SUITE_ID_B, owner_name: 'Orphan', business_name: '' },
      ];
      // Only Alice has a profiles entry
      const userIdMap = { 'alice@test.com': USER_ID_ALICE };

      const results = filterLookupResults(members, userIdMap);

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe(USER_ID_ALICE);
      // Orphan was filtered out — NOT returned with suite_id as userId
    });

    it('filters OUT members with null email', () => {
      const members = [
        { email: null, suite_id: SUITE_ID_A, owner_name: 'No Email', business_name: '' },
      ];
      const userIdMap = {};

      const results = filterLookupResults(members, userIdMap);

      expect(results).toHaveLength(0);
    });

    it('NEVER returns suite_id as userId (Law #6 regression)', () => {
      const members = [
        { email: 'noauth@test.com', suite_id: SUITE_ID_A, owner_name: 'Ghost', business_name: '' },
      ];
      // No auth user exists for this email
      const userIdMap = {};

      const results = filterLookupResults(members, userIdMap);

      // Must not contain any result where userId === suite_id
      for (const r of results) {
        expect(r.userId).not.toBe(r.suiteId);
      }
      expect(results).toHaveLength(0);
    });
  });

  describe('Client-side invite payload — fail closed', () => {
    it('returns payload when suiteId is present', () => {
      const payload = buildInvitePayload(SUITE_ID_A, USER_ID_BOB, 'room-123');

      expect(payload).not.toBeNull();
      expect(payload!.invitee_suite_id).toBe(SUITE_ID_A);
      expect(payload!.invitee_user_id).toBe(USER_ID_BOB);
    });

    it('returns null when suiteId is undefined (Law #3: fail closed)', () => {
      const payload = buildInvitePayload(undefined, USER_ID_BOB, 'room-123');

      expect(payload).toBeNull();
    });

    it('returns null when suiteId is empty string (Law #3: fail closed)', () => {
      const payload = buildInvitePayload('', USER_ID_BOB, 'room-123');

      expect(payload).toBeNull();
    });

    it('NEVER falls back memberId as suiteId (Law #6 regression)', () => {
      // This was the original bug: suiteId || memberId
      // Now suiteId is required — no fallback
      const payload = buildInvitePayload(undefined, USER_ID_BOB, 'room-123');

      // If payload were constructed, invitee_suite_id must NOT be USER_ID_BOB
      expect(payload).toBeNull();
    });
  });

  describe('Server-side invite validation', () => {
    it('rejects missing invitee_suite_id', () => {
      const result = validateInviteRequest({
        invitee_user_id: USER_ID_BOB,
        room_name: 'room-123',
      });

      expect(result.valid).toBe(false);
    });

    it('rejects missing invitee_user_id', () => {
      const result = validateInviteRequest({
        invitee_suite_id: SUITE_ID_A,
        room_name: 'room-123',
      });

      expect(result.valid).toBe(false);
    });

    it('rejects non-UUID invitee_suite_id', () => {
      const result = validateInviteRequest({
        invitee_suite_id: 'not-a-uuid',
        invitee_user_id: USER_ID_BOB,
        room_name: 'room-123',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invitee_suite_id must be a valid UUID');
    });

    it('rejects non-UUID invitee_user_id', () => {
      const result = validateInviteRequest({
        invitee_suite_id: SUITE_ID_A,
        invitee_user_id: 'not-a-uuid',
        room_name: 'room-123',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invitee_user_id must be a valid UUID');
    });

    it('accepts valid invite request', () => {
      const result = validateInviteRequest({
        invitee_suite_id: SUITE_ID_A,
        invitee_user_id: USER_ID_BOB,
        room_name: 'room-123',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('End-to-end data integrity', () => {
    it('lookup → invite payload preserves correct suite_id/user_id separation', () => {
      // Simulate: lookup returns Alice with proper IDs
      const members = [
        { email: 'alice@test.com', suite_id: SUITE_ID_A, owner_name: 'Alice', business_name: 'Alice Co' },
      ];
      const userIdMap = { 'alice@test.com': USER_ID_ALICE };
      const lookupResults = filterLookupResults(members, userIdMap);

      // Client uses lookup result to build invite
      const target = lookupResults[0];
      const payload = buildInvitePayload(target.suiteId, target.userId, 'room-456');

      // Validate: suite_id and user_id are distinct and correct
      expect(payload).not.toBeNull();
      expect(payload!.invitee_suite_id).toBe(SUITE_ID_A);
      expect(payload!.invitee_user_id).toBe(USER_ID_ALICE);
      expect(payload!.invitee_suite_id).not.toBe(payload!.invitee_user_id);

      // Server validates
      const validation = validateInviteRequest(payload!);
      expect(validation.valid).toBe(true);
    });

    it('lookup with unresolved user → empty results → no invite possible', () => {
      // Simulate: member exists in suite_profiles but not in auth profiles
      const members = [
        { email: 'ghost@test.com', suite_id: SUITE_ID_B, owner_name: 'Ghost', business_name: '' },
      ];
      const userIdMap = {}; // No auth user

      const lookupResults = filterLookupResults(members, userIdMap);

      // No results → client cannot build invite
      expect(lookupResults).toHaveLength(0);
    });
  });
});
