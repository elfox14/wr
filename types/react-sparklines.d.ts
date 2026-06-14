declare module 'react-sparklines' {
  import type { CSSProperties, ReactNode } from 'react';

  export type SparklinesProps = {
    data?: number[];
    width?: number;
    height?: number;
    margin?: number;
    limit?: number;
    min?: number;
    max?: number;
    svgWidth?: number;
    svgHeight?: number;
    preserveAspectRatio?: string;
    children?: ReactNode;
    style?: CSSProperties;
  };

  export type SparklinesLineProps = {
    color?: string;
    style?: CSSProperties;
    children?: ReactNode;
  };

  export function Sparklines(props: SparklinesProps): JSX.Element;
  export function SparklinesLine(props: SparklinesLineProps): JSX.Element;
  export function SparklinesBars(props: SparklinesLineProps): JSX.Element;
  export function SparklinesSpots(props: SparklinesLineProps): JSX.Element;
  export function SparklinesReferenceLine(props: SparklinesLineProps): JSX.Element;
  export function SparklinesNormalBand(props: SparklinesLineProps): JSX.Element;
}
