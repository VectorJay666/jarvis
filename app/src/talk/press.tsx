import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { hap } from './haptics';

type HapKind = 'light' | 'soft' | 'medium' | 'selection' | 'success' | 'warning' | false;

/** Black/white press: slight fade + scale, no color flash. */
export function pressVisual(pressed: boolean, opts?: { opacity?: number; scale?: number }): ViewStyle {
  if (!pressed) return {};
  return {
    opacity: opts?.opacity ?? 0.55,
    transform: [{ scale: opts?.scale ?? 0.96 }],
  };
}

function fire(kind: HapKind) {
  if (!kind) return;
  if (kind === 'light') hap.light();
  else if (kind === 'soft') hap.soft();
  else if (kind === 'medium') hap.medium();
  else if (kind === 'selection') hap.selection();
  else if (kind === 'success') hap.success();
  else if (kind === 'warning') hap.warning();
}

type TapProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Haptic on press-in (feels immediate). Default selection for toolbar taps. */
  feedback?: HapKind;
  /** Opacity when pressed (default 0.55). Set 1 to disable fade. */
  pressOpacity?: number;
  /** Scale when pressed (default 0.96). Set 1 to disable. */
  pressScale?: number;
};

/**
 * Pressable with Apple-minimal press visual + optional haptic.
 * Use for chips, rows, send/mic, sheet actions.
 */
export function Tap({
  feedback = 'selection',
  pressOpacity = 0.55,
  pressScale = 0.96,
  onPress,
  onPressIn,
  style,
  children,
  disabled,
  ...rest
}: TapProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled && feedback) fire(feedback);
        onPressIn?.(e);
      }}
      onPress={onPress}
      style={(state) => {
        const user = typeof style === 'function' ? style(state) : style;
        return [
          user,
          !disabled && pressVisual(state.pressed, { opacity: pressOpacity, scale: pressScale }),
        ];
      }}
    >
      {children}
    </Pressable>
  );
}
