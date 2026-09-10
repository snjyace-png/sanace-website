// Vercel serverless function: proxies Studio Log entries to a private
// GitHub repo, so the log syncs across devices without ever sending the
// GitHub token -- or the raw data -- to the browser.
//
// Requires three environment variables, set in the Vercel project's
// dashboard (Settings -> Environment Variables), never committed to git:
//
//   GITHUB_TOKEN           A GitHub fine-grained personal access token,
//                          scoped to ONLY the data repo below, with
//                          Contents: Read and write permission and nothing
//                          else. If this ever leaked it could only touch
//                          that one private repo, not the live site.
//   GITHUB_DATA_REPO       "owner/repo" of the private repo holding
//                          entries.json (e.g. "snjyace-png/studio-log-data").
//   STUDIO_LOG_API_SECRET  The real password. The client sends whatever was
//                          typed at the page's gate as the Authorization
//                          header; this is the only thing checked against
//                          it. A wrong or missing value gets a 401 with no
//                          data -- this is the actual access control, not
//                          the page's client-side gate (which is just UI).

module.exports = async function handler(req, res) {
  var secret = process.env.STUDIO_LOG_API_SECRET;
  var token = process.env.GITHUB_TOKEN;
  var repo = process.env.GITHUB_DATA_REPO;

  if (!secret || !token || !repo) {
    res.status(500).json({ error: 'Studio Log API is not configured.' });
    return;
  }

  var authHeader = req.headers['authorization'] || '';
  var provided = authHeader.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  var contentsUrl = 'https://api.github.com/repos/' + repo + '/contents/entries.json';
  var githubHeaders = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'studio-log-sync'
  };

  try {
    if (req.method === 'GET') {
      var getResp = await fetch(contentsUrl, { headers: githubHeaders });
      if (!getResp.ok) {
        var getErrBody = await getResp.text();
        res.status(getResp.status).json({ error: 'GitHub read failed', detail: getErrBody });
        return;
      }
      var file = await getResp.json();
      var content = Buffer.from(file.content, 'base64').toString('utf-8');
      var entries;
      try {
        entries = JSON.parse(content);
      } catch (parseErr) {
        entries = [];
      }
      res.status(200).json({ entries: entries });
      return;
    }

    if (req.method === 'PUT') {
      var body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (parseErr) {
          body = {};
        }
      }
      var entriesToSave = (body && body.entries) || [];

      // Need the file's current sha to overwrite it.
      var currentResp = await fetch(contentsUrl, { headers: githubHeaders });
      var currentSha;
      if (currentResp.ok) {
        var currentFile = await currentResp.json();
        currentSha = currentFile.sha;
      }

      var newContent = Buffer.from(JSON.stringify(entriesToSave, null, 2)).toString('base64');
      var putResp = await fetch(contentsUrl, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, githubHeaders),
        body: JSON.stringify({
          message: 'Studio Log update — ' + new Date().toISOString(),
          content: newContent,
          sha: currentSha
        })
      });

      if (!putResp.ok) {
        var putErrBody = await putResp.text();
        res.status(putResp.status).json({ error: 'GitHub write failed', detail: putErrBody });
        return;
      }

      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error', detail: String(err && err.message || err) });
  }
};
