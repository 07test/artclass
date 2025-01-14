import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { createServer } from 'node:http';
import createBareServer from '@tomphttp/bare-server-node';
import express from 'express';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { getLastCommit } from 'git-last-commit';
import axios from 'axios';

getLastCommit((err, commit) => {
  if (!err) console.log(`Latest update: ${commit.subject} (${commit.committer.name})`);
});

const publicPath = fileURLToPath(new URL('./static/', import.meta.url));
const bare = createBareServer('/bare/');
const server = createServer();
const app = express();
/*
Trust proxy by default, if you are self hosting and not behind a reverse proxy,
you should disable this.
*/
app.set('trust proxy', true);
let dataScript;
const port = process.env.PORT || 3000;

app.use(express.static(publicPath));
app.use('/uv/', express.static(uvPath));
app.post("/data/event", express.json({
  type: 'text'
}));
app.post("/data/event", async (req, res, next) => {
  try {
    const data = await axios({
      method: 'post',
      url: 'https://artclass.site:8443/api/event',
      headers: {
        'Host': 'artclass.site',
        'X-Forwarded-For': req.ip,
        'X-Forwarded-Host': req.headers.host,
        'Content-Type': 'application/json',
        'User-Agent': req.headers['user-agent']
      },
      data: JSON.stringify(req.body),
      validateStatus: () => true
    });
    if(!data.data) return next();
    res.json(data.data);
  } catch(err) {
    next(err);
  }
});

app.get('/data/script.js', async (req, res, next) => {
  try {
    if(!dataScript) {
      const { data } = await axios({
        method: 'get',
        url: 'https://artclass.site:8443/js/script.js'
      });
      dataScript = data;
    };
    res.set('Content-Type', 'application/javascript');
    res.end(dataScript);
  } catch(err) {
    next(err);
  }
});

app.use((req, res) => res.status(404).sendFile(join(publicPath, '404.html')));
server.on('request', (req, res) => {
  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

server.listen({ port }, () => {
  console.log('Listening on:');
  console.log(`\thttp://localhost:${server.address().port}`);
  console.log(`\thttp://${hostname()}:${server.address().port}`);
  console.log(
    `\thttp://${
      server.address().family === 'IPv6' ? `[${server.address().address}]` : server.address().address
    }:${server.address().port}`
  );
});
