const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');

const DEFAULT_QUESTIONS = [
  {dim:'Carga de trabalho', text:'Tenho volume de trabalho compatível com o tempo disponível.', direction:'positive'},
  {dim:'Jornada', text:'Minha jornada permite descanso e recuperação adequados.', direction:'positive'},
  {dim:'Liderança', text:'Recebo orientação clara, respeito e apoio da liderança.', direction:'positive'},
  {dim:'Comunicação', text:'As informações importantes chegam de forma clara e no tempo certo.', direction:'positive'},
  {dim:'Assédio', text:'O ambiente é respeitoso, sem constrangimentos, humilhações ou discriminação.', direction:'positive'},
  {dim:'Autonomia', text:'Tenho autonomia adequada para organizar minhas atividades.', direction:'positive'},
  {dim:'Reconhecimento', text:'Sinto que meu trabalho é reconhecido e valorizado.', direction:'positive'},
  {dim:'Suporte', text:'Tenho apoio emocional e operacional quando enfrento dificuldades.', direction:'positive'},
  {dim:'Conflitos', text:'Conflitos são tratados de forma justa e segura.', direction:'positive'},
  {dim:'Segurança psicológica', text:'Sinto segurança para falar sobre problemas sem medo de retaliação.', direction:'positive'}
];

