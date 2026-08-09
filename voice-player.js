// Plays a pre-rendered voice pack, in place of the browser's speech
// synthesiser. Drop-in for a speakParts(parts, onDone) call site: parts are
// the objects the game's line() already returns, each carrying a `clip` id
// and the `t` it was rendered from.
//
// Why buffers rather than <audio> elements: the game already has an
// AudioContext for its chimes, one unlock gesture covers everything, clips
// start without the lag an element gives you, and cancelling is exact —
// which matters, because a four-year-old taps in the middle of sentences
// constantly and a half-second of stale narration over the next prompt is
// the thing that makes an app feel broken.
(function (global) {
  "use strict";

  function VoicePlayer(opts) {
    opts = opts || {};
    var base = (opts.base || 'voice/').replace(/\/*$/, '/');
    var ext = opts.ext || '.m4a';
    var gap = opts.gap == null ? 120 : opts.gap;    // matches the old chain's feel
    var getContext = opts.context;                  // share the game's AudioContext
    var getDestination = opts.destination || null;  // e.g. a gain node that ducks music
    var onMissing = opts.missing || 'warn';         // 'warn' | 'speak' | 'silent'
    var cacheLimit = opts.cacheLimit || 64;

    var buffers = new Map();     // clip -> AudioBuffer (insertion-ordered LRU)
    var inflight = new Map();    // clip -> Promise, so a preload and a play share one fetch
    var missing = new Set();     // asked for and not there; only complain once
    var session = 0;             // bumped on cancel, so stale chains die quietly
    var playing = null;
    var timer = null;

    function ctx() { return typeof getContext === 'function' ? getContext() : getContext; }

    function load(clip) {
      if (!clip) return Promise.resolve(null);
      if (buffers.has(clip)) {
        var b = buffers.get(clip);          // refresh LRU position
        buffers.delete(clip); buffers.set(clip, b);
        return Promise.resolve(b);
      }
      if (inflight.has(clip)) return inflight.get(clip);

      var p = fetch(base + clip + ext)
        .then(function (r) {
          // status 0 is not a failure here. An iOS WKWebView answers requests
          // for media files through a scheme handler that replies with a bare
          // URLResponse, which carries no status line at all — so `ok` is
          // false and `status` is 0 even though the bytes arrived intact.
          // Rejecting on that alone makes every clip look missing, and a
          // packaged build then plays nothing.
          if (!r.ok && r.status !== 0) throw new Error(r.status + ' ' + r.statusText);
          return r.arrayBuffer();
        })
        .then(function (bytes) {
          var c = ctx();
          if (!c) throw new Error('no AudioContext');
          // Safari only supports the callback form of decodeAudioData
          return new Promise(function (resolve, reject) {
            c.decodeAudioData(bytes, resolve, reject);
          });
        })
        .then(function (buf) {
          buffers.set(clip, buf);
          while (buffers.size > cacheLimit) buffers.delete(buffers.keys().next().value);
          inflight.delete(clip);
          return buf;
        })
        .catch(function (e) {
          inflight.delete(clip);
          if (!missing.has(clip)) {
            missing.add(clip);
            if (onMissing !== 'silent' && global.console) {
              console.warn('voice: no clip ' + clip + ' (' + e.message + ')');
            }
          }
          return null;
        });

      inflight.set(clip, p);
      return p;
    }

    // Speech synthesis, kept only for the lines a pack can never hold — the
    // ones with the child's typed name in them — and for development before
    // the pack exists. A shipped build should pass missing:'silent'.
    function synthesise(part, done) {
      if (!('speechSynthesis' in global)) return done();
      try {
        var u = new SpeechSynthesisUtterance(part.t);
        u.lang = 'en-US';
        u.rate = part.rate || 0.95;
        u.pitch = part.pitch || 1.05;
        if (opts.voice) u.voice = opts.voice;
        var fired = false;
        var once = function () { if (!fired) { fired = true; done(); } };
        u.onend = once; u.onerror = once;
        keepAlive.push(u);                       // Chrome garbage-collects queued utterances
        if (keepAlive.length > 8) keepAlive.shift();
        global.speechSynthesis.speak(u);
        global.speechSynthesis.resume();
        setTimeout(once, 1500 + part.t.length * 110);
      } catch (e) { done(); }
    }
    var keepAlive = [];

    function step(parts, i, mine, onDone) {
      if (mine !== session) return;
      if (i >= parts.length) { playing = null; if (onDone) onDone(); return; }

      var part = parts[i];
      var next = function () {
        if (mine !== session) return;
        timer = setTimeout(function () { step(parts, i + 1, mine, onDone); }, gap);
      };

      if (!part) return next();

      // No clip id at all means the line is deliberately dynamic
      if (!part.clip) {
        return onMissing === 'silent' ? next() : synthesise(part, next);
      }

      load(part.clip).then(function (buf) {
        if (mine !== session) return;
        if (!buf) {
          return onMissing === 'speak' ? synthesise(part, next) : next();
        }
        var c = ctx();
        var src = c.createBufferSource();
        src.buffer = buf;
        // a destination getter that comes back empty must not take the chain
        // down with it: connect(null) throws inside this promise, and the
        // caller waiting on onDone would never hear back
        src.connect((getDestination && getDestination()) || c.destination);
        var advanced = false;
        var once = function () { if (!advanced) { advanced = true; next(); } };
        src.onended = once;
        playing = src;
        try { src.start(); } catch (e) { return once(); }
        // onended is reliable for buffer sources, unlike the synthesiser's
        // end event, but a backstop costs nothing and cannot fire early
        timer = setTimeout(once, (buf.duration * 1000) + 400);
      });
    }

    return {
      // Warm the clips a round is about to need, so the first word of a
      // prompt is not waiting on a decode.
      preload: function (clips) {
        (clips || []).forEach(function (c) { if (c) load(c); });
      },

      say: function (parts, onDone) {
        this.cancel();
        var mine = session;
        step(parts.filter(Boolean), 0, mine, onDone);
      },

      cancel: function () {
        session++;
        clearTimeout(timer);
        if (playing) { try { playing.stop(); } catch (e) {} playing = null; }
        if ('speechSynthesis' in global) { try { global.speechSynthesis.cancel(); } catch (e) {} }
      },

      // True once every clip is decoded and ready; useful in tests.
      ready: function (clips) {
        return Promise.all((clips || []).map(load)).then(function (bs) {
          return bs.every(Boolean);
        });
      },

      missing: function () { return [...missing]; }
    };
  }

  if (typeof module === 'object' && module.exports) module.exports = VoicePlayer;
  else global.VoicePlayer = VoicePlayer;
})(typeof window !== 'undefined' ? window : globalThis);
