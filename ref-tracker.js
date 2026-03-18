// Global ref tracker — appends ?ref=jobsbyculture.com to all external links
// Runs on mousedown (before click) so the href is modified before navigation starts
(function() {
  var REF = 'jobsbyculture.com';
  var OWN_DOMAINS = ['jobsbyculture.com', 'www.jobsbyculture.com'];

  function tagLink(link) {
    var href = link.getAttribute('href');
    if (!href) return;

    // Skip internal links, anchors, javascript:, mailto:, tel:
    if (href.charAt(0) === '/' || href.charAt(0) === '#' || href.indexOf('javascript:') === 0 || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;

    try {
      var url = new URL(href);
      if (OWN_DOMAINS.indexOf(url.hostname) !== -1) return;
      if (url.searchParams.has('ref')) return;

      url.searchParams.set('ref', REF);
      link.setAttribute('href', url.toString());
    } catch(err) {}
  }

  // Tag on mousedown — fires before click, so href is ready before navigation
  document.addEventListener('mousedown', function(e) {
    var link = e.target.closest('a[href]');
    if (link) tagLink(link);
  }, true);

  // Also tag on touchstart for mobile
  document.addEventListener('touchstart', function(e) {
    var link = e.target.closest('a[href]');
    if (link) tagLink(link);
  }, true);

  // Also tag on focus for keyboard navigation (Tab + Enter)
  document.addEventListener('focusin', function(e) {
    if (e.target && e.target.tagName === 'A') tagLink(e.target);
  }, true);
})();
