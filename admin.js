(() => {
  const $ = id => document.getElementById(id);
  const copy = value => JSON.parse(JSON.stringify(value));
  const original = {
    courses: copy(courses),
    quiz: copy(quiz),
    glossary: copy(glossary),
    eyebrow: document.querySelector('.hero .eyebrow').textContent,
    title: document.querySelector('.hero h1').textContent,
    description: document.querySelector('.hero p').textContent,
    footer: document.querySelector('footer').textContent
  };
  const message = text => { $('adminMessage').textContent = text; };
  const payload = () => JSON.stringify({
    courses, quiz, glossary,
    eyebrow: document.querySelector('.hero .eyebrow').textContent,
    title: document.querySelector('.hero h1').textContent,
    description: document.querySelector('.hero p').textContent,
    footer: document.querySelector('footer').textContent
  }, null, 2);
  function validate(data) {
    if (!data || !Array.isArray(data.courses) || !Array.isArray(data.quiz) || !Array.isArray(data.glossary)) throw new Error('O JSON deve conter courses, quiz e glossary.');
    if (data.courses.length !== 24) throw new Error('O catálogo deve conter exatamente 24 cursos. Cursos encontrados: ' + data.courses.length + '.');
    const ids = data.courses.map(course => course.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('Cada curso precisa ter um identificador único.');
    if (!data.courses.every(course => course.title && course.desc && Array.isArray(course.units) && course.units.length && course.units.every(unit => Array.isArray(unit) && unit.length === 2))) throw new Error('Confira título, descrição e unidades de cada curso.');
    if (!data.quiz.every(item => item.q && Array.isArray(item.a) && item.a.length >= 2 && Number.isInteger(item.correct) && item.correct >= 0 && item.correct < item.a.length && item.why)) throw new Error('Há questões de avaliação inválidas.');
    if (!data.glossary.every(item => Array.isArray(item) && item.length === 2)) throw new Error('Há itens inválidos no glossário.');
  }
  function apply(data) {
    validate(data);
    courses.splice(0, courses.length, ...copy(data.courses));
    quiz.splice(0, quiz.length, ...copy(data.quiz));
    glossary.splice(0, glossary.length, ...copy(data.glossary));
    if (data.eyebrow) document.querySelector('.hero .eyebrow').textContent = data.eyebrow;
    if (data.title) document.querySelector('.hero h1').textContent = data.title;
    if (data.description) document.querySelector('.hero p').textContent = data.description;
    if (data.footer) document.querySelector('footer').textContent = data.footer;
    renderCourses($('courseSearch')?.value || '');
    renderGlossary($('glossarySearch')?.value || '');
    renderStats();
    renderQuiz();
  }
  $('adminTop').addEventListener('click', () => {
    $('adminContent').value = payload();
    showView('admin');
    message('Portal administrativo aberto. Edite o JSON e valide antes de salvar.');
  });
  $('adminBack').addEventListener('click', () => showView('courses'));
  $('adminApply').addEventListener('click', () => {
    try {
      const data = JSON.parse($('adminContent').value);
      apply(data);
      localStorage.setItem('universidadeMB.content.v1', JSON.stringify(data));
      $('adminContent').value = payload();
      message('Conteúdo validado e salvo neste navegador. Isso não publica alterações para outros alunos.');
    } catch (error) {
      message('Não foi possível salvar: ' + error.message);
    }
  });
  $('adminExport').addEventListener('click', () => {
    try {
      const data = JSON.parse($('adminContent').value);
      validate(data);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'universidade-mb-conteudo.json'; link.click();
      URL.revokeObjectURL(url);
      message('Arquivo JSON exportado.');
    } catch (error) { message('Não foi possível exportar: ' + error.message); }
  });
  $('adminImportFile').addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      validate(data);
      $('adminContent').value = JSON.stringify(data, null, 2);
      message('Arquivo carregado no editor. Clique em validar e salvar para aplicar neste navegador.');
    } catch (error) { message('Arquivo inválido: ' + error.message); }
    event.target.value = '';
  });
  $('adminReset').addEventListener('click', () => {
    if (!confirm('Restaurar o conteúdo que está publicado no código? As alterações locais serão perdidas.')) return;
    localStorage.removeItem('universidadeMB.content.v1');
    apply(original);
    $('adminContent').value = payload();
    message('Conteúdo original restaurado neste navegador.');
  });
  try {
    const saved = localStorage.getItem('universidadeMB.content.v1');
    if (saved) {
      const data = JSON.parse(saved);
      apply(data);
    }
  } catch (error) { console.warn('Conteúdo administrativo local não carregado:', error); }
})();