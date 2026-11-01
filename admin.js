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
  function authMode() { $('adminLogin').textContent='Entrar'; $('adminPassword').autocomplete='current-password'; $('adminAuthMessage').textContent=''; }
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
    $('adminPassword').value = '';
    authMode();
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
  async function loadLearnerProgress() {
    const status=$('learnerProgressStatus'), list=$('learnerProgressList');
    if(!status||!list)return;
    status.textContent='Consultando progresso e certificados...';
    try {
      const [data,certificateData,catalogData]=await Promise.all([
        request('/api/admin/learner-progress'),
        request('/api/admin/certificates'),
        request('/api/courses')
      ]);
      const learners=data.learners||[], certificates=certificateData.certificates||[], publishedCount=Math.max(1,(catalogData.courses||[]).length);
      status.textContent=learners.length+' participante(s) · '+certificates.length+' certificado(s) emitido(s).';
      list.replaceChildren();
      if(!learners.length){list.innerHTML='<p class="tagline">Ainda não há registros sincronizados. O progresso aparecerá após o aluno entrar na conta e estudar.</p>';return;}
      learners.forEach(learner=>{
        const progress=learner.progress||{};
        const completed=Array.isArray(progress.completed)?progress.completed:[];
        const passed=progress.modulePassed&&typeof progress.modulePassed==='object'?progress.modulePassed:{};
        const passedCount=completed.filter(id=>passed[id]===true).length;
        const percent=Math.min(100,Math.round(passedCount/publishedCount*100));
        const certificate=certificates.find(c=>String(c.learner_id)===String(learner.learner_id)&&c.course_id==='__program__');
        const row=document.createElement('article');
        row.style.cssText='border:1px solid var(--line);border-radius:14px;padding:16px;display:grid;gap:10px;background:var(--paper)';
        const top=document.createElement('div');
        top.style.cssText='display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap';
        const identity=document.createElement('div');
        identity.style.cssText='display:grid;gap:4px;min-width:180px';
        const title=document.createElement('strong');title.textContent=learner.display_name||learner.email||('Participante '+String(learner.learner_id).slice(0,8));
        const email=document.createElement('small');email.className='tagline';email.textContent=learner.email||'';
        identity.append(title,email);
        const percentLabel=document.createElement('strong');percentLabel.textContent=percent+'%';
        top.append(identity,percentLabel);
        const bar=document.createElement('div');bar.style.cssText='height:9px;background:var(--line);border-radius:20px;overflow:hidden';
        const fill=document.createElement('div');fill.style.cssText='height:100%;width:'+percent+'%;background:'+(percent===100?'#3f8067':'var(--gold)')+';border-radius:20px;transition:width .2s';bar.append(fill);
        const detail=document.createElement('small');detail.className='tagline';detail.textContent=passedCount+' de '+publishedCount+' cursos concluídos e aprovados · última atualização '+new Date(learner.updated_at).toLocaleString('pt-BR');
        const certificateStatus=document.createElement('div');certificateStatus.className='tagline';
        if(certificate){certificateStatus.textContent='Certificado emitido · '+certificate.certificate_code+' · '+new Date(certificate.issued_at).toLocaleDateString('pt-BR');}
        else if(percent===100){certificateStatus.textContent='Elegível para emissão do certificado geral.';}
        else{certificateStatus.textContent='Certificado disponível quando atingir 100% de conclusão e aprovação.';}
        const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
        if(percent===100&&!certificate){
          const issue=document.createElement('button');issue.type='button';issue.className='primary';issue.textContent='Emitir certificado';
          issue.onclick=async()=>{issue.disabled=true;issue.textContent='Validando...';try{const result=await request('/api/admin/certificates/program/'+encodeURIComponent(learner.learner_id),{method:'POST',body:'{}'});renderCertificate(result.certificate);await loadLearnerProgress();}catch(e){certificateStatus.textContent=e.message;issue.disabled=false;issue.textContent='Emitir certificado';}};
          actions.append(issue);
        }
        if(certificate){
          const print=document.createElement('button');print.type='button';print.className='secondary';print.textContent='Abrir / imprimir certificado';print.onclick=()=>renderCertificate(certificate);actions.append(print);
        }
        row.append(top,bar,detail,certificateStatus,actions);list.append(row);
      });
    } catch(e) {status.textContent='Não foi possível carregar os registros: '+e.message;}
  }
  async function renderCertificate(certificate){
    const win=window.open('','_blank');
    if(!win){sayAuth('O navegador bloqueou o certificado. Permita pop-ups e tente novamente.');return;}
    const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const date=new Date(certificate.issued_at).toLocaleDateString('pt-BR');
    let courses=[];
    try { const response=await fetch(API+'/api/courses',{cache:'no-store'}); if(response.ok){const payload=await response.json();courses=Array.isArray(payload.courses)?payload.courses:[];} } catch {}
    const rows=courses.map((course,index)=>'<tr><td class="num">'+String(index+1).padStart(2,'0')+'</td><td>'+esc(course.title||('Módulo '+(index+1)))+'</td><td class="hours">'+esc(course.duration||'Não informada')+'</td></tr>').join('');
    const totalCourses=courses.length;
    const totalDuration=courses.reduce((sum,course)=>{const raw=String(course.duration||'').toLowerCase();const h=raw.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras?)?/);const m=raw.match(/(\d+)\s*m(?:in(?:utos?)?)?/);return sum+(h?Number(h[1].replace(',','.')):0)+(m?Number(m[1])/60:0);},0);
    const totalLabel=totalDuration>0?Number(totalDuration.toFixed(2)).toLocaleString('pt-BR')+' horas':'Conforme carga horária cadastrada';
    win.document.open();
    win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificado Universidade MB</title><style>*{box-sizing:border-box}body{margin:0;background:#eee8df;color:#29231d;font-family:Georgia,serif}.actions{margin:14px auto;text-align:center;font:14px Arial}.actions button{padding:10px 16px;border:0;border-radius:8px;background:#29231d;color:#fff;cursor:pointer}.sheet{position:relative;width:297mm;height:210mm;margin:12px auto;padding:10mm;background:#fffdf8;border:2.5px solid #b78a45;overflow:hidden}.inner{position:relative;z-index:1;width:100%;height:100%;border:1px solid #dfc99e;padding:12mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 150px Arial;color:rgba(183,138,69,.07);letter-spacing:-14px;transform:rotate(-12deg);pointer-events:none}.brand{font:700 14px Arial;letter-spacing:3px;color:#9b7133;text-transform:uppercase}.subtitle{font:11px Arial;letter-spacing:2px;color:#5b5145;margin-top:6px}.title{font-size:34px;letter-spacing:2px;margin:20px 0;text-transform:uppercase;color:#9b7133}.name{font:700 27px Arial;border-bottom:1px solid #b78a45;padding:8px 25px 12px;margin:12px 0 18px}.copy{font:15px/1.7 Arial;max-width:230mm}.course{font-size:23px;font-weight:bold;margin:15px 0;color:#7c5825}.details{font:11px/1.8 Arial;color:#5b5145;margin-top:16px}.code{margin-top:14px;font:10px Arial;color:#81776a}.back{padding:9mm}.back .inner{padding:9mm;display:block;text-align:left}.back h2{text-align:center;color:#9b7133;font:700 22px Arial;letter-spacing:1.5px;margin:2mm 0 3mm}.back .program{text-align:center;font:700 14px Arial;margin-bottom:4mm}.back .meta{text-align:center;font:10px Arial;color:#62594c;margin-bottom:4mm}.modules{width:100%;border-collapse:collapse;font:10px/1.25 Arial;position:relative;z-index:1}.modules th{background:#f3ead8;color:#4b3b25;text-align:left}.modules th,.modules td{padding:5px 7px;border-bottom:1px solid #e6dcc9}.modules .num{width:12mm;color:#92703d}.modules .hours{text-align:right;white-space:nowrap;width:35mm}.total{margin-top:5mm;padding:3mm 4mm;background:#f8f1e4;border:1px solid #dfc99e;font:700 11px Arial;display:flex;justify-content:space-between}.verification{margin-top:4mm;font:9px Arial;color:#665d51;display:flex;justify-content:space-between;gap:10mm}@page{size:A4 landscape;margin:0}@media print{body{background:white}.actions{display:none}.sheet{margin:0;width:297mm;height:210mm;break-after:page;page-break-after:always}.sheet:last-of-type{break-after:auto;page-break-after:auto}}@media screen{.sheet{box-shadow:0 4px 24px #0002}}</style></head><body><div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF (frente e verso)</button><span> · Imprima em A4 horizontal, frente e verso</span></div><main class="sheet"><div class="watermark">MB</div><div class="inner"><div class="brand">MB Gestão Inteligente</div><div class="subtitle">UNIVERSIDADE MB · FORMAÇÃO PROFISSIONAL</div><h1 class="title">Certificado de conclusão</h1><div class="copy">Certificamos que</div><div class="name">'+esc(certificate.participant_name)+'</div><div class="copy">concluiu integralmente o programa de formação, cumprindo os requisitos de aprendizagem e aprovação estabelecidos pela Universidade MB.</div><div class="course">Formação Profissional Integral em Óptica</div><div class="details">Emitido em '+esc(date)+'<br>Documento de conclusão educacional. Não representa, por si só, habilitação profissional ou reconhecimento regulatório.</div><div class="code">Código de verificação: '+esc(certificate.certificate_code)+'</div></div></main><main class="sheet back"><div class="watermark">MB</div><div class="inner"><h2>HISTÓRICO DE MÓDULOS</h2><div class="program">Formação Profissional Integral em Óptica</div><div class="meta">Participante: <strong>'+esc(certificate.participant_name)+'</strong> · Certificado: '+esc(certificate.certificate_code)+'</div>'+(rows?'<table class="modules"><thead><tr><th>Nº</th><th>Módulo / Curso</th><th class="hours">Carga horária cadastrada</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p>Não foi possível carregar os módulos publicados. Atualize o catálogo e gere novamente o certificado.</p>')+'<div class="total"><span>Total de módulos: '+totalCourses+'</span><span>Carga horária total: '+esc(totalLabel)+'</span></div><div class="verification"><span>Universidade MB · MB Gestão Inteligente</span><span>Código: '+esc(certificate.certificate_code)+' · Emitido em '+esc(date)+'</span></div></div></main></body></html>');
    win.document.close();
  }
  async function loadCourses() {
    let data = await request('/api/courses?all=true');
    let courses = data.courses || [];
    try {
      const staticCatalog = (typeof window !== 'undefined' && Array.isArray(window.universidadeMBCatalog)) ? window.universidadeMBCatalog : [];
      const canonicalTitles = [
        'Leitura de receitas ópticas',
        'Visão simples, bifocal e multifocal',
        'Armações, rostos e materiais',
        'DNP, DP e centragem',
        'Equipamentos de uma ótica: uso, momento e cuidados',
        'Limpeza e manutenção dos óculos',
        'Anatomia e funcionamento do sistema visual',
        'Tratamentos e tecnologias das lentes',
        'Materiais, índices de refração e espessura',
        'Multifocais: corredores, campos visuais e adaptação',
        'Medidas ópticas e centragem',
        'Anatomia, medidas e materiais das armações',
        'Visagismo óptico e escolha de armações',
        'Laboratório óptico e controle de qualidade',
        'Atendimento consultivo em óptica',
        'Atendimento consultivo ao cliente',
        'Experiência do cliente e fidelização',
        'Venda técnica ética e apresentação de orçamentos',
        'Situações difíceis e resolução de conflitos',
        'Estoque, compras e fornecedores',
        'Gestão financeira e indicadores de uma ótica',
        'Sistemas digitais, cadastro e proteção de dados',
        'Liderança e treinamento de equipes de ótica',
        'Equipamentos de triagem visual em eventos'
      ];
      const known = new Set(courses.map(c => String(c.title || '').trim().toLocaleLowerCase('pt-BR')));
      let restored = 0;
      for (let index=0; index<canonicalTitles.length; index++) {
        const title = canonicalTitles[index];
        if (known.has(title.toLocaleLowerCase('pt-BR'))) continue;
        const item = staticCatalog.find(c => String(c.title || '').trim().toLocaleLowerCase('pt-BR') === title.toLocaleLowerCase('pt-BR'));
        const slug = slugify(title);
        const payload = {
          id: item?.id || slug,
          slug, title,
          description: item?.desc || 'Curso integrante da trilha formativa da Universidade MB.',
          level: item?.level || 'Fundamentos',
          duration: item?.time || '',
          icon: item?.icon || '📘',
          sort_order: index,
          status: 'published'
        };
        const created = await request('/api/courses', {method:'POST',body:json(payload)});
        const createdCourse = created.course || created;
        const courseId = createdCourse.id || payload.id || slug;
        const units = item?.units?.length ? item.units : [[
          'Conteúdo do curso',
          '<p>Curso restaurado ao catálogo central da Universidade MB.</p><p>Este curso precisa ter seus materiais e avaliações conferidos no editor administrativo antes de ser considerado pedagogicamente homologado.</p>'
        ]];
        for (let unitIndex=0; unitIndex<units.length; unitIndex++) {
          const unit = units[unitIndex];
          await request('/api/courses/'+encodeURIComponent(courseId)+'/modules', {method:'POST',body:json({title:unit[0],content_html:unit[1],sort_order:unitIndex})});
        }
        known.add(title.toLocaleLowerCase('pt-BR'));
        restored++;
      }
      if (restored) {
        data = await request('/api/courses?all=true');
        courses = data.courses || [];
        sayEditor('Catálogo reconciliado: '+restored+' curso(s) restaurado(s). Revise os conteúdos dos cursos que estavam ausentes.');
      }
    } catch (e) {
      sayEditor('A restauração automática do catálogo foi interrompida: '+e.message+'. Os cursos existentes foram preservados.');
      data = await request('/api/courses?all=true');
      courses = data.courses || [];
    }
    const total = courses.length;
    $('dashTotalCourses').textContent = total;
    $('dashPublishedCourses').textContent = courses.filter(c => c.status === 'published').length;
    $('dashDraftCourses').textContent = courses.filter(c => c.status === 'draft').length;
    $('dashArchivedCourses').textContent = courses.filter(c => c.status === 'archived').length;
    const list = $('adminCourseList');
    list.replaceChildren();
    if (!courses.length) {
      list.innerHTML = '<p class="tagline">Nenhum curso foi cadastrado no banco central. Use “Novo curso” ou importe um backup.</p>';
      newCourse();
      return;
    }
    courses.forEach(course => {
      const row = document.createElement('div');
      row.style.cssText = 'border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px;background:var(--paper)';
      const select = document.createElement('button');
      select.type = 'button'; select.className = 'secondary'; select.style.cssText = 'text-align:left;width:100%;white-space:normal';
      const statusLabel = course.status === 'published' ? 'Publicado' : course.status === 'archived' ? 'Arquivado' : 'Rascunho';
      select.textContent = course.title + ' · ' + statusLabel + ' · ' + (course.modules || []).length + ' módulos';
      select.addEventListener('click', () => fillCourse(course));
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
      const archive = document.createElement('button');
      archive.type = 'button'; archive.className = 'secondary'; archive.textContent = course.status === 'archived' ? 'Restaurar rascunho' : 'Arquivar';
      archive.addEventListener('click', async () => {
        const nextStatus = course.status === 'archived' ? 'draft' : 'archived';
        if (!confirm((nextStatus === 'archived' ? 'Arquivar' : 'Restaurar como rascunho') + ' o curso “' + course.title + '”?')) return;
        try {
          const payload = {slug:course.slug,title:course.title,description:course.description||'',level:course.level||'Fundamentos',duration:course.duration||'',icon:course.icon||'📘',sort_order:Number(course.sort_order||0),status:nextStatus};
          await request('/api/courses/'+encodeURIComponent(course.id), {method:'PUT',body:json(payload)});
          await loadCourses();
        await loadLearnerProgress(); sayEditor(nextStatus === 'archived' ? 'Curso arquivado. Ele não aparece no catálogo público.' : 'Curso restaurado como rascunho.');
        } catch (e) { sayEditor('Não foi possível alterar o curso: '+e.message); }
      });
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'secondary'; del.textContent = 'Excluir';
      del.style.cssText = 'border-color:#d8aaa3;color:#9f4438';
      del.addEventListener('click', async () => {
        if (!confirm('Excluir definitivamente o curso “' + course.title + '” e seus módulos? Esta ação não pode ser desfeita.')) return;
        try {
          await request('/api/courses/'+encodeURIComponent(course.id), {method:'DELETE'});
          if (currentCourse?.id === course.id) newCourse();
          await loadCourses(); sayEditor('Curso excluído.');
        } catch (e) { sayEditor('Não foi possível excluir o curso: '+e.message); }
      });
      actions.append(archive,del); row.append(select,actions); list.appendChild(row);
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
  $('adminLogin').addEventListener('click', login);
  $('createAdminForm')?.addEventListener('submit', async e => { e.preventDefault(); const status=$('createAdminMessage'); status.textContent='Criando administrador...'; try { const data=await request('/api/admin/users',{method:'POST',body:json({email:$('newAdminEmail').value,password:$('newAdminPassword').value})}); status.textContent='Administrador criado: '+data.admin.email; $('createAdminForm').reset(); } catch(err) { status.textContent=err.message; } });
  $('adminLogout').addEventListener('click', logout);
  $('adminNewCourse').addEventListener('click', newCourse);
  $('refreshLearnerProgress')?.addEventListener('click', loadLearnerProgress);
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