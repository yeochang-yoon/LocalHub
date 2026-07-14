import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import touristData from '../../../../data/부산_관광지.json'
import cultureData from '../../../../data/부산_문화시설.json'
import festivalData from '../../../../data/부산_축제공연행사.json'
import courseData from '../../../../data/부산_여행코스.json'
import leisureData from '../../../../data/부산_레포츠.json'
import stayData from '../../../../data/부산_숙박.json'
import shoppingData from '../../../../data/부산_쇼핑.json'

const SOURCES = [touristData, cultureData, festivalData, courseData, leisureData, stayData, shoppingData]

let database = null
let initialization = null

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE content_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE regions (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE districts (
    region_code TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT,
    PRIMARY KEY (region_code, code),
    FOREIGN KEY (region_code) REFERENCES regions(code)
  );

  CREATE TABLE places (
    id TEXT PRIMARY KEY,
    content_type_id TEXT NOT NULL,
    region_code TEXT,
    district_code TEXT,
    legal_region_code TEXT,
    legal_district_code TEXT,
    title TEXT NOT NULL,
    created_at TEXT,
    modified_at TEXT,
    FOREIGN KEY (content_type_id) REFERENCES content_types(id),
    FOREIGN KEY (region_code) REFERENCES regions(code)
  );

  CREATE TABLE place_addresses (
    place_id TEXT PRIMARY KEY,
    address1 TEXT,
    address2 TEXT,
    zipcode TEXT,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );

  CREATE TABLE place_coordinates (
    place_id TEXT PRIMARY KEY,
    longitude REAL,
    latitude REAL,
    map_level INTEGER,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );

  CREATE TABLE place_contacts (
    place_id TEXT PRIMARY KEY,
    telephone TEXT,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );

  CREATE TABLE place_images (
    place_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('original', 'thumbnail')),
    url TEXT NOT NULL,
    copyright_code TEXT,
    PRIMARY KEY (place_id, kind),
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );

  CREATE TABLE place_categories (
    place_id TEXT NOT NULL,
    system TEXT NOT NULL CHECK (system IN ('cat', 'lcls')),
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    code TEXT NOT NULL,
    PRIMARY KEY (place_id, system, level),
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_places_type ON places(content_type_id);
  CREATE INDEX idx_places_region ON places(region_code, district_code);
  CREATE INDEX idx_places_title ON places(title);
  CREATE INDEX idx_addresses_address1 ON place_addresses(address1);
  CREATE INDEX idx_categories_code ON place_categories(code);
`

function executeRows(db, sql, params = []) {
  const statement = db.prepare(sql)
  try {
    statement.bind(params)
    const rows = []
    while (statement.step()) rows.push(statement.getAsObject())
    return rows
  } finally {
    statement.free()
  }
}

function getInitializedDatabase() {
  if (!database) throw new Error('챗봇 데이터베이스가 아직 초기화되지 않았습니다.')
  return database
}

export function queryDatabase(sql, params = []) {
  return executeRows(getInitializedDatabase(), sql, params)
}

function insertDataset(db, source, statements) {
  statements.contentType.run([source.contentTypeId, source.contentType])
  statements.region.run(['BSG', source.region || '부산'])

  for (const item of source.items || []) {
    const regionCode = item.areacode || 'BSG'
    if (regionCode !== 'BSG') statements.region.run([regionCode, source.region || '부산'])
    if (item.sigungucode) statements.district.run([regionCode, item.sigungucode, null])

    statements.place.run([
      item.contentid,
      item.contenttypeid || source.contentTypeId,
      regionCode,
      item.sigungucode || null,
      item.lDongRegnCd || null,
      item.lDongSignguCd || null,
      item.title,
      item.createdtime || null,
      item.modifiedtime || null,
    ])
    statements.address.run([item.contentid, item.addr1 || null, item.addr2 || null, item.zipcode || null])
    statements.coordinate.run([
      item.contentid,
      Number.parseFloat(item.mapx) || null,
      Number.parseFloat(item.mapy) || null,
      Number.parseInt(item.mlevel, 10) || null,
    ])
    if (item.tel) statements.contact.run([item.contentid, item.tel])
    if (item.firstimage) statements.image.run([item.contentid, 'original', item.firstimage, item.cpyrhtDivCd || null])
    if (item.firstimage2) statements.image.run([item.contentid, 'thumbnail', item.firstimage2, item.cpyrhtDivCd || null])

    for (const [system, fields] of Object.entries({ cat: ['cat1', 'cat2', 'cat3'], lcls: ['lclsSystm1', 'lclsSystm2', 'lclsSystm3'] })) {
      fields.forEach((field, index) => {
        if (item[field]) statements.category.run([item.contentid, system, index + 1, item[field]])
      })
    }
  }
}

function populateDatabase(db) {
  const statements = {
    contentType: db.prepare('INSERT OR IGNORE INTO content_types (id, name) VALUES (?, ?)'),
    region: db.prepare('INSERT OR IGNORE INTO regions (code, name) VALUES (?, ?)'),
    district: db.prepare('INSERT OR IGNORE INTO districts (region_code, code, name) VALUES (?, ?, ?)'),
    place: db.prepare('INSERT OR REPLACE INTO places VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    address: db.prepare('INSERT OR REPLACE INTO place_addresses VALUES (?, ?, ?, ?)'),
    coordinate: db.prepare('INSERT OR REPLACE INTO place_coordinates VALUES (?, ?, ?, ?)'),
    contact: db.prepare('INSERT OR REPLACE INTO place_contacts VALUES (?, ?)'),
    image: db.prepare('INSERT OR REPLACE INTO place_images VALUES (?, ?, ?, ?)'),
    category: db.prepare('INSERT OR REPLACE INTO place_categories VALUES (?, ?, ?, ?)'),
  }

  db.run('BEGIN TRANSACTION')
  try {
    for (const source of SOURCES) insertDataset(db, source, statements)
    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  } finally {
    Object.values(statements).forEach((statement) => statement.free())
  }
}

export function initializeChatbotDatabase() {
  if (database) return Promise.resolve(database)
  if (initialization) return initialization

  initialization = initSqlJs({ locateFile: () => sqlWasmUrl }).then((SQL) => {
    const db = new SQL.Database()
    db.run(SCHEMA)
    populateDatabase(db)
    database = db
    return database
  })

  return initialization
}

export function getChatbotPlaces() {
  return queryChatbotDatabase(`
    SELECT
      p.id,
      ct.name AS type,
      p.title,
      COALESCE(a.address1, '') AS address1,
      COALESCE(a.address2, '') AS address2,
      COALESCE(c.telephone, '') AS tel,
      COALESCE(i.url, '') AS image,
      co.latitude AS lat,
      co.longitude AS lng,
      GROUP_CONCAT(pc.code, ',') AS category_codes
    FROM places p
    JOIN content_types ct ON ct.id = p.content_type_id
    LEFT JOIN place_addresses a ON a.place_id = p.id
    LEFT JOIN place_contacts c ON c.place_id = p.id
    LEFT JOIN place_coordinates co ON co.place_id = p.id
    LEFT JOIN place_images i ON i.place_id = p.id AND i.kind = 'original'
    LEFT JOIN place_categories pc ON pc.place_id = p.id
    GROUP BY p.id
  `)
}

export function getChatbotDatabaseStats() {
  if (!database) return null
  const [row] = queryChatbotDatabase(`
    SELECT
      (SELECT COUNT(*) FROM content_types) AS contentTypes,
      (SELECT COUNT(*) FROM places) AS places,
      (SELECT COUNT(*) FROM place_categories) AS categories,
      (SELECT COUNT(*) FROM place_images) AS images
  `)
  return row
}
