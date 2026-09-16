(function () {
  'use strict';

  // Anonymous GitHub's website sandbox blocks direct downloads. Its ordinary
  // repository file pages provide working Download buttons in the same tab.
  const anonymousWebsite = location.hostname === 'anonymous.4open.science' &&
    location.pathname.match(/^\/w\/([^/]+)(?:\/|$)/);
  if (!anonymousWebsite) return;

  document.querySelectorAll('a[data-step-download]').forEach((link) => {
    link.href = '/r/' + anonymousWebsite[1] + '/' + link.getAttribute('href');
    link.removeAttribute('download');
    link.title = 'Open the STEP file, then choose Download';
  });
  const note = document.getElementById('anonymous-download-note');
  if (note) note.hidden = false;
}());
