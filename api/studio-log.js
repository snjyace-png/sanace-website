module.exports = async function handler(req, res) {
  const secret = process.env.STUDIO_LOG_API_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'Studio Log is not configured.' });
    return;
  }

  const auth = req.headers.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (provided !== secret) {
    res.status(401).json({ error: 'Incorrect password.' });
    return;
  }

  res.status(200).json({ ok: true });
};
