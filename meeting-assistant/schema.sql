CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL DEFAULT '',
  endTime TEXT NOT NULL DEFAULT '',
  attendeesJson TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date, startTime);
