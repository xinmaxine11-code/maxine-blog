/**
 * Chiikawa Blog - Main JavaScript
 * Handles: i18n, content loading, tag filtering, back-to-top
 */

// --- Configuration ---
const CONTENT_DIR = 'content';
const DEFAULT_LANG = 'zh';

// --- State ---
let currentLang = localStorage.getItem('blog-lang') || DEFAULT_LANG;
let i18n = {};
let novels = [];
let lifePosts = [];

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  loadLanguage(currentLang);
  loadBackToTop();
  loadContent();
});

// --- Language ---
async function loadLanguage(lang) {
  try {
    const res = await fetch(`i18n/${lang}.json`);
    i18n = await res.json();
    applyTranslations();
    document.documentElement.lang = lang;
    currentLang = lang;
    localStorage.setItem('blog-lang', lang);
  } catch (e) {
    console.warn(`Failed to load language: ${lang}`, e);
  }
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = getNestedValue(i18n, key);
    if (text) el.textContent = text;
  });
}

function getNestedValue(obj, key) {
  return key.split('.').reduce((o, k) => o && o[k], obj);
}

function toggleLang() {
  const newLang = currentLang === 'zh' ? 'en' : 'zh';
  loadLanguage(newLang).then(() => {
    // Reload content in new language
    loadContent();
  });
}

// --- Content Loading ---
async function loadContent() {
  novels = await loadMarkdownFiles('novels');
  lifePosts = await loadMarkdownFiles('life');

  // Check which page we're on
  const path = window.location.pathname;

  if (path.includes('novels.html')) {
    renderNovelList(novels);
    renderTagFilter(novels);
  } else if (path.includes('life.html')) {
    renderLifeList(lifePosts);
  } else if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
    renderLatestNovels();
    renderLatestLife();
  }
}

async function loadMarkdownFiles(type) {
  const files = await fetchDirectory(type);
  const posts = [];

  for (const file of files) {
    try {
      const res = await fetch(`${CONTENT_DIR}/${type}/${file}`);
      const text = await res.text();
      const parsed = parseMarkdown(text);
      if (parsed) {
        parsed.filename = file;
        posts.push(parsed);
      }
    } catch (e) {
      console.warn(`Failed to load: ${file}`, e);
    }
  }

  // Sort by date, newest first
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

async function fetchDirectory(type) {
  try {
    // Try to fetch directory listing (won't work on all servers)
    const res = await fetch(`${CONTENT_DIR}/${type}/`);
    if (res.ok) {
      const html = await res.text();
      const links = html.match(/href="([^"]+)"/g) || [];
      return links
        .map(l => l.replace('href="', '').replace('"', ''))
        .filter(f => f.endsWith('.md'));
    }
  } catch (e) {
    // Fall back to predefined list
  }

  // Fallback: return empty array (content will show as empty state)
  return [];
}

// --- Markdown Parser ---
function parseMarkdown(text) {
  // Simple frontmatter parser
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      frontmatter[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  });

  const content = match[2];

  return {
    title: frontmatter.title || frontmatter['标题'] || frontmatter['title_zh'] || 'Untitled',
    titleEn: frontmatter['title_en'] || '',
    date: frontmatter.date || frontmatter['日期'] || '',
    tags: (frontmatter.tags || frontmatter['标签'] || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    excerpt: frontmatter.excerpt || frontmatter['摘要'] || '',
    excerptEn: frontmatter['excerpt_en'] || '',
    content: content,
    html: typeof marked !== 'undefined' ? marked.parse(content) : content
  };
}

// --- Render Functions ---
function renderNovelList(posts, filterTag) {
  const container = document.getElementById('novel-list');
  const emptyState = document.getElementById('novel-empty');
  if (!container) return;

  let filtered = posts;
  if (filterTag) {
    filtered = posts.filter(p => p.tags.includes(filterTag));
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = filtered.map(post => createCard(post)).join('');
}

function renderLifeList(posts) {
  const container = document.getElementById('life-list');
  const emptyState = document.getElementById('life-empty');
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = posts.map(post => createCard(post)).join('');
}

function renderLatestNovels() {
  const container = document.getElementById('latest-novels');
  if (!container || novels.length === 0) return;
  container.innerHTML = novels.slice(0, 3).map(post => createCard(post)).join('');
}

function renderLatestLife() {
  const container = document.getElementById('latest-life');
  if (!container || lifePosts.length === 0) return;
  container.innerHTML = lifePosts.slice(0, 3).map(post => createCard(post)).join('');
}

function createCard(post) {
  const title = currentLang === 'en' && post.titleEn ? post.titleEn : post.title;
  const excerpt = currentLang === 'en' && post.excerptEn ? post.excerptEn : post.excerpt;
  const link = `article.html?type=${post.filename.includes('novel') ? 'novels' : 'life'}&file=${post.filename}`;

  return `
    <div class="card" data-tags="${post.tags.join(',')}">
      <h3>${title}</h3>
      <div class="date">${post.date}</div>
      ${post.tags.length ? `
        <div class="tags">
          ${post.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      ` : ''}
      ${excerpt ? `<p class="excerpt">${excerpt}</p>` : ''}
      <a href="${link}" class="read-more">
        ${i18n.novels?.readMore || '阅读更多'} →
      </a>
    </div>
  `;
}

function renderTagFilter(posts) {
  const container = document.getElementById('tag-filter');
  if (!container) return;

  const allTags = [...new Set(posts.flatMap(p => p.tags))];
  if (allTags.length === 0) return;

  container.innerHTML = `
    <button class="active" onclick="filterByTag(null, this)">全部</button>
    ${allTags.map(tag => `<button onclick="filterByTag('${tag}', this)">${tag}</button>`).join('')}
  `;
}

function filterByTag(tag, btn) {
  // Update active button
  document.querySelectorAll('.tag-filter button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  renderNovelList(novels, tag);
}

// --- Back to Top ---
function loadBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });
}
