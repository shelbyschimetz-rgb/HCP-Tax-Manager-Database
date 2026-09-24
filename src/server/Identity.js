/**
 * Identity — who is using the app, and the team roster.
 *
 * The roster lives in the "Identity" tab: Name | Email | Active | Roles |
 * Accepting new | Color. Roles is a comma-separated list (ADVISOR, PREPARER,
 * PEER_REVIEWER, OS, BK, BK_LEAD, BK_TEAM_LEAD, EXEC, ADMIN).
 */

var AVATAR_COLORS = ['#0E6FBE', '#00A344', '#623CC9', '#D81B60', '#F4A300', '#0D47A1', '#00838F', '#8D6E63', '#5E35B1', '#C2185B'];

var Identity = (function () {
  var overrideEmail = null; // used by tests

  function currentEmail() {
    if (overrideEmail) return overrideEmail;
    var e = '';
    try { e = Session.getActiveUser().getEmail(); } catch (err) { e = ''; }
    if (!e) { try { e = Session.getEffectiveUser().getEmail(); } catch (err2) { e = ''; } }
    return String(e || '').toLowerCase();
  }

  function initials(name, email) {
    var src = (name || email.split('@')[0].replace(/[._]/g, ' ')).trim();
    var parts = src.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function colorFor(email) {
    var h = 0;
    for (var i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function normalize(row) {
    var email = String(row.email || '').trim().toLowerCase();
    var roles = String(row.roles || '').split(/[,;\s]+/).map(function (r) { return r.trim().toUpperCase(); }).filter(Boolean);
    return {
      email: email,
      name: row.name || email.split('@')[0],
      initials: initials(row.name, email),
      color: row.color || colorFor(email),
      roles: roles,
      active: row.active !== false,
      accepting_new: row.accepting_new !== false,
    };
  }

  function roster() {
    return Db.list('Identity').filter(function (r) { return r.email; }).map(normalize);
  }

  function find(email) {
    email = String(email || '').toLowerCase();
    var list = roster();
    for (var i = 0; i < list.length; i++) if (list[i].email === email) return list[i];
    return null;
  }

  function current() {
    var email = currentEmail();
    var me = find(email);
    if (!me) {
      throw new AppError(
        (email || 'Your account') + ' is not on the Tax Manager team roster. Ask an admin to add you to the Identity tab.',
        'NO_ACCESS');
    }
    if (!me.active) throw new AppError('Your Tax Manager access is inactive. Ask an admin to re-activate it.', 'NO_ACCESS');
    return me;
  }

  function hasRole(user, roles) {
    return user.roles.some(function (r) { return roles.indexOf(r) >= 0; });
  }

  function requireAdmin(user) {
    if (!hasRole(user, ['EXEC', 'ADMIN'])) throw new AppError('Only EXEC or ADMIN roles can do that.', 'FORBIDDEN');
  }

  /**
   * Resolve a Salesforce "Case Owner" display name to a roster email using the
   * first.last@domain convention (middle names dropped). Returns '' when the
   * derived address is not on the active roster — no guessing beyond that.
   */
  function resolveCaseOwner(name) {
    var email = emailFromName(name);
    if (!email) return '';
    var m = find(email);
    return m && m.active ? m.email : '';
  }

  function emailFromName(name) {
    var parts = String(name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z\s'-]/g, ' ')
      .replace(/['-]/g, '')
      .split(/\s+/).filter(Boolean);
    if (parts.length < 2) return '';
    return parts[0] + '.' + parts[parts.length - 1] + '@' + getProp_(PROP.EMAIL_DOMAIN, DEFAULTS.EMAIL_DOMAIN);
  }

  function setTestUser(email) { overrideEmail = email ? String(email).toLowerCase() : null; }

  return {
    currentEmail: currentEmail, current: current, roster: roster, find: find, hasRole: hasRole,
    requireAdmin: requireAdmin, resolveCaseOwner: resolveCaseOwner, emailFromName: emailFromName,
    setTestUser: setTestUser, normalize: normalize,
  };
})();

var Locks = {
  /** Serialize all writes. Apps Script's script lock is global across users. */
  withLock: function (fn) {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      throw new AppError('Tax Manager is busy saving someone else\'s change. Try again in a moment.', 'BUSY');
    }
    try {
      Db.clearCache(); // always read fresh data under the lock
      return fn();
    } finally {
      lock.releaseLock();
    }
  },
};

var Audit = {
  log: function (entityType, entityId, action, field, from, to) {
    Db.insert('AuditLog', {
      audit_id: uid_('A'),
      ts: nowIso_(),
      actor_email: Identity.currentEmail(),
      entity_type: entityType,
      entity_id: entityId,
      action: action,
      field: field || '',
      from_value: from == null ? '' : typeof from === 'object' ? JSON.stringify(from) : String(from),
      to_value: to == null ? '' : typeof to === 'object' ? JSON.stringify(to) : String(to),
    });
  },
  /** Log one row per changed field between two record versions. */
  diff: function (entityType, entityId, before, after, fields) {
    var rows = [];
    fields.forEach(function (f) {
      var a = before[f], b = after[f];
      var sa = a == null ? '' : typeof a === 'object' ? JSON.stringify(a) : String(a);
      var sb = b == null ? '' : typeof b === 'object' ? JSON.stringify(b) : String(b);
      if (sa !== sb) {
        rows.push({
          audit_id: uid_('A'), ts: nowIso_(), actor_email: Identity.currentEmail(),
          entity_type: entityType, entity_id: entityId, action: 'Updated', field: f,
          from_value: sa, to_value: sb,
        });
      }
    });
    Db.insertMany('AuditLog', rows);
    return rows.length;
  },
  forEntity: function (entityType, entityId, limit) {
    var rows = Db.where('AuditLog', function (r) {
      return r.entity_type === entityType && String(r.entity_id) === String(entityId);
    });
    rows.sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    return rows.slice(0, limit || 100);
  },
};
