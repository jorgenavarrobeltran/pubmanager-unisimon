UPDATE books b SET repository_url = m.new_url
FROM _book_migration m
WHERE LOWER(TRIM(b.title)) = LOWER(m.title_match)
  AND m.new_url != '' AND b.repository_url IS NULL;

UPDATE books b SET notes = m.new_notes
FROM _book_migration m
WHERE LOWER(TRIM(b.title)) = LOWER(m.title_match)
  AND m.new_notes != '' AND (b.notes IS NULL OR b.notes = '');

DROP TABLE _book_migration;

SELECT (SELECT COUNT(*) FROM books WHERE repository_url IS NOT NULL) as with_url,
       (SELECT COUNT(*) FROM books WHERE notes IS NOT NULL AND notes != '') as with_notes;