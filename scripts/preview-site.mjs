import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.TAROT_PREVIEW_PORT||4178);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=http.createServer(async(request,response)=>{
 response.setHeader('Cache-Control','no-store');
 response.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(request.method)){
  response.writeHead(503,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error:'PREVIEW_ONLY',message:'本地预览不调用AI或处理账号、支付操作。'}));return;
 }
 try{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   response.writeHead(url.pathname==='/api/me'?401:503,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error:'PREVIEW_ONLY',message:'This local preview does not connect to live services.'}));return;
  }
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(file!==path.resolve(root)&&!file.startsWith(path.resolve(root)+path.sep)){response.writeHead(403).end('Forbidden');return;}
  if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
  else if(!path.extname(file)){
   try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch{file+='.html';}
  }
  const data=await readFile(file);response.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  response.setHeader('Content-Length',data.length);response.end(request.method==='HEAD'?undefined:data);
 }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found');}
});
server.on('error',error=>{console.error(`Preview could not start: ${error.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${server.address().port}/zh/learn/\nStatic pages only. Live AI, accounts and payments are disabled.`));
