import {
  initializeChatbotDatabase,
  queryDatabase,
} from '../../chatbot/services/chatbotDatabase.js'

function normalizeString(value) {
  return String(value ?? '').trim()
}

export async function searchBoardPlaces(category, query = '') {
  await initializeChatbotDatabase()

  const term = normalizeString(query)

  const rows = queryDatabase(
    `
    SELECT
      p.id AS contentId,
      ct.name AS category,
      p.title AS name,
      COALESCE(a.address1, '') AS address
    FROM places p
    JOIN content_types ct
      ON ct.id = p.content_type_id
    LEFT JOIN place_addresses a
      ON a.place_id = p.id
    WHERE ct.name = ?
      AND p.title LIKE ?
    LIMIT 50
    `,
    [
      category,
      `%${term}%`,
    ],
  )

  return rows
}