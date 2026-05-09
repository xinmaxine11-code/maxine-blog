/**
 * Editor page JavaScript
 * Handles: form auto-fill, preview, publish/download
 */

// Set today's date as default
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('post-date').value = today;
});

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

function publishPost() {
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

  // Build Markdown with frontmatter
  const frontmatter = `---
title: ${title}
date: ${date}
tags: ${tags}
excerpt: ${excerpt}
---

`;

  const mdContent = frontmatter + content;

  // Generate filename
  const filename = title.replace(/[^一-龥a-zA-Z0-9]/g, '-').toLowerCase() + '.md';

  // Download as file
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert('文章已下载为: ' + filename);
}
