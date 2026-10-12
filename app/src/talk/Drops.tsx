import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, type ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';

/** 极简主视觉：空闲大头头球（高对比灰阶呼吸）；裂开后水平线小圆，无渐变、不粘连 */
export function useReduceMotion() {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setRm).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setRm);
    return () => sub?.remove?.();
  }, []);
  return rm;
}

export type Drop = { key: string; task_id: string; role: string; icon: string; vetoed: boolean; merged: boolean; x: number; y: number; pushTo?: string };
export type Phase = 'idle' | 'listening' | 'running' | 'asking' | 'done' | 'following' | 'stopped';
export const DROP_H_IDLE = 340;
export const DROP_H_RUN = 88;

/** 白底可读：中灰实心 + 更深边缘，避免与 #FFF 融掉 */
const GRAY = '#C7C7CC';
const PALE = '#D8D8DC';
const BLACK = '#000000';
const G0 = '#A1A1A6';
const G1 = '#D1D1D6';
const G2 = '#6C6C70';
const MEETING_SOLID = '#C7C7CC';
/** 头头浅描边：白底上轮廓清晰，不花哨 */
const ORB_STROKE = 'rgba(0,0,0,0.14)';

export function layoutDrops(drops: Drop[], width: number): Drop[] {
  const n = drops.length;
  if (!n) return drops;
  const gap = Math.min(56, Math.max(42, (width - 64) / Math.max(n, 1)));
  const span = gap * (n - 1);
  return drops.map((d, i) => ({ ...d, x: -span / 2 + i * gap, y: 0 }));
}

type Body = { x: number; y: number; vx: number; vy: number; r: number; sx: number; sy: number; op: number; color: string };
const mk = (o: Partial<Body> = {}): Body => ({ x: 0, y: 0, vx: 0, vy: 0, r: 18, sx: 1, sy: 1, op: 0, color: GRAY, ...o });

