/* Game tab: the contest under the active skin's names. Points come live from the server (Game.scores). */
import React from 'react';
import { useStore, loadGame } from './store.js';
import { Icon, Spinner } from './ui.jsx';
import { fmtDue, cx } from './util.js';
import { BADGE_IDS } from './skins.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const BUCKETS = [['tasks', 'Tasks'], ['stages', 'Stage moves'], ['filed', 'Returns filed'], ['reviews', 'Peer reviews'], ['time', 'Logged time']];

function TeamMeter({ skin, game }) {
  const pct = Math.min(100, Math.round((game.total / (game.goal || 1)) * 100));
  const n = (v) => Number(v || 0).toLocaleString();
  if (skin.teams) {
    const a = game.teams.A || 0, b = game.teams.B || 0;
    const aPct = a + b ? Math.round((a / (a + b)) * 100) : 50;
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>{skin.teams[0]} · {n(a)}</span><span>{n(b)} · {skin.teams[1]}</span>
        </div>
        <div className="game-meter" aria-label={skin.teams[0] + ' ' + aPct + '%'}><span style={{ width: aPct + '%' }} /><span className="b" style={{ width: (100 - aPct) + '%' }} /></div>
        <div className="game-muted">Combined {n(game.total)} of {n(game.goal)} {skin.points} ({pct}%)</div>
      </>
    );
  }
  if (skin.id === 'seance') {
    const lit = Math.floor((pct / 100) * LETTERS.length);
    return (
      <>
        <div className="spirit-board" aria-label={pct + '% of the board lit'}>
          <div className="yn"><span>YES</span><span>NO</span></div>
          <div className="row">{LETTERS.slice(0, 13).map((l, i) => <span key={l} className={cx(i < lit && 'lit')}>{l}</span>)}</div>
          <div className="row">{LETTERS.slice(13).map((l, i) => <span key={l} className={cx(i + 13 < lit && 'lit')}>{l}</span>)}</div>
          <div className={cx('bye', pct >= 100 && 'lit')}>GOODBYE</div>
        </div>
        <div className="game-muted">{n(game.total)} of {n(game.goal)} {skin.points} · {lit} of 26 letters lit</div>
      </>
    );
  }
  return (
    <>
      <div className="game-meter" aria-label={pct + '%'}><span style={{ width: pct + '%' }} /></div>
      <div className="game-muted">{n(game.total)} of {n(game.goal)} {skin.points} ({pct}%)</div>
    </>
  );
}

export function GameTab({ skin }) {
  const game = useStore((s) => s.game);
  const me = useStore((s) => s.user && s.user.email);
  const [loading, setLoading] = React.useState(false);
  const refresh = async () => { setLoading(true); await loadGame(); setLoading(false); };
  React.useEffect(() => { refresh(); }, []);

  if (!game) return <div className="game-muted" style={{ padding: 24 }}><Spinner /> Counting {skin.points}…</div>;
  if (!game.enabled) return <div className="game-card" style={{ margin: 24 }}>The contest is off right now. An admin can turn it on in Settings.</div>;

  const mine = (game.people || []).find((p) => p.email === me);
  const rank = mine ? game.people.indexOf(mine) + 1 : null;
  const teamName = (t) => (skin.teams ? skin.teams[t === 'B' ? 1 : 0] : '');
  const when = game.end ? fmtDue(game.start, true) + ' – ' + fmtDue(game.end, true) : 'Since ' + fmtDue(game.start, true);

  return (
    <div data-screen-label="Game">
      <div className="ph">
        <div>
          <div className="ph-title game-title"><Icon name="trophy" size={22} /> {skin.game}</div>
          <div className="ph-meta">{skin.blurb}</div>
        </div>
        <div className="ph-actions">
          <button className="btn" onClick={refresh} disabled={loading}><Icon name="refresh" size={14} /> {loading ? 'Counting…' : 'Refresh'}</button>
        </div>
      </div>

      <div className="game-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="game-card">
            <div className="tm-h3">{skin.goal}</div>
            <TeamMeter skin={skin} game={game} />
            <div className="game-muted">{when}{game.prize ? ' · Prize: ' + game.prize : ''}</div>
          </div>

          <div className="game-card">
            <div className="tm-h3">Leaderboard</div>
            {game.people.filter((p) => p.points > 0 || p.email === me).map((p, i) => (
              <div key={p.email} className={cx('game-row', p.email === me && 'me')}>
                <span className="game-rank">{i + 1}</span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name || p.email}{p.email === me ? ' (you)' : ''}{skin.teams ? <span className="game-muted"> · {teamName(p.team)}</span> : null}
                </span>
                <span style={{ fontWeight: 700 }}>{p.points.toLocaleString()} {skin.points}</span>
              </div>
            ))}
            {!game.people.some((p) => p.points > 0) && <div className="game-muted">No {skin.points} yet. Finish a task on time to get on the board.</div>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {mine && (
            <div className="game-card">
              <div className="tm-h3">You · #{rank} · {mine.points.toLocaleString()} {skin.points}</div>
              <div className="game-rules">
                {BUCKETS.map(([k, l]) => <React.Fragment key={k}><span>{l}</span><span className="pts">{(mine.breakdown[k] || 0).toLocaleString()}</span></React.Fragment>)}
              </div>
              <div className="game-badges">
                {BADGE_IDS.map((id) => {
                  const b = (mine.badges || []).find((x) => x.id === id) || { have: 0, need: 1 };
                  const [name, desc] = skin.badges[id];
                  return (
                    <div key={id} className={cx('game-badge', b.earned && 'earned')} title={desc}>
                      <span className="name">{b.earned ? '★ ' : ''}{name}</span>
                      <span className="game-muted">{desc}</span>
                      {b.need > 1 && <span className="bar"><span style={{ width: Math.round((b.have / b.need) * 100) + '%' }} /></span>}
                      {b.need > 1 && <span className="game-muted">{b.have} / {b.need}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="game-card">
            <div className="tm-h3">How to earn {skin.points}</div>
            <div className="game-rules">
              {(game.rules || []).map(([l, pts]) => <React.Fragment key={l}><span>{l}</span><span className="pts">+{pts}</span></React.Fragment>)}
            </div>
            <div className="game-muted">Points come from the work you already do in Tax Manager. Overdue tasks never take points away. Everyone earns the same points whichever skin they pick.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
