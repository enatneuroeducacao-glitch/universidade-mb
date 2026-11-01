const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 8 });
const PORT = Number(process.env.PORT || 10000);
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://universidade.mboptica.com.br';
const COOKIE_NAME = 'universidade_mb_admin_v2';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origin !== SITE_ORIGIN && !/^https:\/\/universidade-mb\.onrender\.com$/.test(origin)) return res.status(403).json({ error: 'Origem não autorizada.' });
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(session({
  name: COOKIE_NAME,
  store: new PgSession({ pool, tableName: 'admin_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'none', maxAge: 8 * 60 * 60 * 1000 }
}));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.admin) return res.status(401).json({ error: 'Autenticação administrativa obrigatória.' });
  next();
}
function audit(userId, action, entityType, entityId, details = {}) {
  return pool.query('INSERT INTO admin_audit_log(admin_user_id, action, entity_type, entity_id, details) VALUES($1,$2,$3,$4,$5)', [userId, action, entityType, entityId == null ? null : String(entityId), JSON.stringify(details)]).catch(err => console.error('audit error', err.message));
}
async function initialize() {
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || !process.env.ADMIN_BOOTSTRAP_EMAIL) throw new Error('DATABASE_URL, SESSION_SECRET e ADMIN_BOOTSTRAP_EMAIL são obrigatórios.');
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','editor')), is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_login_at TIMESTAMPTZ
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT 'Fundamentos', duration TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '📘',
    sort_order INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS course_modules (
    id BIGSERIAL PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL, content_html TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
    duration_minutes INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS course_assessments (
    id BIGSERIAL PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    question TEXT NOT NULL, answers JSONB NOT NULL DEFAULT '[]'::jsonb, correct_answer INTEGER NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS course_assets (
    id BIGSERIAL PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_id BIGINT REFERENCES course_modules(id) ON DELETE SET NULL, original_filename TEXT NOT NULL,
    storage_key TEXT NOT NULL, mime_type TEXT NOT NULL, file_size_bytes BIGINT NOT NULL DEFAULT 0,
    uploaded_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('ALTER TABLE course_assets ADD COLUMN IF NOT EXISTS file_data BYTEA');
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY, admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_courses_status_sort ON courses(status, sort_order)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_modules_course_sort ON course_modules(course_id, sort_order)');
  await pool.query(`CREATE TABLE IF NOT EXISTS learner_progress (
    learner_id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
    progress JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_learner_progress_updated ON learner_progress(updated_at DESC)');
  await pool.query(`CREATE TABLE IF NOT EXISTS learners (
    id BIGSERIAL PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_login_at TIMESTAMPTZ
  )`);
}
app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'universidade-mb-api' }); }
  catch { res.status(503).json({ ok: false }); }
});
app.post('/api/admin/bootstrap', loginLimiter, async (req, res) => {
  // Cadastro inicial público desativado. Novos administradores só podem ser
  // criados por uma sessão administrativa autenticada em /api/admin/users.
  return res.status(410).json({ error: 'O cadastro inicial público está desativado. Solicite acesso a um administrador autorizado.' });
});
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await pool.query('SELECT id,email,password_hash,role,is_active FROM admin_users WHERE email=$1', [email]);
  if (!user.rowCount || !user.rows[0].is_active || !(await bcrypt.compare(String(req.body.password || ''), user.rows[0].password_hash))) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  req.session.admin = { id: user.rows[0].id, email: user.rows[0].email, role: user.rows[0].role };
  await pool.query('UPDATE admin_users SET last_login_at=NOW() WHERE id=$1', [user.rows[0].id]);
  await audit(user.rows[0].id, 'login', 'admin_user', user.rows[0].id);
  res.json({ authenticated: true, admin: req.session.admin });
});
app.post('/api/admin/users', requireAdmin, loginLimiter, async (req,res) => {
  if (req.session.admin.role !== 'admin') return res.status(403).json({error:'Somente administradores autorizados podem criar novos acessos.'});
  const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
  if (!/^\\S+@\\S+\\.\\S+$/.test(email)) return res.status(400).json({error:'Informe um e-mail válido.'});
  if (password.length<6 || password.length>128) return res.status(400).json({error:'A senha deve ter entre 6 e 128 caracteres.'});
  try {
    const hash=await bcrypt.hash(password,12);
    const result=await pool.query("INSERT INTO admin_users(email,password_hash,role,is_active) VALUES($1,$2,'admin',TRUE) RETURNING id,email,role",[email,hash]);
    await audit(req.session.admin.id,'create_admin','admin_user',result.rows[0].id,{email});
    return res.status(201).json({admin:result.rows[0]});
  } catch(e) {
    if(e.code==='23505') return res.status(409).json({error:'Já existe um administrador com este e-mail.'});
    console.error('create admin error',e.message); return res.status(500).json({error:'Não foi possível criar o administrador.'});
  }
});
app.post('/api/admin/logout', requireAdmin, (req, res) => req.session.destroy(() => { res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'none' }); res.json({ authenticated: false }); }));
app.get('/api/admin/me', (req, res) => res.json({ authenticated: Boolean(req.session?.admin), admin: req.session?.admin || null }));
app.post('/api/learners/register', loginLimiter, async (req,res) => {
 const fullName=String(req.body.full_name||'').trim().replace(/\s+/g,' ').slice(0,160), email=String(req.body.email||'').trim().toLowerCase().slice(0,254), password=String(req.body.password||'');
 if(fullName.length<3)return res.status(400).json({error:'Informe seu nome completo.'});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Informe um e-mail válido.'});
 if(password.length<6||password.length>128)return res.status(400).json({error:'A senha deve ter entre 6 e 128 caracteres.'});
 try{const hash=await bcrypt.hash(password,12);const r=await pool.query('INSERT INTO learners(full_name,email,password_hash) VALUES($1,$2,$3) RETURNING id,full_name,email',[fullName,email,hash]);req.session.learner={id:String(r.rows[0].id),full_name:r.rows[0].full_name,email:r.rows[0].email};res.status(201).json({learner:req.session.learner});}
 catch(e){if(e.code==='23505')return res.status(409).json({error:'Este e-mail já está cadastrado. Entre na sua conta.'});console.error(e.message);res.status(500).json({error:'Não foi possível criar a conta.'});}
});
app.post('/api/learners/login', loginLimiter, async (req,res) => {
 const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
 const r=await pool.query('SELECT id,full_name,email,password_hash,is_active FROM learners WHERE email=$1',[email]);const u=r.rows[0];
 if(!u||!u.is_active||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:'E-mail ou senha incorretos.'});
 req.session.learner={id:String(u.id),full_name:u.full_name,email:u.email};await pool.query('UPDATE learners SET last_login_at=NOW() WHERE id=$1',[u.id]);res.json({learner:req.session.learner});
});
app.get('/api/learners/me',(req,res)=>res.json({learner:req.session?.learner||null}));
app.post('/api/learners/logout',(req,res)=>{if(req.session)delete req.session.learner;res.json({ok:true});});
app.post('/api/progress/sync', async (req,res) => {
  if (!req.session?.learner) return res.status(401).json({error:'Entre na sua conta para sincronizar o progresso.'});
  const learnerId=String(req.session.learner.id), displayName=req.session.learner.full_name, email=req.session.learner.email, progress=req.body.progress;
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return res.status(400).json({error:'Dados de progresso inválidos.'});
  const safeProgress = {
    completed: Array.isArray(progress.completed) ? progress.completed.filter(v => typeof v === 'string').slice(0,100) : [],
    scores: progress.scores && typeof progress.scores === 'object' ? progress.scores : {},
    modulePassed: progress.modulePassed && typeof progress.modulePassed === 'object' ? progress.modulePassed : {},
    moduleBestScores: progress.moduleBestScores && typeof progress.moduleBestScores === 'object' ? progress.moduleBestScores : {},
    updatedAt: new Date().toISOString()
  };
  await pool.query(`INSERT INTO learner_progress(learner_id,display_name,email,progress,updated_at) VALUES($1,$2,$3,$4,NOW())
    ON CONFLICT(learner_id) DO UPDATE SET display_name=CASE WHEN EXCLUDED.display_name<>'' THEN EXCLUDED.display_name ELSE learner_progress.display_name END,
    email=CASE WHEN EXCLUDED.email<>'' THEN EXCLUDED.email ELSE learner_progress.email END, progress=EXCLUDED.progress, updated_at=NOW()`,
    [learnerId,displayName,email,JSON.stringify(safeProgress)]);
  res.json({ saved:true, updated_at:safeProgress.updatedAt, notice:'Progresso sincronizado. A identidade do participante ainda não foi verificada.' });
});
app.get('/api/admin/learner-progress', requireAdmin, async (req,res) => {
  const result = await pool.query('SELECT learner_id,display_name,email,progress,updated_at FROM learner_progress ORDER BY updated_at DESC LIMIT 500');
  res.json({ learners: result.rows });
});
app.get('/api/courses', async (req, res) => {
  const publishedOnly = req.query.all !== 'true';
  if (!publishedOnly) return requireAdmin(req, res, async () => {
    const result = await pool.query('SELECT c.*, COALESCE(json_agg(json_build_object(\'id\',m.id,\'title\',m.title,\'content_html\',m.content_html,\'sort_order\',m.sort_order,\'duration_minutes\',m.duration_minutes) ORDER BY m.sort_order) FILTER (WHERE m.id IS NOT NULL), \'[]\'::json) AS modules FROM courses c LEFT JOIN course_modules m ON m.course_id=c.id GROUP BY c.id ORDER BY c.sort_order,c.title');
    res.json({ courses: result.rows });
  });
  const result = await pool.query('SELECT c.id,c.slug,c.title,c.description,c.level,c.duration,c.icon,c.sort_order, COALESCE(json_agg(json_build_object(\'id\',m.id,\'title\',m.title,\'content_html\',m.content_html,\'sort_order\',m.sort_order,\'duration_minutes\',m.duration_minutes) ORDER BY m.sort_order) FILTER (WHERE m.id IS NOT NULL), \'[]\'::json) AS modules FROM courses c LEFT JOIN course_modules m ON m.course_id=c.id WHERE c.status=\'published\' GROUP BY c.id ORDER BY c.sort_order,c.title');
  res.json({ courses: result.rows });
});
app.post('/api/courses', requireAdmin, async (req, res) => {
  const { id, slug, title, description = '', level = 'Fundamentos', duration = '', icon = '📘', sort_order = 0, status = 'draft' } = req.body;
  if (!id || !slug || !title || !['draft','published','archived'].includes(status)) return res.status(400).json({ error: 'Identificador, slug, título e situação válida são obrigatórios.' });
  const duplicate = await pool.query('SELECT id FROM courses WHERE lower(title)=lower($1)', [title.trim()]);
  if (duplicate.rowCount) return res.status(409).json({ error: 'Já existe um curso com esse título.' });
  const result = await pool.query('INSERT INTO courses(id,slug,title,description,level,duration,icon,sort_order,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [id,slug,title.trim(),description,level,duration,icon,sort_order,status,req.session.admin.id]);
  await audit(req.session.admin.id, 'create', 'course', id, { title });
  res.status(201).json({ course: result.rows[0] });
});
app.put('/api/courses/:id', requireAdmin, async (req, res) => {
  const { slug, title, description = '', level = 'Fundamentos', duration = '', icon = '📘', sort_order = 0, status = 'draft' } = req.body;
  if (!slug || !title || !['draft','published','archived'].includes(status)) return res.status(400).json({ error: 'Slug, título e situação válida são obrigatórios.' });
  const duplicate = await pool.query('SELECT id FROM courses WHERE lower(title)=lower($1) AND id<>$2', [title.trim(), req.params.id]);
  if (duplicate.rowCount) return res.status(409).json({ error: 'Já existe outro curso com esse título.' });
  const result = await pool.query('UPDATE courses SET slug=$1,title=$2,description=$3,level=$4,duration=$5,icon=$6,sort_order=$7,status=$8,updated_at=NOW() WHERE id=$9 RETURNING *', [slug,title.trim(),description,level,duration,icon,sort_order,status,req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Curso não encontrado.' });
  await audit(req.session.admin.id, 'update', 'course', req.params.id, { title });
  res.json({ course: result.rows[0] });
});
app.delete('/api/courses/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
  await audit(req.session.admin.id, 'delete', 'course', req.params.id);
  res.json({ deleted: true });
});
app.post('/api/courses/:id/modules', requireAdmin, async (req, res) => {
  const { title, content_html = '', sort_order = 0, duration_minutes = null } = req.body;
  if (!title) return res.status(400).json({ error: 'Título do módulo obrigatório.' });
  const result = await pool.query('INSERT INTO course_modules(course_id,title,content_html,sort_order,duration_minutes) VALUES($1,$2,$3,$4,$5) RETURNING *', [req.params.id,title,content_html,sort_order,duration_minutes]);
  await audit(req.session.admin.id, 'create', 'course_module', result.rows[0].id, { course_id: req.params.id });
  res.status(201).json({ module: result.rows[0] });
});
app.put('/api/modules/:id', requireAdmin, async (req, res) => {
  const { title, content_html = '', sort_order = 0, duration_minutes = null } = req.body;
  const result = await pool.query('UPDATE course_modules SET title=$1,content_html=$2,sort_order=$3,duration_minutes=$4,updated_at=NOW() WHERE id=$5 RETURNING *', [title,content_html,sort_order,duration_minutes,req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Módulo não encontrado.' });
  await audit(req.session.admin.id, 'update', 'course_module', req.params.id);
  res.json({ module: result.rows[0] });
});
app.delete('/api/modules/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM course_modules WHERE id=$1', [req.params.id]);
  await audit(req.session.admin.id, 'delete', 'course_module', req.params.id);
  res.json({ deleted: true });
});
app.post('/api/courses/:id/assets', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Selecione um arquivo.' });
  const allowed = new Set(['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
  if (!allowed.has(req.file.mimetype)) return res.status(415).json({ error: 'Tipo de arquivo não permitido.' });
  const result = await pool.query('INSERT INTO course_assets(course_id,module_id,original_filename,storage_key,mime_type,file_size_bytes,uploaded_by,file_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,course_id,module_id,original_filename,mime_type,file_size_bytes,created_at', [req.params.id,req.body.module_id || null,req.file.originalname, 'db:'+Date.now()+':'+req.file.originalname, req.file.mimetype,req.file.size,req.session.admin.id,req.file.buffer]);
  await audit(req.session.admin.id, 'upload', 'course_asset', result.rows[0].id, { filename: req.file.originalname });
  res.status(201).json({ asset: result.rows[0] });
});
app.get('/api/courses/:id/assets', requireAdmin, async (req,res) => {
  const result = await pool.query('SELECT id,course_id,module_id,original_filename,mime_type,file_size_bytes,created_at FROM course_assets WHERE course_id=$1 ORDER BY created_at DESC',[req.params.id]);
  res.json({ assets: result.rows });
});
app.get('/api/assets/:id/download', requireAdmin, async (req,res) => {
  const result = await pool.query('SELECT original_filename,mime_type,file_data FROM course_assets WHERE id=$1',[req.params.id]);
  if (!result.rowCount || !result.rows[0].file_data) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  const file = result.rows[0];
  res.setHeader('Content-Type',file.mime_type); res.setHeader('Content-Disposition','attachment; filename*=UTF-8\'\''+encodeURIComponent(file.original_filename));
  res.send(file.file_data);
});
app.get('/api/admin/audit', requireAdmin, async (req,res) => {
  if (req.session.admin.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem consultar a auditoria.' });
  const result = await pool.query('SELECT id,admin_user_id,action,entity_type,entity_id,details,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 200');
  res.json({ events: result.rows });
});
app.use((err,req,res,next) => { console.error('API error:',err.message); if (res.headersSent) return next(err); res.status(err instanceof multer.MulterError ? 400 : 500).json({ error: err instanceof multer.MulterError ? 'Arquivo excede o limite de 15 MB.' : 'Erro interno do servidor.' }); });
initialize().then(() => app.listen(PORT, () => console.log('Universidade MB API listening on '+PORT))).catch(err => { console.error('Startup failed:',err); process.exit(1); });
