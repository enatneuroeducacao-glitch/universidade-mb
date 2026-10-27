(() => {
  const original = {
    eyebrow: document.querySelector('.hero .eyebrow').textContent,
    title: document.querySelector('.hero h1').textContent,
    description: document.querySelector('.hero p').textContent,
    footer: document.querySelector('footer').textContent,
    courses: JSON.parse(JSON.stringify(courses)),
    glossary: JSON.parse(JSON.stringify(glossary))
  };
  let data = JSON.parse(JSON.stringify(original));
  const json = () => JSON.stringify(data, null, 2);
  const apply = next => {
    if (!next || !Array.isArray(next.courses) || !Array.isArray(next.glossary)) throw new Error('O JSON deve conter courses e glossary como listas.');
    if (!next.courses.every(c => c.id && c.title && c.desc && Array.isArray(c.units) && c.units.every(u => Array.isArray(u) && u.length === 2))) throw new Error('Cada curso precisa de id, title, desc e unidades com título e conteúdo.');
    if (!next.glossary.every(g => Array.isArray(g) && g.length === 2)) throw new Error('Cada item do glossário deve ter termo e definição.');
    courses.splice(0, courses.length, ...next.courses);
    glossary.splice(0, glossary.length, ...next.glossary);
    data = { eyebrow: String(next.eyebrow || original.eyebrow), title: String(next.title || original.title), description: String(next.description || original.description), footer: String(next.footer || original.footer), courses: JSON.parse(JSON.stringify(courses)), glossary: JSON.parse(JSON.stringify(glossary)) };
    document.querySelector('.hero .eyebrow').textContent = data.eyebrow;
    document.querySelector('.hero h1').textContent = data.title;
    document.querySelector('.hero p').textContent = data.description;
    document.querySelector('footer').textContent = data.footer;
    document.getElementById('statCourses').textContent = courses.length;
    document.getElementById('statLessons').textContent = courses.reduce((n, c) => n + c.units.length, 0);
  };
  const status = msg => document.getElementById('adminMessage').textContent = msg;
  document.getElementById('adminTop').addEventListener('click', () => {
    showView('admin');
    document.getElementById('adminContent').value = json();
    status('Edite o JSON e valide antes de salvar.');
  });
  document.getElementById('adminApply').addEventListener('click', () => {
    try {
      apply(JSON.parse(document.getElementById('adminContent').value));
      localStorage.setItem('universidadeMB.content.v1', json());
      renderCourses(document.getElementById('courseSearch').value);
      renderGlossary(document.getElementById('glossarySearch').value);
      renderStats();
      status('Conteúdo validado e salvo neste navegador. Para publicar para todos, atualize o arquivo no repositório.');
    } catch (err) { status('Erro de validação: ' + err.message); }
  });
  document.getElementById('adminExport').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([json()], {type:'application/json;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'universidade-mb-conteudo.json'; a.click(); URL.revokeObjectURL(url);
  });
  document.getElementById('adminImportFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try { document.getElementById('adminContent').value = await file.text(); status('Arquivo carregado. Clique em Validar e salvar para aplicar.'); }
    catch (err) { status('Falha ao ler arquivo: ' + err.message); }
    e.target.value = '';
  });
  document.getElementById('adminReset').addEventListener('click', () => {
    if (!confirm('Restaurar conteúdo original? Isso apaga as alterações locais.')) return;
    localStorage.removeItem('universidadeMB.content.v1'); apply(original);
    document.getElementById('adminContent').value = json(); renderCourses(); renderGlossary(); renderStats();
    status('Conteúdo original restaurado neste navegador.');
  });
  try {
    const saved = localStorage.getItem('universidadeMB.content.v1');
    if (saved) { apply(JSON.parse(saved)); renderCourses(); renderGlossary(); renderStats(); }
  } catch (err) { console.warn('Conteúdo local não carregado:', err); }
})();