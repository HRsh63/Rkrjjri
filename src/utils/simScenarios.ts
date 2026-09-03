/**
 * Realistic SAR Simulation Scenarios for Ground Control testing
 * 
 * Provides scenarios with lifelike kinematics, posture changes,
 * and multi-target crossing to verify Kalman IoU tracking and human identification.
 */

import { RawDetection } from './trackingEngine';

export interface SimTargetDef {
  x: number;
  y: number;
  w: number;
  h: number;
  cls: string;
  label: string;
  score: number;
  vx: number;
  vy: number;
  type: 'standing' | 'prone' | 'crouched' | 'gear' | 'vehicle';
  behavior: 'patrol' | 'downed' | 'meander' | 'linear';
}

export type ScenarioType = 'alpine-hiker' | 'disaster-prone' | 'multi-target-evac';

export const SIM_SCENARIOS: Record<ScenarioType, { title: string; desc: string; targets: SimTargetDef[] }> = {
  'alpine-hiker': {
    title: 'Alpine SAR: Lost Hiker Sector',
    desc: 'Upright human survivor traversing ravine with expedition pack and emergency locator beacon.',
    targets: [
      {
        x: 180,
        y: 130,
        w: 65,
        h: 140,
        cls: 'person',
        label: 'SURVIVOR-ALPHA',
        score: 0.94,
        vx: 0.45,
        vy: -0.18,
        type: 'standing',
        behavior: 'patrol',
      },
      {
        x: 410,
        y: 220,
        w: 52,
        h: 48,
        cls: 'backpack',
        label: 'GEAR-PACK',
        score: 0.86,
        vx: -0.05,
        vy: 0.12,
        type: 'gear',
        behavior: 'linear',
      },
      {
        x: 310,
        y: 190,
        w: 36,
        h: 38,
        cls: 'bottle',
        label: 'SURVIVAL-KIT',
        score: 0.79,
        vx: 0.1,
        vy: 0.08,
        type: 'gear',
        behavior: 'linear',
      },
    ],
  },
  'disaster-prone': {
    title: 'Disaster Zone: Downed Survivor',
    desc: 'Critical emergency scenario: Injured person in prone posture, immobile, requiring medical evacuation.',
    targets: [
      {
        x: 230,
        y: 190,
        w: 135,
        h: 55, // Low aspect ratio (w > h) -> Prone posture!
        cls: 'person',
        label: 'SURVIVOR-DOWNED (CRITICAL)',
        score: 0.96,
        vx: 0.02, // Barely moving / stationary
        vy: 0.01,
        type: 'prone',
        behavior: 'downed',
      },
      {
        x: 430,
        y: 160,
        w: 90,
        h: 75,
        cls: 'car',
        label: 'DAMAGED-VEHICLE',
        score: 0.88,
        vx: 0,
        vy: 0,
        type: 'vehicle',
        behavior: 'downed',
      },
    ],
  },
  'multi-target-evac': {
    title: 'Disaster Sector: Multi-Subject Evac',
    desc: 'Complex urban/disaster sector with multiple moving subjects crossing paths to demonstrate robust IoU tracking.',
    targets: [
      {
        x: 120,
        y: 150,
        w: 60,
        h: 135,
        cls: 'person',
        label: 'SURVIVOR-01',
        score: 0.92,
        vx: 0.6,
        vy: 0.2,
        type: 'standing',
        behavior: 'patrol',
      },
      {
        x: 390,
        y: 150,
        w: 58,
        h: 132,
        cls: 'person',
        label: 'SURVIVOR-02',
        score: 0.89,
        vx: -0.55,
        vy: 0.15,
        type: 'standing',
        behavior: 'patrol',
      },
      {
        x: 260,
        y: 240,
        w: 70,
        h: 68,
        cls: 'bicycle',
        label: 'EVAC-TRANSPORT',
        score: 0.82,
        vx: 0.3,
        vy: -0.25,
        type: 'vehicle',
        behavior: 'meander',
      },
      {
        x: 480,
        y: 280,
        w: 46,
        h: 44,
        cls: 'backpack',
        label: 'MED-KIT',
        score: 0.85,
        vx: -0.15,
        vy: -0.1,
        type: 'gear',
        behavior: 'linear',
      },
    ],
  },
};

/**
 * Updates simulated targets positions with physics and bounds checking
 */
export function updateSimulatedTargets(
  targets: SimTargetDef[],
  boundsWidth: number,
  boundsHeight: number
): RawDetection[] {
  return targets.map((st) => {
    // Kinematic update
    st.x += st.vx;
    st.y += st.vy;

    // Bounce off margins
    const pad = 24;
    if (st.x < pad) {
      st.x = pad;
      st.vx = Math.abs(st.vx);
    }
    if (st.x + st.w > boundsWidth - pad) {
      st.x = boundsWidth - pad - st.w;
      st.vx = -Math.abs(st.vx);
    }
    if (st.y < pad + 15) {
      st.y = pad + 15;
      st.vy = Math.abs(st.vy);
    }
    if (st.y + st.h > boundsHeight - pad - 15) {
      st.y = boundsHeight - pad - st.h;
      st.vy = -Math.abs(st.vy);
    }

    return {
      x: st.x,
      y: st.y,
      w: st.w,
      h: st.h,
      cx: st.x + st.w / 2,
      cy: st.y + st.h / 2,
      score: st.score,
      cls: st.cls,
      label: st.label,
    };
  });
}
