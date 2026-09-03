/**
 * High-Precision SAR Multi-Object Tracking & Human Identification Engine
 * 
 * Implements:
 * 1. IoU (Intersection-over-Union) + Centroid Cost matrix matching
 * 2. Kalman-style Exponential Moving Average (EMA) smoothing
 * 3. 60 FPS motion dead reckoning & velocity vector extrapolation
 * 4. Human posture classification (Standing vs Prone/Downed vs Crouched)
 * 5. Vitality & stationary dwell analysis for emergency rescue triage
 * 6. Target range, bearing, and estimated ground GPS coordinate projection
 * 7. Track breadcrumbs trail & occlusion coasting
 */

export type PostureType = 'standing' | 'prone' | 'crouched' | 'unknown';
export type VitalityType = 'active' | 'stationary' | 'rapid';

export interface RawDetection {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  score: number;
  cls: string;
  label?: string;
}

export interface TrackPoint {
  x: number;
  y: number;
  time: number;
}

export interface TrackedSARObject {
  id: number;
  cls: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  speedPxPerSec: number;
  score: number;
  history: TrackPoint[];
  lostFrames: number;
  totalFrames: number;
  firstSeen: number;
  lastSeen: number;
  coasting: boolean;
  
  // Human Identification & SAR Metrics
  isPerson: boolean;
  posture: PostureType;
  vitality: VitalityType;
  stationaryDurationSec: number;
  estDistanceM: number;
  estBearingDeg: number;
  estGpsLat: number;
  estGpsLon: number;
  heatDeltaC: number;
  label: string;
}

// Compute Intersection-over-Union between two boxes
export function computeIoU(
  boxA: { x: number; y: number; w: number; h: number },
  boxB: { x: number; y: number; w: number; h: number }
): number {
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.w, boxB.x + boxB.w);
  const yB = Math.min(boxA.y + boxA.h, boxB.y + boxB.h);

  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const interArea = interW * interH;

  if (interArea <= 0) return 0;

  const areaA = boxA.w * boxA.h;
  const areaB = boxB.w * boxB.h;
  const unionArea = areaA + areaB - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

export class SARTrackingEngine {
  private tracks: TrackedSARObject[] = [];
  private nextId = 1;
  private maxLostFrames = 14; // Coast for ~14 frames before dropping
  private maxHistoryLen = 22; // Breadcrumb trail points

