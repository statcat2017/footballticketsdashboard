-- Return to the default state established by 030; 030 can then remove the column.
UPDATE competitions SET public_category = 'uncategorized';
