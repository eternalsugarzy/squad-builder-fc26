/**
 * FC26 Career Mode Manager - Pitch Canvas Component
 * Renders a football pitch with formation/squad slots using react-native-svg.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import Svg, { Rect, Circle, Line, Path, G } from 'react-native-svg';

export interface PitchSlotItem {
  id: string;
  label: string;
  positionName: string;
  coord_x: number; // 0-100 (0=left, 100=right)
  coord_y: number; // 0-100 (0=own goal/bottom, 100=opponent goal/top)
  playerName?: string;
  playerOvr?: number;
  isCaptain?: boolean;
  statusBadge?: string;
  statusColor?: string;
}

interface PitchCanvasProps {
  slots: PitchSlotItem[];
  selectedSlotId?: string | null;
  onSelectSlot?: (slot: PitchSlotItem) => void;
  width?: number;
  height?: number;
  showLabelsOnly?: boolean; // In formation builder
  interactive?: boolean;
  onPitchPress?: (coord_x: number, coord_y: number) => void;
}

export const PITCH_RATIO = 1.35; // height / width

export function PitchCanvas({
  slots,
  selectedSlotId,
  onSelectSlot,
  width: customWidth,
  height: customHeight,
  showLabelsOnly = false,
  interactive = true,
  onPitchPress,
}: PitchCanvasProps) {
  const screenWidth = Dimensions.get('window').width;
  const pitchWidth = customWidth ?? Math.min(screenWidth - 32, 380);
  const pitchHeight = customHeight ?? pitchWidth * PITCH_RATIO;

  // Convert logical coordinates (x: 0..100, y: 0..100 where 0 is bottom) to SVG pixels
  function toSvgCoords(cx: number, cy: number) {
    const padX = pitchWidth * 0.08;
    const padY = pitchHeight * 0.08;
    const effWidth = pitchWidth - 2 * padX;
    const effHeight = pitchHeight - 2 * padY;

    const x = padX + (cx / 100) * effWidth;
    // Invert Y so that 0 is near bottom and 100 is near top
    const y = pitchHeight - (padY + (cy / 100) * effHeight);
    return { x, y };
  }

  function handleContainerPress(event: any) {
    if (!onPitchPress) return;
    const { locationX, locationY } = event.nativeEvent;
    const padX = pitchWidth * 0.08;
    const padY = pitchHeight * 0.08;
    const effWidth = pitchWidth - 2 * padX;
    const effHeight = pitchHeight - 2 * padY;

    const cx = Math.max(0, Math.min(100, ((locationX - padX) / effWidth) * 100));
    const cy = Math.max(0, Math.min(100, ((pitchHeight - locationY - padY) / effHeight) * 100));
    onPitchPress(Math.round(cx), Math.round(cy));
  }

  const pW = pitchWidth;
  const pH = pitchHeight;
  const pM = 10; // Pitch margin

  return (
    <View
      style={[styles.container, { width: pitchWidth, height: pitchHeight }]}
      onTouchEnd={onPitchPress ? handleContainerPress : undefined}>
      {/* SVG Background Pitch */}
      <Svg width={pitchWidth} height={pitchHeight} style={StyleSheet.absoluteFill}>
        {/* Field Grass Background (Deep Tactical Green) */}
        <Rect x={0} y={0} width={pW} height={pH} fill="#1E5E3A" rx={8} />

        {/* Pitch Stripes */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Rect
            key={i}
            x={pM}
            y={pM + i * ((pH - 2 * pM) / 6)}
            width={pW - 2 * pM}
            height={(pH - 2 * pM) / 6}
            fill={i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'}
          />
        ))}

        {/* Pitch Outer Boundary Line */}
        <Rect
          x={pM}
          y={pM}
          width={pW - 2 * pM}
          height={pH - 2 * pM}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={2.5}
        />

        {/* Center Line */}
        <Line
          x1={pM}
          y1={pH / 2}
          x2={pW - pM}
          y2={pH / 2}
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={2}
        />

        {/* Center Circle */}
        <Circle
          cx={pW / 2}
          cy={pH / 2}
          r={pW * 0.16}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={2}
        />
        <Circle cx={pW / 2} cy={pH / 2} r={3} fill="rgba(255, 255, 255, 0.9)" />

        {/* Top Penalty Area (Opponent Box) */}
        <Rect
          x={pW * 0.22}
          y={pM}
          width={pW * 0.56}
          height={pH * 0.16}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={2}
        />
        {/* Top Goal Area */}
        <Rect
          x={pW * 0.35}
          y={pM}
          width={pW * 0.3}
          height={pH * 0.06}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={1.5}
        />
        {/* Top Penalty Arc */}
        <Path
          d={`M ${pW * 0.38} ${pM + pH * 0.16} A ${pW * 0.14} ${pW * 0.14} 0 0 0 ${pW * 0.62} ${pM + pH * 0.16}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={1.5}
        />

        {/* Bottom Penalty Area (Own Box) */}
        <Rect
          x={pW * 0.22}
          y={pH - pM - pH * 0.16}
          width={pW * 0.56}
          height={pH * 0.16}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={2}
        />
        {/* Bottom Goal Area */}
        <Rect
          x={pW * 0.35}
          y={pH - pM - pH * 0.06}
          width={pW * 0.3}
          height={pH * 0.06}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={1.5}
        />
        {/* Bottom Penalty Arc */}
        <Path
          d={`M ${pW * 0.38} ${pH - pM - pH * 0.16} A ${pW * 0.14} ${pW * 0.14} 0 0 1 ${pW * 0.62} ${pH - pM - pH * 0.16}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={1.5}
        />
      </Svg>

      {/* Render Player/Formation Slots */}
      {slots.map((slot) => {
        const { x, y } = toSvgCoords(slot.coord_x, slot.coord_y);
        const isSelected = selectedSlotId === slot.id;
        const hasPlayer = Boolean(slot.playerName);

        return (
          <TouchableOpacity
            key={slot.id}
            activeOpacity={interactive ? 0.7 : 1}
            disabled={!interactive}
            onPress={() => onSelectSlot && onSelectSlot(slot)}
            style={[
              styles.slotNode,
              {
                left: x - 28,
                top: y - 26,
              },
              isSelected && styles.slotNodeSelected,
            ]}>
            {/* Captain Badge */}
            {slot.isCaptain && (
              <View style={styles.captainBadge}>
                <Text style={styles.captainText}>C</Text>
              </View>
            )}

            {/* Main Token Circle / Card */}
            {showLabelsOnly || !hasPlayer ? (
              // Formation Builder mode / Empty Slot
              <View style={[styles.formationToken, isSelected && styles.tokenActive]}>
                <Text style={styles.formationTokenText} numberOfLines={1}>
                  {slot.label || slot.positionName}
                </Text>
              </View>
            ) : (
              // Full Squad Pitch View mode
              <View style={[styles.playerToken, isSelected && styles.tokenActive]}>
                <View style={styles.tokenTop}>
                  <Text style={styles.tokenOvr}>{slot.playerOvr ?? '-'}</Text>
                  <Text style={styles.tokenPos}>{slot.positionName}</Text>
                </View>
                <View style={styles.tokenBottom}>
                  <Text style={styles.tokenName} numberOfLines={1}>
                    {slot.playerName}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#1E5E3A',
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  slotNode: {
    position: 'absolute',
    width: 56,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  slotNodeSelected: {
    transform: [{ scale: 1.15 }],
    zIndex: 20,
  },
  captainBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: '#D4AF37',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  captainText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
  },
  formationToken: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A1128',
    borderWidth: 2.5,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  formationTokenText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },
  playerToken: {
    width: 56,
    height: 48,
    backgroundColor: '#0A1128',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  tokenTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0A1128',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tokenOvr: {
    fontSize: 13,
    fontWeight: '900',
    color: '#D4AF37',
  },
  tokenPos: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  tokenBottom: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 2,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenName: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0A1128',
    textAlign: 'center',
  },
  tokenActive: {
    borderColor: '#D4AF37',
    borderWidth: 3,
    backgroundColor: '#1E293B',
  },
});
