// Global ref tracker — appends ?ref=jobsbyculture.com to all external links on click
(function() {
  var REF = 'jobsbyculture.com';
  var OWN_DOMAINS = ['jobsbyculture.com', 'www.jobsbyculture.com'];

  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href) return;

    // Skip internal links, anchors, javascript:, mailto:, tel:
    if (href.startsWith('/') || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    // Skip if it's our own domain
    try {
      var url = new URL(href);
      if (OWN_DOMAINS.indexOf(url.hostname) !== -1) return;

      // Skip if ref param already exists
      if (url.searchParams.has('ref')) return;

      // Append ref parameter
      url.searchParams.set('ref', REF);
      link.setAttribute('href', url.toString());
    } catch(err) {
      // Invalid URL, skip
    }
  }, true);
})();