function token(len=10){ return crypto.randomBytes(len).toString('hex'); }
function defaultQuestionSet(){ return { id: token(6), version: 1, name:'Questionário NR-1 Padrão', status:'active', createdAt:new Date().toISOString(), questions: DEFAULT_QUESTIONS }; }
function migrateData(data){
  data.companies = Array.isArray(data.companies) ? data.companies : [];
  data.responses = Array.isArray(data.responses) ? data.responses : [];
  if(!Array.isArray(data.questionSets) || !data.questionSets.length){
    const qs = defaultQuestionSet();
    data.questionSets = [qs];
    data.activeQuestionSetId = qs.id;
  }
  if(!data.activeQuestionSetId || !data.questionSets.find(q=>q.id===data.activeQuestionSetId)){
    data.activeQuestionSetId = data.questionSets[data.questionSets.length-1].id;
  }
  for(const c of data.companies){ if(!c.questionSetId) c.questionSetId = data.activeQuestionSetId; }
  for(const r of data.responses){
    if(!r.questionSetId){
      const c = data.companies.find(x=>x.id===r.companyId);
      r.questionSetId = c?.questionSetId || data.activeQuestionSetId;
    }
  }
  return data;
}
function readData(){
  try { return migrateData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); }
  catch(e){
    const initial = migrateData({ companies: [], responses: [], createdAt: new Date().toISOString() });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
}
function writeData(data){ fs.writeFileSync(DATA_FILE, JSON.stringify(migrateData(data), null, 2)); }
function send(res, code, body, type='application/json'){
  res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' });
  res.end(body);
}
function parseBody(req){
  return new Promise(resolve=>{
    let body=''; req.on('data', chunk=> body += chunk);
    req.on('end', ()=>{ try{ resolve(body ? JSON.parse(body) : {}); } catch(e){ resolve({}); } });
  });
}
function getNetworkUrls(port){
  const nets = os.networkInterfaces();
  let ips=[];
  for (const name of Object.keys(nets)) for (const net of nets[name] || []) if(net.family === 'IPv4' && !net.internal) ips.push(net.address);
  const urls = ips.map(ip=>`http://${ip}:${port}`);
  return { ips, urls, preferredUrl: urls[0] || `http://localhost:${port}` };
}
function safePublicCompany(c){ return { id:c.id, name:c.name, cnpj:c.cnpj||'', segment:c.segment||'', employees:c.employees||'', city:c.city||'', formToken:c.formToken, dashToken:c.dashToken, questionSetId:c.questionSetId, createdAt:c.createdAt }; }
function publicQuestionSet(qs){ return { id:qs.id, version:qs.version, name:qs.name, createdAt:qs.createdAt, questions:qs.questions }; }

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  if(req.method === 'OPTIONS') return send(res, 204, '');

  if(pathname === '/api/server-info' && req.method === 'GET') return send(res, 200, JSON.stringify(getNetworkUrls(PORT)));

  if(pathname === '/api/question-set/active' && req.method === 'GET'){
    const data = readData();
    const qs = data.questionSets.find(q=>q.id===data.activeQuestionSetId);
    return send(res, 200, JSON.stringify(publicQuestionSet(qs)));
  }
  if(pathname === '/api/question-sets' && req.method === 'GET'){
    const data = readData();
    return send(res, 200, JSON.stringify({activeQuestionSetId:data.activeQuestionSetId, questionSets:data.questionSets.map(q=>({id:q.id, version:q.version, name:q.name, createdAt:q.createdAt, questions:q.questions}))}));
  }
  if(pathname === '/api/question-sets' && req.method === 'POST'){
    const body = await parseBody(req);
    const questions = Array.isArray(body.questions) ? body.questions.map(q=>({dim:String(q.dim||'Geral').trim(), text:String(q.text||'').trim(), direction:q.direction==='negative'?'negative':'positive'})).filter(q=>q.text.length>3) : [];
    if(questions.length < 3) return send(res, 400, JSON.stringify({error:'Cadastre pelo menos 3 perguntas.'}));
    const data = readData();
    const lastVersion = Math.max(...data.questionSets.map(q=>Number(q.version)||1));
    data.questionSets.forEach(q=>q.status='archived');
    const qs = { id:token(6), version:lastVersion+1, name:body.name || `Questionário NR-1 v${lastVersion+1}`, status:'active', createdAt:new Date().toISOString(), questions };
    data.questionSets.push(qs); data.activeQuestionSetId = qs.id; writeData(data);
    return send(res, 200, JSON.stringify(publicQuestionSet(qs)));
  }

  if(pathname === '/api/companies' && req.method === 'GET'){
    const data = readData();
    return send(res, 200, JSON.stringify(data.companies.map(safePublicCompany)));
  }
  if(pathname === '/api/companies' && req.method === 'POST'){
    const body = await parseBody(req);
    if(!body.name || String(body.name).trim().length < 2) return send(res, 400, JSON.stringify({error:'Informe o nome da empresa.'}));
    const data = readData();
    const company = {
      id: token(8), name: String(body.name).trim(), cnpj: body.cnpj||'', segment: body.segment||'', employees: body.employees||'', city: body.city||'',
      questionSetId: data.activeQuestionSetId,
      formToken: token(9), dashToken: token(9), createdAt: new Date().toISOString()
    };
    data.companies.push(company); writeData(data);
    return send(res, 200, JSON.stringify(safePublicCompany(company)));
  }
  if(pathname.startsWith('/api/company/form/') && req.method === 'GET'){
    const formToken = pathname.split('/').pop(); const data = readData();
    const c = data.companies.find(x=>x.formToken===formToken);
    if(!c) return send(res, 404, JSON.stringify({error:'Link de formulário não encontrado.'}));
    const qs = data.questionSets.find(q=>q.id===c.questionSetId) || data.questionSets.find(q=>q.id===data.activeQuestionSetId);
    return send(res, 200, JSON.stringify({ id:c.id, name:c.name, segment:c.segment||'', questionSet: publicQuestionSet(qs) }));
  }
  if(pathname.startsWith('/api/company/dashboard/') && req.method === 'GET'){
    const dashToken = pathname.split('/').pop(); const data = readData();
    const c = data.companies.find(x=>x.dashToken===dashToken);
    if(!c) return send(res, 404, JSON.stringify({error:'Link de dashboard não encontrado.'}));
    const responses = data.responses.filter(r=>r.companyId===c.id);
    const qs = data.questionSets.find(q=>q.id===c.questionSetId) || data.questionSets.find(q=>q.id===data.activeQuestionSetId);
    return send(res, 200, JSON.stringify({ company:safePublicCompany(c), responses, questionSet: publicQuestionSet(qs) }));
  }
  if(pathname === '/api/responses' && req.method === 'GET'){
    const data = readData();
    return send(res, 200, JSON.stringify(data.responses));
  }
  if(pathname === '/api/responses' && req.method === 'POST'){
    const body = await parseBody(req); const data = readData();
    const c = data.companies.find(x=>x.formToken===body.formToken);
    if(!c) return send(res, 404, JSON.stringify({error:'Empresa não encontrada.'}));
    const qs = data.questionSets.find(q=>q.id===c.questionSetId);
    const qCount = qs?.questions?.length || 0;
    if(!Array.isArray(body.answers) || body.answers.length !== qCount) return send(res, 400, JSON.stringify({error:'Respostas incompletas.'}));
    const response = { id:token(8), companyId:c.id, questionSetId:c.questionSetId, answers:body.answers.map(Number), sector: body.sector||'Não informado', workMode: body.workMode||'Não informado', createdAt:new Date().toISOString() };
    data.responses.push(response); writeData(data);
    return send(res, 200, JSON.stringify({ok:true, message:'Resposta registrada com sucesso.'}));
  }
  if(pathname === '/api/export' && req.method === 'GET') return send(res, 200, JSON.stringify(readData(), null, 2));
  if(pathname === '/api/reset-demo' && req.method === 'POST'){
    const initial = migrateData({ companies: [], responses: [], resetAt:new Date().toISOString() }); writeData(initial);
    return send(res, 200, JSON.stringify({ok:true}));
  }

  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if(!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(ROOT, 'index.html');
  const ext = path.extname(filePath).toLowerCase();
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
  fs.readFile(filePath, (err, content)=>{
    if(err) return send(res, 500, 'Erro interno', 'text/plain');
    send(res, 200, content, types[ext] || 'application/octet-stream');
  });
});

server.listen(PORT, '0.0.0.0', ()=>{
  const info = getNetworkUrls(PORT);
  console.log('\n==============================================');
  console.log(' GESTÃO RH NR-1 - SERVIDOR EM REDE');
  console.log('==============================================');
  console.log(` Painel local: http://localhost:${PORT}`);
  info.ips.forEach(ip=>console.log(` Abrir na rede: http://${ip}:${PORT}`));
  console.log(' Deixe esta janela aberta enquanto usar o sistema.');
  console.log(' Para parar: CTRL + C');
  console.log('==============================================\n');
});
