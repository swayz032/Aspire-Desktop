import { buildMaterialsHref, parseMaterialsFilter, MATERIALS_FILTER_PARAM } from '@/lib/scopeTakeoffBridge';

describe('scopeTakeoffBridge', () => {
  it('builds an href for a chapter slice with URL-encoded value', () => {
    expect(buildMaterialsHref({ chapterKey: 'restrooms-mothers-room' }))
      .toBe('/service-hub/estimate-studio/takeoff?materials_filter=chapter%3Arestrooms-mothers-room');
  });

  it('builds an href with no filter when chapter key is null', () => {
    expect(buildMaterialsHref({ chapterKey: null }))
      .toBe('/service-hub/estimate-studio/takeoff');
  });

  it('parses a chapter filter back from query string', () => {
    expect(parseMaterialsFilter('chapter:restrooms-mothers-room'))
      .toEqual({ kind: 'chapter', chapterKey: 'restrooms-mothers-room' });
  });

  it('parses null on missing, empty, or malformed filter', () => {
    expect(parseMaterialsFilter(null)).toBeNull();
    expect(parseMaterialsFilter(undefined)).toBeNull();
    expect(parseMaterialsFilter('')).toBeNull();
    expect(parseMaterialsFilter('garbage')).toBeNull();
    expect(parseMaterialsFilter('chapter:')).toBeNull();
    expect(parseMaterialsFilter('chapter:   ')).toBeNull();
  });

  it('exports the query param name as a stable constant', () => {
    expect(MATERIALS_FILTER_PARAM).toBe('materials_filter');
  });

  it('round-trips: parse(build(x)) recovers the original chapter key', () => {
    const href = buildMaterialsHref({ chapterKey: 'walls-and-rooms' });
    const url = new URL(href, 'http://localhost');
    const raw = url.searchParams.get(MATERIALS_FILTER_PARAM);
    expect(parseMaterialsFilter(raw)).toEqual({ kind: 'chapter', chapterKey: 'walls-and-rooms' });
  });
});