  /**
   * Primary detection update (called every time neural network yields bounding boxes)
   */
  public update(
    detections: RawDetection[],
    uavTelemetry: {
      altitudeM: number;
      headingDeg: number;
      lat: number;
      lon: number;
      viewWidth: number;
      viewHeight: number;
    },
    humanIdEnabled = true
  ): TrackedSARObject[] {
    const now = Date.now();
    const matchedDets = new Set<number>();
    const updatedTracks: TrackedSARObject[] = [];

    // 1. Predict track position forward using existing velocity
    const predictedTracks = this.tracks.map((tr) => {
      const predX = tr.x + tr.vx;
      const predY = tr.y + tr.vy;
      const predCx = tr.cx + tr.vx;
      const predCy = tr.cy + tr.vy;
      return { ...tr, predX, predY, predCx, predCy };
    });

    // 2. Compute cost and match using IoU + normalized distance
    for (const tr of predictedTracks) {
      let bestScore = -1;
      let bestIdx = -1;

      for (let i = 0; i < detections.length; i++) {
        if (matchedDets.has(i)) continue;
        const det = detections[i];

        // Class must match (or both must be general object if low conf)
        const classMatch = det.cls === tr.cls;
        if (!classMatch && tr.cls === 'person') continue;

        // Calculate IoU against predicted box
        const iou = computeIoU(
          { x: tr.predX, y: tr.predY, w: tr.w, h: tr.h },
          { x: det.x, y: det.y, w: det.w, h: det.h }
        );

        // Calculate normalized centroid distance
        const dx = (det.cx - tr.predCx) / Math.max(30, tr.w);
        const dy = (det.cy - tr.predCy) / Math.max(30, tr.h);
        const distNorm = Math.sqrt(dx * dx + dy * dy);

        // Combined matching score
        let score = 0;
        if (iou > 0.15) {
          score = iou * 2.0;
        } else if (distNorm < 2.5) {
          score = Math.max(0, 1.0 - distNorm / 2.5);
        }

        if (score > bestScore && score > 0.2) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        matchedDets.add(bestIdx);
        const det = detections[bestIdx];

        // Kalman-like Exponential Moving Average (EMA) smoothing for coordinates
        const alphaPos = 0.65; // Position smoothing
        const alphaSize = 0.5; // Size smoothing
        const smoothedX = tr.x * (1 - alphaPos) + det.x * alphaPos;
        const smoothedY = tr.y * (1 - alphaPos) + det.y * alphaPos;
        const smoothedW = tr.w * (1 - alphaSize) + det.w * alphaSize;
        const smoothedH = tr.h * (1 - alphaSize) + det.h * alphaSize;
        const smoothedCx = smoothedX + smoothedW / 2;
        const smoothedCy = smoothedY + smoothedH / 2;

        // Instantaneous displacement
        const measuredVx = smoothedCx - tr.cx;
        const measuredVy = smoothedCy - tr.cy;

        // Velocity filter (alpha = 0.6)
        const vx = tr.vx * 0.4 + measuredVx * 0.6;
        const vy = tr.vy * 0.4 + measuredVy * 0.6;
        const speed = Math.hypot(vx, vy);

        // History trail
        const newHistory = [...tr.history, { x: smoothedCx, y: smoothedCy, time: now }];
        if (newHistory.length > this.maxHistoryLen) {
          newHistory.shift();
        }

        // Posture Analysis for Human SAR
        const isPerson = det.cls === 'person';
        const aspectRatio = smoothedH / Math.max(1, smoothedW);
        let posture: PostureType = 'unknown';
        if (isPerson) {
          if (aspectRatio >= 1.35) {
            posture = 'standing';
          } else if (aspectRatio >= 0.75) {
            posture = 'crouched';
          } else {
            posture = 'prone'; // Critical search & rescue indicator!
          }
        }

        // Vitality & Movement Dwell
        let vitality: VitalityType = 'active';
        let stationaryDur = tr.stationaryDurationSec;
        if (speed < 0.4) {
          stationaryDur += (now - tr.lastSeen) / 1000;
          if (stationaryDur > 3.5) {
            vitality = 'stationary';
          }
        } else if (speed > 4.0) {
          vitality = 'rapid';
          stationaryDur = 0;
        } else {
          vitality = 'active';
          stationaryDur = 0;
        }

        // SAR Telemetry Estimation
        const sarMetrics = this.computeSARMetrics(
          smoothedCx,
          smoothedCy,
          smoothedH,
          uavTelemetry,
          isPerson
        );

        updatedTracks.push({
          ...tr,
          x: smoothedX,
          y: smoothedY,
          w: smoothedW,
          h: smoothedH,
          cx: smoothedCx,
          cy: smoothedCy,
          vx,
          vy,
          speedPxPerSec: speed * 30,
          score: Math.max(tr.score * 0.2 + det.score * 0.8, det.score),
          history: newHistory,
          lostFrames: 0,
          totalFrames: tr.totalFrames + 1,
          lastSeen: now,
          coasting: false,
          isPerson,
          posture,
          vitality,
          stationaryDurationSec: stationaryDur,
          estDistanceM: sarMetrics.distanceM,
          estBearingDeg: sarMetrics.bearingDeg,
          estGpsLat: sarMetrics.lat,
          estGpsLon: sarMetrics.lon,
          heatDeltaC: isPerson ? (tr.heatDeltaC || 3.2 + (Math.sin(tr.id) * 0.8)) : 0,
          label: det.label || tr.label,
        });
      } else {
        // Track missed in this frame: Coast with momentum if within limit
        if (tr.lostFrames < this.maxLostFrames) {
          const coastX = tr.x + tr.vx * 0.85;
          const coastY = tr.y + tr.vy * 0.85;
          const coastCx = coastX + tr.w / 2;
          const coastCy = coastY + tr.h / 2;

          updatedTracks.push({
            ...tr,
            x: coastX,
            y: coastY,
            cx: coastCx,
            cy: coastCy,
            vx: tr.vx * 0.85,
            vy: tr.vy * 0.85,
            lostFrames: tr.lostFrames + 1,
            coasting: true,
          });
        }
      }
    }

    // 3. Register brand new tracks for unmatched detections
    for (let i = 0; i < detections.length; i++) {
      if (matchedDets.has(i)) continue;
      const det = detections[i];
      const id = this.nextId++;
      const isPerson = det.cls === 'person';
      const aspectRatio = det.h / Math.max(1, det.w);
      let posture: PostureType = 'unknown';
      if (isPerson) {
        if (aspectRatio >= 1.35) posture = 'standing';
        else if (aspectRatio >= 0.75) posture = 'crouched';
        else posture = 'prone';
      }

      const sarMetrics = this.computeSARMetrics(
        det.cx,
        det.cy,
        det.h,
        uavTelemetry,
        isPerson
      );

      updatedTracks.push({
        id,
        cls: det.cls,
        x: det.x,
        y: det.y,
        w: det.w,
        h: det.h,
        cx: det.cx,
        cy: det.cy,
        vx: 0,
        vy: 0,
        speedPxPerSec: 0,
        score: det.score,
        history: [{ x: det.cx, y: det.cy, time: now }],
        lostFrames: 0,
        totalFrames: 1,
        firstSeen: now,
        lastSeen: now,
        coasting: false,
        isPerson,
        posture,
        vitality: 'active',
        stationaryDurationSec: 0,
        estDistanceM: sarMetrics.distanceM,
        estBearingDeg: sarMetrics.bearingDeg,
        estGpsLat: sarMetrics.lat,
        estGpsLon: sarMetrics.lon,
        heatDeltaC: isPerson ? 3.4 : 0,
        label: det.label || (isPerson && humanIdEnabled ? 'SURVIVOR' : det.cls.toUpperCase()),
      });
    }

    this.tracks = updatedTracks;
    return this.tracks;
  }

