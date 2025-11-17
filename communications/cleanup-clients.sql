-- Clean up clients column to remove any entries with colons
UPDATE players 
SET clients = (
  SELECT json_group_array(value)
  FROM json_each(clients)
  WHERE value NOT LIKE '%:%'
)
WHERE clients LIKE '%:%';

-- Clean up current_client to remove anything after colon
UPDATE players
SET current_client = substr(current_client, 1, instr(current_client || ':', ':') - 1)
WHERE current_client LIKE '%:%';

-- Show cleaned data
SELECT uuid, name, current_client, clients FROM players LIMIT 10;
