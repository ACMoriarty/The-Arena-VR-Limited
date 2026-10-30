/* ==========================================================================
   THE ARENA — admin authentication
   --------------------------------------------------------------------------
   Two modes, chosen automatically by whether arena.config.js has `cloud`
   filled in:

   CLOUD MODE (recommended)
     Sign-in is an email + password checked by the server. The server also
     decides what each account may read or write, so the password is REAL
     security, not a screen you can skip. Accounts work on every device.

   LOCAL MODE (fallback when no cloud is configured)
     The check runs in this browser against a salted SHA-256 hash in
     localStorage. It keeps casual visitors out, but someone technical can
     open developer tools and bypass it, and accounts exist only in the one
     browser that created them. Fine to start with; move to cloud mode before
     the data matters.
   ========================================================================== */

(function () {
  'use strict';

  var CFG_KEY = 'arena.admin.config';
  var SESSION_KEY = 'arena.admin.session';
  var Cloud = window.ArenaCloud;

  function cloudMode() { return !!(Cloud && Cloud.configured()); }

  /* =====================================================================
     LOCAL MODE PLUMBING
     ===================================================================== */
  function readCfg() {
    try {
      return JSON.parse(localStorage.getItem(CFG_KEY) || 'null') ||
             { director: null, managers: [] };
    } catch (e) { return { director: null, managers: [] }; }
  }

  function writeCfg(cfg) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); return true; }
    catch (e) { return false; }
  }

  function hasSubtle() {
    return !!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest);
  }

  function randomSalt() {
    var a = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function toHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function hash(password, salt) {
    if (!hasSubtle()) {
      var h = 0, str = salt + '|' + password;
      for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
      return Promise.resolve('weak-' + (h >>> 0).toString(16));
    }
    var enc = new TextEncoder();
    var chain = Promise.resolve(enc.encode(salt + '|' + password));
    for (var r = 0; r < 150; r++) {
      chain = chain.then(function (data) { return crypto.subtle.digest('SHA-256', data); })
                   .then(function (buf) { return new Uint8Array(buf); });
    }
    return chain.then(toHex);
  }

  function same(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* =====================================================================
     SESSION  (local mode only — cloud mode keeps its own)
     ===================================================================== */
  function startSession(role, name) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        role: role, name: name || '', at: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function session() {
    if (cloudMode()) {
      var p = Cloud.cachedProfile();
      if (!p || !Cloud.hasSession()) return null;
      return { role: p.role, name: p.name || p.email || '', cloud: true };
    }
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function signOut() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (cloudMode()) return Cloud.signOut();
    return Promise.resolve();
  }

  function requireRole(need, redirect) {
    var s = session();
    var ok = s && (s.role === need || (need === 'manager' && s.role === 'director'));
    if (!ok) {
      location.replace(redirect || 'index.html');
      return null;
    }
    return s;
  }

  /* =====================================================================
     PUBLIC API
     ===================================================================== */
  var Auth = {
    cloudMode: cloudMode,
    hasSubtle: hasSubtle,
    session: session,
    signOut: signOut,
    requireRole: requireRole,
    config: readCfg,

    /* In cloud mode accounts live on the server, so there is nothing to set
       up in the browser — the gate asks for email + password instead. */
    isSetUp: function () {
      if (cloudMode()) return true;
      var c = readCfg();
      return !!(c.director && c.director.hash);
    },

    hasManagers: function () {
      if (cloudMode()) return true;          // cannot know without asking the server
      return readCfg().managers.length > 0;
    },

    /* password resets for managers need the secret server key, which must
       never ship in a web page — so this is local mode only */
    canResetManagerPassword: function () { return !cloudMode(); },

    /* ---------------- sign in ---------------- */

    /* cloud mode: email + password, verified by the server */
    signInCloud: function (email, password) {
      return Cloud.signIn(email, password).then(function (profile) {
        return { ok: true, role: profile.role, name: profile.name || email };
      }).catch(function (err) {
        return { ok: false, error: err.message || 'Sign in failed.' };
      });
    },

    setDirectorPassword: function (password) {
      var salt = randomSalt();
      return hash(password, salt).then(function (h) {
        var c = readCfg();
        c.director = { salt: salt, hash: h, updatedAt: new Date().toISOString() };
        return writeCfg(c);
      });
    },

    verifyDirector: function (password) {
      var c = readCfg();
      if (!c.director) return Promise.resolve(false);
      return hash(password, c.director.salt).then(function (h) {
        var ok = same(h, c.director.hash);
        if (ok) startSession('director', 'Director');
        return ok;
      });
    },

    verifyManager: function (password) {
      var c = readCfg();
      if (!c.managers.length) return Promise.resolve(null);
      var i = 0;
      function next() {
        if (i >= c.managers.length) return Promise.resolve(null);
        var m = c.managers[i++];
        return hash(password, m.salt).then(function (h) {
          if (same(h, m.hash)) { startSession('manager', m.name); return m; }
          return next();
        });
      }
      return next();
    },

    /* ---------------- manager accounts ---------------- */
    listManagers: function () {
      if (cloudMode()) {
        return Cloud.listManagers().then(function (rows) {
          return rows.filter(function (r) { return r.role !== 'director'; })
                     .map(function (r) {
            return { id: r.id, name: r.name || '', email: r.email || '',
                     createdAt: r.created_at, active: r.active !== false };
          });
        });
      }
      return Promise.resolve(readCfg().managers.map(function (m) {
        return { id: m.id, name: m.name, email: m.email, createdAt: m.createdAt, active: true };
      }));
    },

    addManager: function (name, email, password) {
      if (cloudMode()) return Cloud.createManager(name, email, password);

      var c = readCfg();
      var clash = c.managers.some(function (m) {
        return m.email.toLowerCase() === String(email).toLowerCase();
      });
      if (clash) return Promise.resolve({ ok: false, error: 'That email already has an account.' });

      var salt = randomSalt();
      return hash(password, salt).then(function (h) {
        c.managers.push({
          id: 'mgr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: name, email: email, salt: salt, hash: h,
          createdAt: new Date().toISOString()
        });
        writeCfg(c);
        return { ok: true };
      });
    },

    removeManager: function (id) {
      if (cloudMode()) return Cloud.setManagerActive(id, false);
      var c = readCfg();
      c.managers = c.managers.filter(function (m) { return m.id !== id; });
      writeCfg(c);
      return Promise.resolve(true);
    },

    enableManager: function (id) {
      if (cloudMode()) return Cloud.setManagerActive(id, true);
      return Promise.resolve(true);
    },

    resetManagerPassword: function (id, password) {
      if (cloudMode()) {
        return Promise.reject(new Error(
          'Password resets are done by the manager themselves, from the sign-in page.'));
      }
      var c = readCfg();
      var m = c.managers.filter(function (x) { return x.id === id; })[0];
      if (!m) return Promise.resolve(false);
      var salt = randomSalt();
      return hash(password, salt).then(function (h) {
        m.salt = salt; m.hash = h; m.updatedAt = new Date().toISOString();
        writeCfg(c);
        return true;
      });
    },

    /* ---------------- backup (local mode) ---------------- */
    exportConfig: function () {
      return JSON.stringify({ exportedAt: new Date().toISOString(), config: readCfg() }, null, 2);
    },

    importConfig: function (json) {
      try {
        var parsed = JSON.parse(json);
        var c = parsed.config || parsed;
        if (!c || typeof c !== 'object' || !('managers' in c)) return false;
        return writeCfg(c);
      } catch (e) { return false; }
    },

    wipe: function () {
      try { localStorage.removeItem(CFG_KEY); } catch (e) { /* ignore */ }
      signOut();
    }
  };

  window.ArenaAuth = Auth;
}());
