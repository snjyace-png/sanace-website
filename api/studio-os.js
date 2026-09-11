// Vercel serverless function: proxies SANACE Studio OS data (leads, projects,
// project logs, contacts) to the same private GitHub repo Studio Log already
// syncs to -- so the token, secret, and repo never touch the browser.
//
// Reuses the exact same environment variables as api/studio-log.js:
//
//   GITHUB_TOKEN           GitHub fine-grained PAT scoped to the private data
//                          repo only.
//   GITHUB_DATA_REPO       "owner/repo" of that private repo.
//   STUDIO_LOG_API_SECRET  The shared password -- one unlock covers Studio
//                          Log, Wiki, and Studio OS.

module.exports = async function handler(req, res) {
  var secret = process.env.STUDIO_LOG_API_SECRET;
  var token = process.env.GITHUB_TOKEN;
  var repo = process.env.GITHUB_DATA_REPO;

  if (!secret || !token || !repo) {
    res.status(500).json({ error: 'Studio OS API is not configured.' });
    return;
  }

  var authHeader = req.headers['authorization'] || '';
  var provided = authHeader.replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  var contentsUrl = 'https://api.github.com/repos/' + repo + '/contents/studio-os.json';
  var githubHeaders = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'studio-os-sync'
  };

  var emptyState = {
    leads: [],
    projects: [],
    logs: [],
    contacts: [],
    counters: { lead: 0, project: 0, log: 0, contact: 0 }
  };

  try {
    if (req.method === 'GET') {
      var getResp = await fetch(contentsUrl, { headers: githubHeaders });
      if (getResp.status === 404) {
        res.status(200).json(emptyState);
        return;
      }
      if (!getResp.ok) {
        var getErrBody = await getResp.text();
        res.status(getResp.status).json({ error: 'GitHub read failed', detail: getErrBody });
        return;
      }
      var file = await getResp.json();
      var content = Buffer.from(file.content, 'base64').toString('utf-8');
      var state;
      try {
        state = JSON.parse(content);
      } catch (parseErr) {
        state = emptyState;
      }
      res.status(200).json(state);
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
      var stateToSave = {
        leads: (body && body.leads) || [],
        projects: (body && body.projects) || [],
        logs: (body && body.logs) || [],
        contacts: (body && body.contacts) || [],
        counters: (body && body.counters) || emptyState.counters
      };

      // Need the file's current sha to overwrite it (absent if it doesn't exist yet).
      var currentResp = await fetch(contentsUrl, { headers: githubHeaders });
      var currentSha;
      if (currentResp.ok) {
        var currentFile = await currentResp.json();
        currentSha = currentFile.sha;
      }

      var newContent = Buffer.from(JSON.stringify(stateToSave, null, 2)).toString('base64');
      var putBody = {
        message: 'Studio OS update — ' + new Date().toISOString(),
        content: newContent
      };
      if (currentSha) {
        putBody.sha = currentSha;
      }

      var putResp = await fetch(contentsUrl, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, githubHeaders),
        body: JSON.stringify(putBody)
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
