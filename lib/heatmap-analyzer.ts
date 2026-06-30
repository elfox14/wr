import type { HeatmapPoint } from './match-page/types';

export interface HeatmapAnalysis {
  primaryZone: string;
  primaryFlank: string;
  coverage: string;
  summary: string;
}

export function analyzeHeatmap(points: HeatmapPoint[]): HeatmapAnalysis {
  if (!points || points.length === 0) {
    return {
      primaryZone: 'غير معروف',
      primaryFlank: 'غير معروف',
      coverage: 'غير معروف',
      summary: 'لا توجد بيانات كافية لتحليل الخريطة الحرارية.'
    };
  }

  let def = 0, mid = 0, att = 0;
  let left = 0, center = 0, right = 0;

  points.forEach(pt => {
    const x = Number(pt.x) || 0;
    const y = Number(pt.y) || 0;

    // Longitudinal (x: 0 to 100) -> 0 is own goal, 100 is opponent goal
    if (x < 33.3) def++;
    else if (x < 66.6) mid++;
    else att++;

    // Lateral (y: 0 to 100) -> assuming 0 is left, 100 is right (or vice versa, but usually 0-33 is one flank, 66-100 is the other)
    if (y < 33.3) left++;
    else if (y < 66.6) center++;
    else right++;
  });

  const total = points.length;

  const defPct = def / total;
  const midPct = mid / total;
  const attPct = att / total;

  const leftPct = left / total;
  const centerPct = center / total;
  const rightPct = right / total;

  // Determine Primary Zone
  let primaryZone = 'خط الوسط';
  let zoneFocus = '';
  if (defPct > 0.45 && defPct > midPct && defPct > attPct) {
    primaryZone = 'الثلث الدفاعي';
    zoneFocus = 'دفاعي';
  } else if (attPct > 0.45 && attPct > midPct && attPct > defPct) {
    primaryZone = 'الثلث الهجومي';
    zoneFocus = 'هجومي';
  } else if (midPct > 0.45) {
    primaryZone = 'خط الوسط';
    zoneFocus = 'متوازن';
  } else {
    // Spread out across lengths
    if (attPct + midPct > 0.7) {
      primaryZone = 'وسط الميدان والهجوم';
      zoneFocus = 'هجومي ومبادر';
    } else if (defPct + midPct > 0.7) {
      primaryZone = 'وسط الميدان والدفاع';
      zoneFocus = 'دفاعي ومتحفظ';
    } else {
      primaryZone = 'جميع أرجاء الملعب';
      zoneFocus = 'شامل';
    }
  }

  // Determine Primary Flank
  let primaryFlank = 'العمق';
  if (leftPct > 0.45 && leftPct > centerPct && leftPct > rightPct) {
    primaryFlank = 'الجهة اليسرى';
  } else if (rightPct > 0.45 && rightPct > centerPct && rightPct > leftPct) {
    primaryFlank = 'الجهة اليمنى';
  } else if (centerPct > 0.45) {
    primaryFlank = 'العمق';
  } else {
    if (leftPct + rightPct > 0.6) {
      primaryFlank = 'الأطراف';
    } else {
      primaryFlank = 'كافة الأرجاء العرضية';
    }
  }

  // Determine Coverage / Workrate
  // If a player is concentrated highly in one specific third and one specific flank, they are static.
  // If they are spread out, they have high mobility.
  const maxZone = Math.max(defPct, midPct, attPct);
  const maxFlank = Math.max(leftPct, centerPct, rightPct);
  
  let coverage = '';
  if (maxZone > 0.7 && maxFlank > 0.7) {
    coverage = 'تمركز ثابت ومحدد';
  } else if (maxZone < 0.45 && maxFlank < 0.45) {
    coverage = 'تحرك واسع وحرية كبيرة';
  } else {
    coverage = 'حركة ديناميكية معتادة';
  }

  // Build Summary
  const summary = `يتميز بـ ${coverage}، حيث يتركز المجهود الأكبر في ${primaryZone} مع الاعتماد بشكل رئيسي على ${primaryFlank}. الطابع التكتيكي الأغلب يبدو ${zoneFocus}.`;

  return {
    primaryZone,
    primaryFlank,
    coverage,
    summary
  };
}
