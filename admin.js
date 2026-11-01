(() => {
  const API = 'https://universidade-mb-api.onrender.com';
  const $ = id => document.getElementById(id);
  let currentCourse = null;
  let currentModules = [];
  let admin = null;
  const sayAuth = text => { $('adminAuthMessage').textContent = text; };
  const sayEditor = text => { $('adminEditorMessage').textContent = text; };
  async function request(path, options = {}) {
    const response = await fetch(API + path, { credentials: 'include', ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha na comunicação com o servidor.');
    return data;
  }
  const json = value => JSON.stringify(value);
  const slugify = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function authMode(first) {
    $('bootstrapTokenField').hidden = !first;
    $('adminFirstSetup').textContent = first ? 'Cancelar configuração inicial' : 'Primeiro acesso';
    $('adminLogin').textContent = first ? 'Criar administrador' : 'Entrar';
    $('adminPassword').autocomplete = first ? 'new-password' : 'current-password';
    $('adminAuthMessage').textContent = first ? 'Crie a conta inicial com o token fornecido no servidor. A senha deve ter pelo menos 6 caracteres.' : '';
  }
  async function setup() {
    try {
      const data = await request('/api/admin/bootstrap', { method: 'POST', headers: { 'x-bootstrap-token': $('adminBootstrapToken').value }, body: json({ email: $('adminEmail').value, password: $('adminPassword').value }) });
      sayAuth('Administrador criado. Agora entre com seu e-mail e senha.');
      $('adminBootstrapToken').value = '';
      authMode(false);
    } catch (e) { sayAuth(e.message); }
  }
  async function login() {
    try {
      await request('/api/admin/login', { method: 'POST', body: json({ email: $('adminEmail').value, password: $('adminPassword').value }) });
      const data = await request('/api/admin/me');
      admin = data.admin;
      $('adminAuthPanel').hidden = true;
      $('adminWorkspace').hidden = false;
      $('adminSignedIn').textContent = 'Conectado como ' + admin.email + ' · ' + admin.role;
      await loadCourses();
      sayAuth('');
    } catch (e) { sayAuth(e.message); }
  }
  async function logout() {
    try { await request('/api/admin/logout', { method: 'POST', body: '{}' }); } catch {}
    admin = null; currentCourse = null;
    $('adminAuthPanel').hidden = false; $('adminWorkspace').hidden = true;
    $('adminPassword').value = ''; $('adminBootstrapToken').value = '';
    authMode(false);
  }
  function coursePayload() {
    const title = $('adminCourseTitle').value.trim();
    return { id: $('adminCourseId').value || slugify(title), slug: $('adminCourseSlug').value.trim() || slugify(title), title, description: $('adminCourseDescription').value.trim(), level: $('adminCourseLevel').value, duration: $('adminCourseDuration').value.trim(), icon: '📘', sort_order: Number($('adminCourseOrder').value || 0), status: $('adminCourseStatus').value };
  }
  function fillCourse(course) {
    currentCourse = course;
    currentModules = course.modules || [];
    $('adminCourseId').value = course.id || '';
    $('adminCourseTitle').value = course.title || '';
    $('adminCourseSlug').value = course.slug || slugify(course.title || '');
    $('adminCourseDescription').value = course.description || '';
    $('adminCourseLevel').value = course.level || 'Fundamentos';
    $('adminCourseDuration').value = course.duration || '';
    $('adminCourseStatus').value = course.status || 'draft';
    $('adminCourseOrder').value = course.sort_order || 0;
    $('adminEditorHeading').textContent = course.id ? 'Editar curso' : 'Criar curso';
    $('adminModuleTitle').value = currentModules[0]?.title || '';
    $('adminRichEditor').innerHTML = currentModules[0]?.content_html || '';
    renderAssets(course.id);
  }
  function newCourse() {
    fillCourse({ id:'', slug:'', title:'', description:'', level:'Fundamentos', duration:'', status:'draft', sort_order:0, modules:[] });
    $('adminAssets').innerHTML = '';
    sayEditor('Preencha os dados do novo curso. Ele será salvo no banco central.');
  }
  async function loadCourses() {
    let data = await request('/api/courses?all=true');
    let courses = data.courses || [];
    if (!courses.length) {
      try {
        const staticCatalog = (typeof window !== 'undefined' && Array.isArray(window.universidadeMBCatalog)) ? window.universidadeMBCatalog : null;
        if (staticCatalog?.length) {
          for (let index=0; index<staticCatalog.length; index++) {
            const item=staticCatalog[index];
            const payload={id:item.id,slug:slugify(item.title),title:item.title,description:item.desc||'',level:item.level||'Fundamentos',duration:item.time||'',icon:item.icon||'📘',sort_order:index,status:'published'};
            await request('/api/courses',{method:'POST',body:json(payload)});
            for (let unitIndex=0; unitIndex<(item.units||[]).length; unitIndex++) {
              const unit=item.units[unitIndex];
              await request('/api/courses/'+encodeURIComponent(item.id)+'/modules',{method:'POST',body:json({title:unit[0],content_html:unit[1],sort_order:unitIndex})});
            }
          }
          data = await request('/api/courses?all=true');
          courses = data.courses || [];
          sayEditor('Catálogo inicial migrado para o banco central.');
        }
      } catch (e) { sayEditor('O catálogo ainda não foi migrado: '+e.message); }
    }
    const list = $('adminCourseList');
    list.replaceChildren();
    if (!courses.length) {
      list.innerHTML = '<p class="tagline">Nenhum curso foi cadastrado no banco central. Use “Novo curso” ou importe um backup.</p>';
      newCourse();
      return;
    }
    courses.forEach(course => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'secondary'; button.style.textAlign = 'left'; button.style.width = '100%';
      button.textContent = course.title + ' · ' + (course.status === 'published' ? 'Publicado' : course.status === 'archived' ? 'Arquivado' : 'Rascunho');
      button.addEventListener('click', () => fillCourse(course));
      list.appendChild(button);
    });
    if (currentCourse?.id) {
      const selected = courses.find(course => course.id === currentCourse.id);
      if (selected) fillCourse(selected);
    } else fillCourse(courses[0]);
  }
  async function saveCourse(event) {
    event.preventDefault();
    try {
      const payload = coursePayload();
      if (!payload.title) throw new Error('Informe o título do curso.');
      if (currentCourse?.id) {
        const data = await request('/api/courses/' + encodeURIComponent(currentCourse.id), { method:'PUT', body:json(payload) });
        currentCourse = { ...data.course, modules: currentModules };
      } else {
        const data = await request('/api/courses', { method:'POST', body:json(payload) });
        currentCourse = { ...data.course, modules: [] };
        $('adminCourseId').value = currentCourse.id;
      }
      await loadCourses();
      sayEditor('Curso salvo no banco central da Universidade MB.');
    } catch (e) { sayEditor(e.message); }
  }
  async function saveModule() {
    try {
      if (!currentCourse?.id) throw new Error('Salve o curso antes de adicionar uma aula.');
      const title = $('adminModuleTitle').value.trim();
      if (!title) throw new Error('Informe o título da aula/módulo.');
      const html = $('adminRichEditor').innerHTML;
      if (currentModules.length) {
        const existing = currentModules[0];
        const data = await request('/api/modules/' + existing.id, { method:'PUT', body:json({ title, content_html:html, sort_order:existing.sort_order || 0 }) });
        currentModules[0] = data.module;
      } else {
        const data = await request('/api/courses/' + encodeURIComponent(currentCourse.id) + '/modules', { method:'POST', body:json({ title, content_html:html, sort_order:0 }) });
        currentModules.push(data.module);
      }
      currentCourse.modules = currentModules;
      sayEditor('Aula/módulo salvo no banco central.');
    } catch (e) { sayEditor(e.message); }
  }
  async function uploadAsset() {
    const file = $('adminCourseFiles').files?.[0];
    if (!file) return;
    try {
      if (!currentCourse?.id) throw new Error('Salve o curso antes de anexar materiais.');
      const form = new FormData(); form.append('file', file);
      if (currentModules[0]?.id) form.append('module_id', currentModules[0].id);
      await request('/api/courses/' + encodeURIComponent(currentCourse.id) + '/assets', { method:'POST', body:form });
      $('adminCourseFiles').value = '';
      await renderAssets(currentCourse.id);
      sayEditor('Material anexado e armazenado no banco.');
    } catch (e) { sayEditor(e.message); }
  }
  async function renderAssets(courseId) {
    const host = $('adminAssets'); host.replaceChildren();
    if (!courseId || !admin) return;
    try {
      const data = await request('/api/courses/' + encodeURIComponent(courseId) + '/assets');
      if (!data.assets.length) return;
      const title = document.createElement('h4'); title.textContent = 'Materiais anexados'; host.appendChild(title);
      data.assets.forEach(asset => {
        const row = document.createElement('div'); row.style.display='flex'; row.style.gap='10px'; row.style.alignItems='center'; row.style.margin='8px 0';
        const label = document.createElement('span'); label.textContent = asset.original_filename + ' (' + Math.ceil(asset.file_size_bytes/1024) + ' KB)'; label.style.flex='1';
        const link = document.createElement('a'); link.href = API + '/api/assets/' + asset.id + '/download'; link.textContent='Baixar'; link.target='_blank'; link.rel='noopener'; link.style.color='var(--accent)';
        row.append(label,link); host.appendChild(row);
      });
    } catch (e) { sayEditor(e.message); }
  }
  function toolbar() {
    document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
      $('adminRichEditor').focus(); document.execCommand(button.dataset.format, false, null);
    }));
    $('adminFontFamily').addEventListener('change', e => { $('adminRichEditor').focus(); document.execCommand('fontName', false, e.target.value); });
    $('adminFontSize').addEventListener('change', e => { $('adminRichEditor').focus(); document.execCommand('fontSize', false, e.target.value); });
    $('adminCourseTitle').addEventListener('input', () => { if (!$('adminCourseId').value) $('adminCourseSlug').value = slugify($('adminCourseTitle').value); });
  }
  function preview() {
    const content = $('adminRichEditor').innerHTML;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return sayEditor('Permita a abertura da janela de pré-visualização no navegador.');
    win.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pré-visualização do curso</title><body style="font:16px/1.7 Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#29231d"><h1>' + $('adminCourseTitle').value.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) + '</h1>' + content + '</body></html>');
    win.document.close();
  }
  async function exportBackup() {
    try {
      const data = await request('/api/courses?all=true');
      const blob = new Blob([JSON.stringify({ version:1, exported_at:new Date().toISOString(), courses:data.courses },null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='universidade-mb-backup.json'; a.click(); URL.revokeObjectURL(url);
      sayEditor('Backup JSON exportado.');
    } catch(e) { sayEditor(e.message); }
  }
  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.courses)) throw new Error('O backup precisa conter uma lista courses.');
      for (const course of data.courses) {
        if (!course.id || !course.title) continue;
        let saved;
        try {
          const existing = await request('/api/courses?all=true');
          const found = existing.courses.find(c=>c.id===course.id);
          if (found) saved = (await request('/api/courses/'+encodeURIComponent(course.id),{method:'PUT',body:json(course)})).course;
          else saved = (await request('/api/courses',{method:'POST',body:json(course)})).course;
        } catch(e) { if (!/já existe/i.test(e.message)) throw e; }
        if (saved && Array.isArray(course.modules)) for (const module of course.modules) {
          await request('/api/courses/'+encodeURIComponent(saved.id)+'/modules',{method:'POST',body:json({title:module.title,content_html:module.content_html||'',sort_order:module.sort_order||0,duration_minutes:module.duration_minutes||null})});
        }
      }
      await loadCourses(); sayEditor('Backup importado. Revise os cursos e publique os que estiverem prontos.');
    } catch(e) { sayEditor('Falha ao importar backup: '+e.message); }
    finally { $('adminBackupImport').value=''; }
  }
  $('adminTop').addEventListener('click', async () => {
    showView('admin');
    try {
      const data = await request('/api/admin/me');
      if (data.authenticated) {
        admin=data.admin; $('adminAuthPanel').hidden=true; $('adminWorkspace').hidden=false;
        $('adminSignedIn').textContent='Conectado como '+admin.email+' · '+admin.role;
        await loadCourses();
      } else { $('adminAuthPanel').hidden=false; $('adminWorkspace').hidden=true; }
    } catch { $('adminAuthPanel').hidden=false; $('adminWorkspace').hidden=true; sayAuth('Não foi possível conectar ao servidor administrativo. Verifique a publicação e as variáveis de ambiente do backend.'); }
  });
  $('adminLogin').addEventListener('click', () => $('bootstrapTokenField').hidden ? login() : setup());
  $('adminFirstSetup').addEventListener('click', () => authMode($('bootstrapTokenField').hidden));
  $('adminLogout').addEventListener('click', logout);
  $('adminNewCourse').addEventListener('click', newCourse);
  $('adminCourseForm').addEventListener('submit', saveCourse);
  $('adminSaveModule').addEventListener('click', saveModule);
  $('adminCourseFiles').addEventListener('change', uploadAsset);
  $('adminPreview').addEventListener('click', preview);
  $('adminBackupExport').addEventListener('click', exportBackup);
  $('adminBackupImport').addEventListener('change', e => { if (e.target.files?.[0]) importBackup(e.target.files[0]); });
  $('adminBack').addEventListener('click', () => showView('courses'));
  toolbar();
  authMode(false);
})();