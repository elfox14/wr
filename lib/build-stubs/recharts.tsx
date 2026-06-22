import React from 'react';

function Container({ children, ...props }: any) {
  return <div {...props}>{children}</div>;
}

function NullChart() {
  return null;
}

export const ResponsiveContainer = Container;
export const LineChart = Container;
export const AreaChart = Container;
export const BarChart = Container;
export const PieChart = Container;
export const ComposedChart = Container;
export const RadarChart = Container;
export const ScatterChart = Container;
export const RadialBarChart = Container;

export const Line = NullChart;
export const Area = NullChart;
export const Bar = NullChart;
export const Pie = NullChart;
export const Cell = NullChart;
export const XAxis = NullChart;
export const YAxis = NullChart;
export const ZAxis = NullChart;
export const CartesianGrid = NullChart;
export const Tooltip = NullChart;
export const Legend = NullChart;
export const Radar = NullChart;
export const PolarGrid = NullChart;
export const PolarAngleAxis = NullChart;
export const PolarRadiusAxis = NullChart;
export const Scatter = NullChart;
export const RadialBar = NullChart;
export const ReferenceLine = NullChart;
export const ReferenceArea = NullChart;
export const LabelList = NullChart;
