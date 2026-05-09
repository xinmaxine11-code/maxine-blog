/**
 * Editor page JavaScript
 * Handles: form auto-fill, preview, publish/download, drafts
 */

const DRAFTS_KEY = 'maxine-blog-drafts';
const TOKEN_KEY = 'maxine-blog-gh-token';

const GITHUB_OWNER = 'xinmaxine11-code';
const GITHUB_REPO = 'maxine-blog';
const GITHUB_BRANCH = 'main';

// Set today's date as default
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('post-date').value = today;

  // Live word count
  const contentEl = document.getElementById('post-content');
  contentEl.addEventListener('input', () => {
    updateWordCount(contentEl.value);
  });

  // Load drafts list
  renderDraftsList();

  // Load saved token
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken && document.getElementById('gh-token-input')) {
    document.getElementById('gh-token-input').value = savedToken;
  }
});

// --- Word Count ---
function updateWordCount(text) {
  const chinese = (text.match(/[一-鿿]/g) || []).length;
  const english = (text.match(/[a-zA-Z0-9]+/g) || []).length;
  const punctuation = (text.match(/[^\w\s一-鿿]/g) || []).length;
  const total = chinese + english + punctuation;
  const el = document.getElementById('word-count');
  if (el) {
    el.textContent = `中文：${chinese} 字符 | 英文：${english} 词 | 总计：${total} 字符`;
  }
}

// --- Preview ---
function previewPost() {
  const title = document.getElementById('post-title').value || '未命名';
  const date = document.getElementById('post-date').value || '';
  const tags = document.getElementById('post-tags').value || '';
  const content = document.getElementById('post-content').value || '';

  const tagsHtml = tags
    ? tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="tag">${t}</span>`).join(' ')
    : '';

  const html = typeof marked !== 'undefined' ? marked.parse(content) : content;

  document.getElementById('preview-content').innerHTML = `
    <h1>${title}</h1>
    <div class="meta">
      <span>${date}</span>
      ${tagsHtml ? `<span>${tagsHtml}</span>` : ''}
    </div>
    <div class="body">${html}</div>
  `;
}

// --- Publish ---
async function publishPost() {
  const type = document.getElementById('post-type').value;
  const title = document.getElementById('post-title').value;
  const date = document.getElementById('post-date').value;
  const tags = document.getElementById('post-tags').value;
  const excerpt = document.getElementById('post-excerpt').value;
  const content = document.getElementById('post-content').value;

  if (!title || !content) {
    alert('请填写标题和正文');
    return;
  }

  const frontmatter = `---
title: ${title}
date: ${date}
tags: ${tags}
excerpt: ${excerpt}
---

`;

  const mdContent = frontmatter + content;
  const filename = title.replace(/[^一-龥a-zA-Z0-9]/g, '-').toLowerCase() + '.md';
  const filePath = `content/${type}/${filename}`;
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    alert('请先点击导航栏 ⚙ 按钮配置 GitHub Token');
    openSettings();
    return;
  }

  try {
    // Check if file exists (to get the sha for update)
    let sha = null;
    try {
      const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (checkRes.ok) {
        const data = await checkRes.json();
        sha = data.sha;
      }
    } catch (e) { /* file doesn't exist */ }

    const encodedContent = btoa(unescape(encodeURIComponent(mdContent)));

    const body = {
      message: `发布文章: ${title}`,
      content: encodedContent,
      branch: GITHUB_BRANCH
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      // Remove from drafts
      const drafts = getDrafts();
      const currentDraftId = getAutoDraftId();
      if (drafts[currentDraftId]) {
        delete drafts[currentDraftId];
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
        renderDraftsList();
      }

      alert('发布成功！Vercel 将自动部署，约 1-2 分钟后在网站上可见。');
    } else {
      const err = await res.json();
      alert('发布失败: ' + (err.message || res.statusText));
    }
  } catch (e) {
    alert('发布失败: ' + e.message);
  }
}

// --- Settings ---
function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.style.display = 'flex';
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.style.display = 'none';
}

function saveToken() {
  const input = document.getElementById('gh-token-input');
  if (input && input.value.trim()) {
    localStorage.setItem(TOKEN_KEY, input.value.trim());
    alert('Token 已保存');
    closeSettings();
  }
}

// --- Drafts ---
function getDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function getAutoDraftId() {
  const title = document.getElementById('post-title').value || '未命名';
  return 'draft_' + title.replace(/[^一-龥a-zA-Z0-9]/g, '_').substring(0, 20) + '_' + Date.now();
}

function saveDraft() {
  const draftId = getAutoDraftId();
  const draft = {
    title: document.getElementById('post-title').value,
    type: document.getElementById('post-type').value,
    date: document.getElementById('post-date').value,
    tags: document.getElementById('post-tags').value,
    excerpt: document.getElementById('post-excerpt').value,
    content: document.getElementById('post-content').value,
    updatedAt: new Date().toLocaleString('zh-CN')
  };

  const drafts = getDrafts();
  drafts[draftId] = draft;
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  renderDraftsList();

  alert('草稿已保存');
}

function loadDraft(draftId) {
  const drafts = getDrafts();
  const draft = drafts[draftId];
  if (!draft) return;

  document.getElementById('post-type').value = draft.type || 'novels';
  document.getElementById('post-title').value = draft.title || '';
  document.getElementById('post-date').value = draft.date || '';
  document.getElementById('post-tags').value = draft.tags || '';
  document.getElementById('post-excerpt').value = draft.excerpt || '';
  document.getElementById('post-content').value = draft.content || '';
  updateWordCount(draft.content || '');
}

function deleteDraft(draftId) {
  const drafts = getDrafts();
  delete drafts[draftId];
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  renderDraftsList();
}

function renderDraftsList() {
  const container = document.getElementById('drafts-list');
  if (!container) return;

  const drafts = getDrafts();
  const keys = Object.keys(drafts).reverse();

  if (keys.length === 0) {
    container.innerHTML = '<p class="preview-placeholder">暂无草稿</p>';
    return;
  }

  container.innerHTML = keys.map(id => {
    const d = drafts[id];
    const typeLabel = d.type === 'life' ? '日常' : '小说';
    return `
      <div class="draft-item" onclick="loadDraft('${id}')">
        <h4>${d.title || '未命名'}</h4>
        <div class="draft-meta">${typeLabel} · ${d.updatedAt}</div>
        <button class="draft-delete" onclick="event.stopPropagation(); deleteDraft('${id}')" title="删除">×</button>
      </div>
    `;
  }).join('');
}
