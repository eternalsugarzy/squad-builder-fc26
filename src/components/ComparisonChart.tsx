/**
 * FC26 Career Mode Manager - Team OVR Comparison Chart
 * Uses react-native-chart-kit with Neo-Brutalism styling.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import type { SquadFull } from '@/src/services/squadService';

interface ComparisonChartProps {
  squads: SquadFull[];
}

export function ComparisonChart({ squads }: ComparisonChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 64, 380);

  const labels = squads.map((s) => `Tim ${s.tier_order}`);
  const data = squads.map((s) => s.avg_ovr || 0);

  const chartData = {
    labels,
    datasets: [
      {
        data: data.length > 0 ? data : [0, 0, 0, 0],
      },
    ],
  };

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FAFAFA',
    backgroundGradientTo: '#FAFAFA',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(10, 17, 40, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(10, 17, 40, ${opacity})`,
    style: {
      borderRadius: 0,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#E0E0E0',
      strokeWidth: 1,
    },
    fillShadowGradientFrom: '#D4AF37',
    fillShadowGradientFromOpacity: 1,
    fillShadowGradientTo: '#0A1128',
    fillShadowGradientToOpacity: 0.85,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.chartTitle}>PERBANDINGAN RATA-RATA OVR TIM</Text>
      <View style={styles.chartWrapper}>
        <BarChart
          data={chartData}
          width={chartWidth}
          height={200}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={chartConfig}
          fromZero
          showValuesOnTopOfBars
          style={styles.chartStyle}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FAFAFA',
    padding: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A1128',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartStyle: {
    marginVertical: 4,
    borderRadius: 0,
  },
});
