export async function onRequestGet(context) {
  const row = await context.env.DB
    .prepare("SELECT datetime('now') AS now")
    .first()

  return Response.json({ ok: true, databaseTime: row.now })
}
