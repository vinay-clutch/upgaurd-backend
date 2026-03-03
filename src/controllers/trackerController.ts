import { Request, Response } from 'express';

export const getTrackerScript = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const protocol = req.protocol;
  const host = req.get('host');
  const backendUrl = `${protocol}://${host}`;
  
  const script = `
(function() {
  var siteId = document.currentScript 
    ? document.currentScript.getAttribute('data-site-id')
    : null;
  if (!siteId) return;

  var API = '${backendUrl}';
  
  // Generate session ID
  var sessionId = sessionStorage.getItem('ug_session');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    sessionStorage.setItem('ug_session', sessionId);
  }

  var sessionStart = Date.now();

  // Track page view
  function trackPageView() {
    fetch(API + '/api/v1/analytics/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: siteId,
        page_url: window.location.pathname,
        referrer: document.referrer || null,
        session_id: sessionId
      })
    }).catch(function() {});
  }

  // Track JS errors
  window.onerror = function(message, source, line, col, error) {
    fetch(API + '/api/v1/analytics/track/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: siteId,
        message: String(message),
        stack: error ? error.stack : ('Line ' + line + ':' + col),
        page_url: window.location.pathname
      })
    }).catch(function() {});
  };

  // Track unhandled promise rejections
  window.onunhandledrejection = function(event) {
    fetch(API + '/api/v1/analytics/track/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: siteId,
        message: 'Unhandled Promise: ' + String(event.reason),
        stack: event.reason?.stack || null,
        page_url: window.location.pathname
      })
    }).catch(function() {});
  };

  // Track session end
  window.addEventListener('beforeunload', function() {
    var duration = Math.round((Date.now() - sessionStart) / 1000);
    navigator.sendBeacon(
      API + '/api/v1/analytics/track/session-end',
      JSON.stringify({
        site_id: siteId,
        session_id: sessionId,
        duration_seconds: duration
      })
    );
  });

  // Init
  trackPageView();
})();
  `;
  
  res.send(script);
};
