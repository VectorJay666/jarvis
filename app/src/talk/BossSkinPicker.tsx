import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef } from 'react';
import {
  Animated, Image, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { POOL_ITEMS, type BossSkinId, persistUpload, saveBossSkinId } from './bossSkin';
import { hap } from './haptics';
import { Tap } from './press';

const BG = '#F2F2F7';
const LABEL = '#8E8E93';
const INK = '#000000';
const PREVIEW = 72;
const GAP = 12;
const PAD = 20;
const RADIUS = 14;
const DAMP = 0.86;

type Props = {
  visible: boolean;
  current: BossSkinId;
  uploadPreview?: string | null;
  reduceMotion?: boolean;
  onClose: () => void;
  onSelect: (id: BossSkinId, uri?: string | null) => void;
};

export function BossSkinPicker({ visible, current, uploadPreview, reduceMotion, onClose, onSelect }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // 小屏也给够高度，内容靠 ScrollView 滚到底见相册/恢复默认
  const sheetH = Math.min(Math.max(height * 0.72, 420), height * 0.88);
  const y = useRef(new Animated.Value(sheetH)).current;

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      y.setValue(0);
      return;
    }
    y.setValue(sheetH);
    Animated.spring(y, { toValue: 0, damping: DAMP * 20, stiffness: 180, mass: 0.9, useNativeDriver: true }).start();
  }, [visible, sheetH, reduceMotion, y]);

  const close = () => {
    if (reduceMotion) { onClose(); return; }
    Animated.spring(y, { toValue: sheetH, damping: DAMP * 20, stiffness: 200, mass: 0.85, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const pickDefault = async () => {
    hap.selection();
    await saveBossSkinId('default');
    onSelect('default', null);
    close();
  };

  const pickPool = async (id: BossSkinId) => {
    hap.selection();
    await saveBossSkinId(id);
    onSelect(id, null);
    close();
  };

  const pickAlbum = async () => {
    hap.selection();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const mediaTypes = (ImagePicker as { MediaTypeOptions?: { Images: unknown } }).MediaTypeOptions?.Images ?? ['images'];
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypes as never,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      exif: false,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const uri = await persistUpload(res.assets[0].uri);
    onSelect('upload', uri);
    close();
  };

  const bottomPad = Math.max(insets.bottom, 16) + 8;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} testID="boss-skin-modal">
      <View style={st.root}>
        <Tap feedback="selection" style={st.dim} onPress={close} accessibilityLabel="关闭" pressOpacity={1} pressScale={1} />
        <Animated.View style={[st.sheetWrap, { height: sheetH, transform: [{ translateY: y }] }]} testID="boss-skin-sheet">
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={st.sheetInner}>
            {/* 标题 + 完成：固定不滚 */}
            <View style={st.header} testID="boss-skin-header">
              <View style={{ flex: 1 }}>
                <Text style={st.title}>换形象</Text>
                <Text style={st.sub}>本地保存 · 只改头头</Text>
              </View>
              <Tap
                testID="skin-done"
                feedback="selection"
                onPress={close}
                style={st.doneBtn}
                accessibilityLabel="完成"
                hitSlop={8}
              >
                <Text style={st.doneText}>完成</Text>
              </Tap>
            </View>

            <ScrollView
              testID="boss-skin-scroll"
              style={st.scroll}
              contentContainerStyle={[st.scrollContent, { paddingBottom: bottomPad }]}
              showsVerticalScrollIndicator
              bounces
              keyboardShouldPersistTaps="handled"
            >
              <Tap testID="skin-default" feedback={false} onPress={pickDefault} style={[st.row, current === 'default' && st.rowOn]}>
                <View style={st.defaultOrb} />
                <View style={{ flex: 1 }}>
                  <Text style={st.rowTitle}>恢复默认</Text>
                  <Text style={st.rowSub}>灰阶呼吸</Text>
                </View>
                {current === 'default' ? <Text style={st.check}>✓</Text> : null}
              </Tap>

              <Text style={st.section}>形象池</Text>
              <View style={st.grid}>
                {POOL_ITEMS.map((p) => {
                  const on = current === p.id;
                  return (
                    <Tap
                      key={p.id}
                      testID={`skin-${p.id}`}
                      feedback={false}
                      onPress={() => pickPool(p.id)}
                      style={[st.cell, on && st.cellOn]}
                    >
                      <Image source={p.source} style={st.preview} />
                      <Text style={st.cellLabel}>{p.label}</Text>
                    </Tap>
                  );
                })}
              </View>

              <Tap
                testID="skin-upload"
                feedback={false}
                onPress={pickAlbum}
                style={[st.row, current === 'upload' && st.rowOn, { marginTop: 16 }]}
              >
                {uploadPreview ? (
                  <Image source={{ uri: uploadPreview }} style={st.uploadThumb} />
                ) : (
                  <View style={[st.defaultOrb, { backgroundColor: '#E5E5EA' }]}>
                    <Text style={{ fontSize: 22, color: LABEL }}>＋</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={st.rowTitle}>从相册选图</Text>
                  <Text style={st.rowSub}>裁成圆 · 仅本机</Text>
                </View>
                {current === 'upload' ? <Text style={st.check}>✓</Text> : null}
              </Tap>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  sheetWrap: {
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: 'rgba(242,242,247,0.72)',
  },
  sheetInner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: PAD,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
  },
  title: { fontSize: 20, fontWeight: '600', color: INK, letterSpacing: 0.2 },
  sub: { fontSize: 13, fontWeight: '400', color: LABEL, marginTop: 4 },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { fontSize: 17, fontWeight: '600', color: INK },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 14 },
  section: { fontSize: 13, fontWeight: '400', color: LABEL, marginTop: 18, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  rowOn: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.12)' },
  rowTitle: { fontSize: 17, fontWeight: '400', color: INK },
  rowSub: { fontSize: 13, fontWeight: '400', color: LABEL, marginTop: 2 },
  check: { fontSize: 17, color: INK, fontWeight: '600' },
  defaultOrb: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#C7C7CC',
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(0,0,0,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadThumb: { width: 52, height: 52, borderRadius: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    width: '47%' as unknown as number,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  cellOn: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.14)' },
  preview: { width: PREVIEW, height: PREVIEW, borderRadius: PREVIEW / 2 },
  cellLabel: { marginTop: 8, fontSize: 13, fontWeight: '400', color: LABEL },
});