function easeIO(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** 固定高对比三档，避免每帧 hex lerp */
const GRAD_A = [G2, G0, G1, G0, G2] as const;
const GRAD_B = [G0, G1, '#E8E8ED', G1, G0] as const;

export function DropStage({ width, phase, level, pulse, drops, speaking, falls, reduce, followHint, onPressBoss, onLongPressBoss, onInfo, bossSkin }: {
  width: number; phase: Phase; level: number; pulse: number; drops: Drop[]; speaking: string | null; falls: number; reduce: boolean;
  followHint?: string; onPressBoss?: () => void; onLongPressBoss?: () => void; onInfo?: (s: string) => void;
  bossSkin?: ImageSourcePropType | { uri: string } | null;
}) {
  const idle = phase === 'idle' || phase === 'listening';
  const showHero = idle || phase === 'done' || phase === 'following' || !drops.some((d) => !d.merged);
  // P0：done/following 收成小状态球，把空间让给卡片，避免大球挤内容 / 双圆叠
  const heroBig = idle;
  const h = showHero && heroBig ? DROP_H_IDLE : (showHero ? DROP_H_RUN + 24 : DROP_H_RUN);
  const cy = heroBig ? h * 0.48 : 36;
  const cx = width / 2;
  const bodies = useRef<Record<string, Body>>({ main: mk({ r: 120, op: 1, color: GRAY }) });
  const kick = useRef<Record<string, number>>({});
  const fall = useRef({ q: 0, t0: 0, seen: 0 });
  const fx = useRef({ phase: 0, solid: 0, ring: 0 });
  const [, setTick] = useState(0);
  const split = drops.some((d) => !d.merged);
  const stopped = phase === 'stopped';
  const st = useRef({ drops, split, speaking, phase, reduce, cx, cy, idle, showHero });
  st.current = { drops, split, speaking, phase, reduce, cx, cy, idle, showHero };

  useEffect(() => { if (idle) kick.current.main = 0.04 + Math.min(level, 40) / 280; }, [level, idle]);
  useEffect(() => {
    if (!pulse || !speaking) return;
    if (speaking === 'jarvis:main') kick.current.main = 0.08;
    else kick.current[speaking] = 0.1;
  }, [pulse]);
  useEffect(() => { drops.forEach((d) => { if (d.pushTo && kick.current[`push:${d.key}`] === undefined) kick.current[`push:${d.key}`] = 1; }); }, [drops]);
  useEffect(() => { if (falls > fall.current.seen) { fall.current.q += falls - fall.current.seen; fall.current.seen = falls; } if (!falls) fall.current = { q: 0, t0: 0, seen: 0 }; }, [falls]);
  useEffect(() => { if (phase === 'running' && !drops.length) kick.current = {}; }, [phase, drops.length]);
  useEffect(() => { onInfo?.(`drops=hero idle=${idle} reduce=${reduce}`); }, [reduce, idle]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let stopAt = 0;
    let lastPaint = 0;
    // 物理 60fps，React 绘制限 ~24fps，减轻白屏卡顿
    const PAINT_MS = 42;
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const S = st.current;
      const B = bodies.current;
      const ease = (b: Body, tx: number, ty: number, k = 140, c = 18) => {
        if (S.reduce) { b.x = tx; b.y = ty; b.vx = 0; b.vy = 0; return; }
        b.vx += (k * (tx - b.x) - c * b.vx) * dt;
        b.vy += (k * (ty - b.y) - c * b.vy) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      };
      const to = (cur: number, t: number, rate: number) => cur + (t - cur) * Math.min(1, rate * dt);

      const m = B.main;
      const listening = S.phase === 'listening';
      const meeting = S.phase === 'running' || S.phase === 'asking';
      const following = S.phase === 'following';
      const period = listening ? 2.2 : following ? 3.0 : 4.5;
      if (!S.reduce && (S.idle || following)) {
        fx.current.phase = ((now / 1000) % period) / period;
      }
      const solidTarget = (meeting || S.phase === 'done' || S.phase === 'stopped') && !S.idle ? 1 : (following ? 1 : 0);
      fx.current.solid = to(fx.current.solid, solidTarget, meeting || following ? 1 / 0.3 : 1 / 0.45);
      // 跟进态不再画外环，避免与主球叠成双圆
      fx.current.ring = 0;

      const peak = listening ? 0.55 : 0.4;
      const wave = S.reduce ? 0 : easeIO(0.5 - 0.5 * Math.cos(fx.current.phase * Math.PI * 2)) * peak;
      const sizeBreath = S.reduce ? 0 : (listening
        ? 0.045 * (0.5 + 0.5 * Math.sin(fx.current.phase * Math.PI * 2))
        : (S.idle ? 0.028 * Math.sin(fx.current.phase * Math.PI * 2) : 0));
      const mk0 = kick.current.main ?? 0;
      kick.current.main = to(mk0, 0, 8);

      const mainGone = !S.showHero || S.phase === 'stopped';
      const baseR = Math.min(S.cx * 0.52, 130);
      const heroR = (S.phase === 'done' || following) ? 28 : baseR;
      const mr = mainGone ? 4 : heroR * (1 + sizeBreath + (S.reduce ? 0 : mk0));
      m.r = to(m.r, mr, S.idle ? 5 : 10);
      m.x = S.cx;
      m.y = to(m.y, mainGone ? -60 : S.cy, 8);
      m.op = to(m.op, mainGone ? 0 : 1, 7);
      m.color = MEETING_SOLID;
      kick.current.gradWave = wave;

      const keys = new Set(S.drops.map((d) => d.key));
      for (const d of S.drops) {
        const b = B[d.key] ?? (B[d.key] = mk({ x: S.cx, y: S.cy }));
        const target = d.pushTo ? S.drops.find((x) => x.key === d.pushTo) : undefined;
        const pk = kick.current[`push:${d.key}`] ?? 0;
        if (pk > 0) kick.current[`push:${d.key}`] = Math.max(0, pk - dt * 3);
        const pushAmt = Math.sin(Math.max(0, pk) * Math.PI) * 0.35;
        const tx = d.merged ? S.cx : S.cx + d.x + (target ? (target.x - d.x) * pushAmt : 0);
        ease(b, tx, S.cy);
        const sk = kick.current[d.key] ?? 0;
        kick.current[d.key] = to(sk, 0, 8);
        b.r = to(b.r, 18 * (1 + (S.reduce ? 0 : sk)), 14);
        const [sx, sy] = d.vetoed && !S.reduce ? [1.35, 0.55] : [1, 1];
        b.sx = to(b.sx, sx, 8);
        b.sy = to(b.sy, sy, 8);
        b.op = to(b.op, d.merged ? 0 : 1, d.merged ? (S.showHero ? 14 : 6) : 10);
        b.color = d.vetoed ? PALE : S.speaking === d.key ? BLACK : GRAY;
      }
      Object.keys(B).forEach((k) => { if (k !== 'main' && k !== 'fall' && !keys.has(k)) delete B[k]; });

      const f = fall.current;
      if (!f.t0 && f.q > 0 && S.phase !== 'stopped' && !S.idle) { f.q -= 1; f.t0 = now; }
      if (f.t0) {
        const p = (now - f.t0) / 420;
        if (p >= 1) { f.t0 = 0; delete B.fall; }
        else B.fall = mk({ x: S.cx, y: S.cy + (S.reduce ? 30 : p * p * 50), r: 8, op: S.reduce ? 1 - p : p > 0.85 ? (1 - p) / 0.15 : 1, color: BLACK });
      }

      if (now - lastPaint >= PAINT_MS) {
        lastPaint = now;
        setTick((t) => t + 1);
      }

      if (S.phase === 'stopped') {
        stopAt = stopAt || now;
        Object.entries(B).forEach(([k, b]) => { if (k !== 'main') b.op = Math.max(0, b.op - dt / 0.15); });
        if (now - stopAt > 160) return;
      } else stopAt = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stopped, idle]);

  const list = Object.entries(bodies.current).filter(([, b]) => b.op > 0.02);
  const iconOf = Object.fromEntries(drops.map((d) => [d.key, d]));
  const following = phase === 'following';
  const listening = phase === 'listening';
  const useGrad = !reduce && (phase === 'idle' || phase === 'listening') && fx.current.solid < 0.95;
  const wave = kick.current.gradWave ?? 0;
  const solidMix = fx.current.solid;
  // 两档渐变切换，层次更明显且不每帧算色
  const gradColors = wave > 0.45 ? GRAD_B : GRAD_A;

  return (
    <View style={[s.stage, { width, height: h }]} testID="drop-stage">
      {list.map(([k, b]) => {
        const isSpeak = speaking === k;
        const isMain = k === 'main';
        const w = 2 * b.r * b.sx;
        const hh = 2 * b.r * b.sy;
        const base = {
          position: 'absolute' as const,
          left: b.x - b.r * b.sx,
          top: b.y - b.r * b.sy,
          width: w,
          height: hh,
          borderRadius: 999,
          opacity: b.op,
          borderWidth: isSpeak ? 1.5 : (isMain ? StyleSheet.hairlineWidth * 2 : StyleSheet.hairlineWidth),
          borderColor: isSpeak ? '#000' : (isMain ? ORB_STROKE : 'rgba(0,0,0,0.08)'),
          overflow: 'hidden' as const,
        };
        if (isMain && showHero) {
          const tap = !!(onPressBoss || onLongPressBoss);
          const wrap = (child: React.ReactNode) => tap ? (
            <Pressable
              key={k}
              testID="boss-orb"
              onPress={onPressBoss}
              onLongPress={onLongPressBoss}
              delayLongPress={380}
              hitSlop={12}
              accessibilityLabel="点按跟进，长按换形象"
              style={base}
            >{child}</Pressable>
          ) : (
            <View key={k} testID="boss-orb" style={base}>{child}</View>
          );
          if (bossSkin) {
            return wrap(
              <>
                <Image source={bossSkin} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {solidMix > 0.02 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: MEETING_SOLID, opacity: solidMix * 0.55 }]} /> : null}
              </>
            );
          }
          if (following || solidMix > 0.85) {
            return wrap(<View style={[StyleSheet.absoluteFill, { backgroundColor: MEETING_SOLID }]} />);
          }
          if (useGrad) {
            return wrap(
              <>
                <LinearGradient
                  colors={[...gradColors]}
                  locations={[0, 0.22, 0.5, 0.78, 1]}
                  start={{ x: 0.12 + wave * 0.15, y: 0 }}
                  end={{ x: 0.88 - wave * 0.15, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* 白罩压低：让深灰边缘更清楚 */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: listening ? 0.12 : 0.08 }]} />
                {solidMix > 0.02 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: MEETING_SOLID, opacity: solidMix }]} /> : null}
              </>
            );
          }
          return wrap(<View style={[StyleSheet.absoluteFill, { backgroundColor: b.color }]} />);
        }
        return <View key={k} style={[base, { backgroundColor: b.color }]} />;
      })}
      {list.filter(([k]) => iconOf[k]).map(([k, b]) => {
        const d = iconOf[k];
        const ink = d.vetoed ? '#A8A8A8' : speaking === k ? '#FFFFFF' : '#333333';
        return (
          <View key={`i-${k}`} testID={`drop-${d.role}`} pointerEvents="none" style={[s.icon, { left: b.x - 9, top: b.y - 9, opacity: b.op }]}>
            {d.role === 'fitness'
              ? <Ionicons name="barbell" size={18} color={ink} />
              : <MaterialCommunityIcons name={(d.icon === 'moon' ? 'moon-waning-crescent' : d.icon === 'bowl' ? 'noodles' : d.icon === 'wallet' ? 'wallet-outline' : d.icon) as never} size={16} color={ink} />}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  stage: { position: 'relative', overflow: 'hidden', alignSelf: 'center' },
  icon: { position: 'absolute', width: 18, height: 18 },
});