  /**
   * High-rate 60 FPS motion interpolation between detection ticks
   * Glides bounding boxes forward smoothly with velocity
   */
  public stepAnimation(dt = 0.016): TrackedSARObject[] {
    for (const tr of this.tracks) {
      if (Math.abs(tr.vx) > 0.02 || Math.abs(tr.vy) > 0.02) {
        tr.x += tr.vx * 0.4;
        tr.y += tr.vy * 0.4;
        tr.cx = tr.x + tr.w / 2;
        tr.cy = tr.y + tr.h / 2;
      }
    }
    return this.tracks;
  }

  /**
   * Computes ground distance, bearing, and estimated GPS coordinates from UAV position
   */
  private computeSARMetrics(
    cx: number,
    cy: number,
    hPx: number,
    uav: {
      altitudeM: number;
      headingDeg: number;
      lat: number;
      lon: number;
      viewWidth: number;
      viewHeight: number;
    },
    isPerson: boolean
  ) {
    const halfW = uav.viewWidth / 2 || 320;
    const halfH = uav.viewHeight / 2 || 200;

    // Relative angle off optical boresight center (assuming ~60° FOV)
    const angleXDeg = ((cx - halfW) / halfW) * 30;
    const angleYDeg = ((cy - halfH) / halfH) * 20;

    // Ground distance estimation: based on altitude and pixel offset
    const groundDistFromCenter = Math.tan((Math.abs(angleXDeg) * Math.PI) / 180) * uav.altitudeM;
    const directRangeM = Math.hypot(uav.altitudeM, groundDistFromCenter);
    const distanceM = +(Math.max(8, directRangeM)).toFixed(1);

    // Target bearing relative to true north
    let bearingDeg = Math.round(uav.headingDeg + angleXDeg);
    if (bearingDeg < 0) bearingDeg += 360;
    if (bearingDeg >= 360) bearingDeg -= 360;

    // Target ground GPS projection (approximate 1 degree lat ~ 111km)
    const distKm = distanceM / 1000;
    const radBearing = (bearingDeg * Math.PI) / 180;
    const deltaLat = (distKm / 111) * Math.cos(radBearing);
    const deltaLon =
      (distKm / (111 * Math.cos((uav.lat * Math.PI) / 180))) * Math.sin(radBearing);

    const targetLat = +(uav.lat + deltaLat).toFixed(6);
    const targetLon = +(uav.lon + deltaLon).toFixed(6);

    return {
      distanceM,
      bearingDeg,
      lat: targetLat,
      lon: targetLon,
    };
  }

  public getTracks(): TrackedSARObject[] {
    return this.tracks;
  }

  public clear() {
    this.tracks = [];
  }
}

export const trackingEngine = new SARTrackingEngine();
