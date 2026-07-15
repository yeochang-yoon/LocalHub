import { queryDatabase } from '@/features/chatbot/services/chatbotDatabase'

export function getBusanFestivalCalendarItems() {
  return queryDatabase(
    `
    SELECT
      p.id AS contentId,
      p.title,
      p.modified_at AS modifiedtime,
      COALESCE(a.address1, '') AS address1,
      COALESCE(a.address2, '') AS address2
    FROM places p
    JOIN content_types ct ON ct.id = p.content_type_id
    LEFT JOIN place_addresses a ON a.place_id = p.id
    WHERE
      (ct.id = '15' OR ct.name IN ('축제·공연', '축제공연행사'))
      AND p.modified_at IS NOT NULL
      AND TRIM(p.modified_at) != ''
    ORDER BY p.modified_at DESC
    `
  )
}
